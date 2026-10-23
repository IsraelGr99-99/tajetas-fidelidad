-- =====================================================================
-- Flujo de barra unificado.
--  1. Apartado: al escanear, el código del cliente se consume y se emite un
--     código interno ligado al barista y a la sucursal, válido 5 minutos. Así
--     el QR del cliente no caduca mientras se captura el ticket, y el apartado
--     no sirve a otro barista ni en otra sucursal.
--  2. Estado en vivo de la tarjeta para el cliente (sondeo ligero).
--  3. Catálogo de barra ordenado por popularidad.
-- =====================================================================

alter table public.scan_tokens
  add column bound_staff_id uuid,
  add column bound_branch_id uuid,
  add column origin text not null default 'customer' check (origin in ('customer', 'hold'));

-- ---------------------------------------------------------------------
-- Apartar tarjeta al escanear
-- ---------------------------------------------------------------------
create or replace function public.staff_claim_card(p_branch_id uuid, p_token_hash text, p_hold_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_staff public.staff_members;
  v_token public.scan_tokens;
  v_card public.loyalty_cards;
  v_customer public.customers;
  v_cv public.campaign_versions;
  v_expires timestamptz := now() + interval '5 minutes';
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_branch from public.branches where id = p_branch_id;
  if not found or not private.can_operate_branch(p_branch_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]) then
    return private.reject(v_branch.business_id, 'card.claim', 'forbidden', 'branch', p_branch_id::text);
  end if;
  select * into v_staff from public.staff_members where business_id = v_branch.business_id and user_id = auth.uid();
  if not private.rate_limit_allow('lookup:' || auth.uid(), 120, 600) then
    return private.reject(v_branch.business_id, 'card.claim', 'rate_limited');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_hold_hash is null or p_hold_hash !~ '^[a-f0-9]{64}$'
     or p_token_hash = p_hold_hash then
    return private.reject(v_branch.business_id, 'card.claim', 'invalid_request');
  end if;

  -- Consumir el código mostrado por el cliente (un solo uso).
  update public.scan_tokens
    set consumed_at = now(), consumed_by_staff_id = v_staff.id
    where token_hash = p_token_hash and business_id = v_branch.business_id and origin = 'customer'
      and consumed_at is null and expires_at > now()
    returning * into v_token;
  if v_token.id is null then
    return private.reject(v_branch.business_id, 'card.claim', 'token_invalid');
  end if;

  select * into v_card from public.loyalty_cards where id = v_token.card_id;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_customer.status <> 'active' then
    return private.reject(v_branch.business_id, 'card.claim', 'card_inactive', 'card', v_card.id::text);
  end if;
  if v_token.purpose = 'redeem' and v_card.rewards_balance < 1 then
    return private.reject(v_branch.business_id, 'card.claim', 'no_reward_available', 'card', v_card.id::text);
  end if;

  insert into public.scan_tokens (business_id, card_id, purpose, token_hash, expires_at, bound_staff_id, bound_branch_id, origin)
  values (v_branch.business_id, v_card.id, v_token.purpose, p_hold_hash, v_expires, v_staff.id, v_branch.id, 'hold');

  v_cv := private.current_campaign_version(v_branch.business_id);
  perform private.audit(v_branch.business_id, 'card.claim', 'card', v_card.id::text, 'success',
    jsonb_build_object('branch_id', v_branch.id, 'purpose', v_token.purpose));

  return jsonb_build_object(
    'ok', true,
    'purpose', v_token.purpose,
    'expires_at', v_expires,
    'card_id', v_card.id,
    'display_name', v_customer.display_name,
    'contact_masked', private.mask_contact(v_customer),
    'stamps_balance', v_card.stamps_balance,
    'rewards_balance', v_card.rewards_balance,
    'stamps_required', v_cv.stamps_required,
    'reward_description', v_cv.reward_description
  );
end;
$$;

-- Liberar un apartado si el barista cancela (el cliente debe mostrar un código nuevo).
create or replace function public.staff_release_hold(p_hold_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  update public.scan_tokens t
    set consumed_at = now()
    from public.staff_members sm
    where t.token_hash = p_hold_hash and t.origin = 'hold' and t.consumed_at is null
      and sm.id = t.bound_staff_id and sm.user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Acreditar y canjear: aceptan códigos del cliente o apartados propios
-- ---------------------------------------------------------------------
create or replace function public.record_earn(
  p_branch_id uuid,
  p_idempotency_key text,
  p_purchase_reference_hash text,
  p_items jsonb,
  p_scan_token_hash text default null,
  p_card_id uuid default null,
  p_nfc_public_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_business public.businesses;
  v_staff public.staff_members;
  v_prev public.ledger_events;
  v_card_id uuid;
  v_card public.loyalty_cards;
  v_customer public.customers;
  v_cv public.campaign_versions;
  v_device public.nfc_devices;
  v_source public.ledger_source;
  v_purchase_id uuid;
  v_event_id uuid;
  v_requested integer;
  v_known integer;
  v_eligible_units integer;
  v_total integer;
  v_min_price integer;
  v_delta integer;
  v_earns_today integer;
  v_issued integer;
  v_wait integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select * into v_branch from public.branches where id = p_branch_id;
  if not found or not private.can_operate_branch(p_branch_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]) then
    return private.reject(v_branch.business_id, 'ledger.earn', 'forbidden', 'branch', p_branch_id::text);
  end if;
  select * into v_business from public.businesses where id = v_branch.business_id;
  select * into v_staff from public.staff_members where business_id = v_business.id and user_id = auth.uid();

  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,100}$'
     or p_purchase_reference_hash is null or p_purchase_reference_hash !~ '^[a-f0-9]{64}$'
     or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30
     or (p_scan_token_hash is null) = (p_card_id is null) then
    return private.reject(v_business.id, 'ledger.earn', 'invalid_request');
  end if;

  -- Reintento idempotente: misma llave => mismo resultado, sin efectos nuevos.
  select * into v_prev from public.ledger_events where business_id = v_business.id and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.event_type <> 'earn' or v_prev.purchase_reference_hash is distinct from p_purchase_reference_hash then
      return private.reject(v_business.id, 'ledger.earn', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id) || private.card_result(v_prev.card_id);
  end if;

  if not private.rate_limit_allow('earn:' || v_staff.id, 60, 600) then
    return private.reject(v_business.id, 'ledger.earn', 'rate_limited');
  end if;

  -- Sello NFC: identificador público, solo indica sucursal. Nunca autoriza por sí mismo.
  if p_nfc_public_id is not null then
    select * into v_device from public.nfc_devices where public_id = p_nfc_public_id and active;
    if not found or v_device.branch_id <> v_branch.id then
      return private.reject(v_business.id, 'ledger.earn', 'nfc_invalid', 'branch', v_branch.id::text);
    end if;
  end if;

  -- Identificación de la tarjeta.
  if p_scan_token_hash is not null then
    update public.scan_tokens
      set consumed_at = now(), consumed_by_staff_id = v_staff.id
      where token_hash = p_scan_token_hash and business_id = v_business.id and purpose = 'identify'
        and consumed_at is null and expires_at > now()
        and (bound_staff_id is null or bound_staff_id = v_staff.id)
        and (bound_branch_id is null or bound_branch_id = v_branch.id)
      returning card_id into v_card_id;
    if v_card_id is null then
      -- Una petición concurrente con la misma llave pudo consumir el código y completar la operación.
      select * into v_prev from public.ledger_events where business_id = v_business.id and idempotency_key = p_idempotency_key;
      if found and v_prev.event_type = 'earn' and v_prev.purchase_reference_hash = p_purchase_reference_hash then
        return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id) || private.card_result(v_prev.card_id);
      end if;
      return private.reject(v_business.id, 'ledger.earn', 'token_invalid');
    end if;
    v_source := case when v_device.id is null then 'staff_qr'::public.ledger_source else 'staff_nfc'::public.ledger_source end;
  else
    -- Acreditar sin QR del cliente requiere rol de gerente o superior.
    if v_staff.role not in ('owner', 'admin', 'manager') then
      return private.reject(v_business.id, 'ledger.earn', 'forbidden', 'card', p_card_id::text);
    end if;
    v_card_id := p_card_id;
    v_source := 'staff_lookup'::public.ledger_source;
  end if;

  select * into v_card from public.loyalty_cards where id = v_card_id and business_id = v_business.id for update;
  if not found then
    return private.reject(v_business.id, 'ledger.earn', 'card_not_found');
  end if;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_customer.status <> 'active' then
    return private.reject(v_business.id, 'ledger.earn', 'card_inactive', 'card', v_card.id::text);
  end if;

  v_cv := private.current_campaign_version(v_business.id);
  if v_cv.id is null then
    return private.reject(v_business.id, 'ledger.earn', 'no_active_campaign');
  end if;

  if exists (select 1 from public.purchases where business_id = v_business.id and reference_hash = p_purchase_reference_hash) then
    return private.reject(v_business.id, 'ledger.earn', 'duplicate_purchase', 'card', v_card.id::text);
  end if;

  -- Partidas: precios y elegibilidad salen del catálogo del servidor.
  -- Valida tipos de las partidas (uuid/entero/booleano) antes de usarlas.
  begin
    perform count(*) from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean);
  exception when others then
    return private.reject(v_business.id, 'ledger.earn', 'invalid_items');
  end;

  select count(*), count(p.id) into v_requested, v_known
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean)
  left join public.products p on p.id = i.product_id and p.business_id = v_business.id and p.active;
  if v_requested <> v_known
     or exists (select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean) where i.quantity is null or i.quantity not between 1 and 20)
     or (select count(distinct i.product_id) from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean)) <> v_requested then
    return private.reject(v_business.id, 'ledger.earn', 'invalid_items');
  end if;

  select
    coalesce(sum(i.quantity) filter (where p.eligible_for_stamp and not coalesce(i.complimentary, false) and p.price_cents > 0), 0),
    coalesce(sum(p.price_cents * i.quantity) filter (where not coalesce(i.complimentary, false)), 0),
    min(p.price_cents) filter (where p.eligible_for_stamp and not coalesce(i.complimentary, false) and p.price_cents > 0)
  into v_eligible_units, v_total, v_min_price
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean)
  join public.products p on p.id = i.product_id;

  if v_eligible_units = 0 then
    return private.reject(v_business.id, 'ledger.earn', 'not_eligible', 'card', v_card.id::text);
  end if;

  -- Frecuencia: espera mínima y máximo diario (día calendario del negocio).
  if v_card.last_earn_at is not null and now() < v_card.last_earn_at + make_interval(secs => v_cv.min_seconds_between_earns) then
    v_wait := ceil(extract(epoch from (v_card.last_earn_at + make_interval(secs => v_cv.min_seconds_between_earns) - now())))::integer;
    return private.reject(v_business.id, 'ledger.earn', 'too_soon', 'card', v_card.id::text,
      jsonb_build_object('retry_after_seconds', v_wait));
  end if;

  select count(*) into v_earns_today
  from public.ledger_events e
  where e.card_id = v_card.id and e.event_type = 'earn'
    and (e.occurred_at at time zone v_business.timezone)::date = (now() at time zone v_business.timezone)::date;
  if v_earns_today >= v_cv.max_earns_per_day then
    return private.reject(v_business.id, 'ledger.earn', 'daily_limit', 'card', v_card.id::text);
  end if;

  begin
    insert into public.purchases (business_id, branch_id, card_id, reference_hash, total_cents, eligible_units,
      min_eligible_price_cents, recorded_by_staff_id)
    values (v_business.id, v_branch.id, v_card.id, p_purchase_reference_hash, v_total, v_eligible_units, v_min_price, v_staff.id)
    returning id into v_purchase_id;
  exception when unique_violation then
    return private.reject(v_business.id, 'ledger.earn', 'duplicate_purchase', 'card', v_card.id::text);
  end;

  insert into public.purchase_items (purchase_id, product_id, product_name, unit_price_cents, quantity, complimentary, counts_for_stamp)
  select v_purchase_id, p.id, p.name, p.price_cents, i.quantity, coalesce(i.complimentary, false),
         p.eligible_for_stamp and not coalesce(i.complimentary, false) and p.price_cents > 0
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer, complimentary boolean) join public.products p on p.id = i.product_id;

  v_delta := least(v_eligible_units, v_cv.stamps_per_purchase);

  insert into public.ledger_events (
    business_id, branch_id, card_id, customer_id, campaign_version_id, event_type, stamps_delta,
    purchase_id, purchase_reference_hash, idempotency_key, source, actor_user_id, actor_staff_id, nfc_device_id, validation
  ) values (
    v_business.id, v_branch.id, v_card.id, v_card.customer_id, v_cv.id, 'earn', v_delta,
    v_purchase_id, p_purchase_reference_hash, p_idempotency_key, v_source, auth.uid(), v_staff.id, v_device.id,
    jsonb_build_object(
      'result', 'accepted',
      'eligible_units', v_eligible_units,
      'min_eligible_price_cents', v_min_price,
      'campaign_version', v_cv.version,
      'identification', case when p_scan_token_hash is null then 'lookup' else 'scan_token' end
    )
  ) returning id into v_event_id;

  update public.loyalty_cards
    set stamps_balance = stamps_balance + v_delta, last_earn_at = now(), version = version + 1
    where id = v_card.id;

  v_issued := private.issue_rewards(v_card.id, v_cv, v_event_id, v_min_price, p_idempotency_key, v_branch.id, v_staff.id, 'system');

  perform private.audit(v_business.id, 'ledger.earn', 'ledger_event', v_event_id::text, 'success',
    jsonb_build_object('card_id', v_card.id, 'branch_id', v_branch.id, 'stamps', v_delta, 'rewards_issued', v_issued, 'source', v_source));

  return jsonb_build_object('ok', true, 'replayed', false, 'event_id', v_event_id, 'stamps_added', v_delta, 'rewards_issued', v_issued)
    || private.card_result(v_card.id);
end;
$$;

create or replace function public.redeem_reward(p_branch_id uuid, p_idempotency_key text, p_scan_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_staff public.staff_members;
  v_prev public.ledger_events;
  v_card_id uuid;
  v_card public.loyalty_cards;
  v_customer public.customers;
  v_reward public.ledger_events;
  v_event_id uuid;
  v_description text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_branch from public.branches where id = p_branch_id;
  if not found or not private.can_operate_branch(p_branch_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]) then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'forbidden', 'branch', p_branch_id::text);
  end if;
  select * into v_staff from public.staff_members where business_id = v_branch.business_id and user_id = auth.uid();

  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,100}$'
     or p_scan_token_hash is null or p_scan_token_hash !~ '^[a-f0-9]{64}$' then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'invalid_request');
  end if;

  select * into v_prev from public.ledger_events where business_id = v_branch.business_id and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.event_type <> 'redeem' then
      return private.reject(v_branch.business_id, 'ledger.redeem', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id,
      'reward_value_cap_cents', v_prev.reward_value_cap_cents) || private.card_result(v_prev.card_id);
  end if;

  if not private.rate_limit_allow('redeem:' || v_staff.id, 30, 600) then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'rate_limited');
  end if;

  update public.scan_tokens
    set consumed_at = now(), consumed_by_staff_id = v_staff.id
    where token_hash = p_scan_token_hash and business_id = v_branch.business_id and purpose = 'redeem'
      and consumed_at is null and expires_at > now()
      and (bound_staff_id is null or bound_staff_id = v_staff.id)
      and (bound_branch_id is null or bound_branch_id = v_branch.id)
    returning card_id into v_card_id;
  if v_card_id is null then
    select * into v_prev from public.ledger_events where business_id = v_branch.business_id and idempotency_key = p_idempotency_key;
    if found and v_prev.event_type = 'redeem' then
      return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id,
        'reward_value_cap_cents', v_prev.reward_value_cap_cents) || private.card_result(v_prev.card_id);
    end if;
    return private.reject(v_branch.business_id, 'ledger.redeem', 'token_invalid');
  end if;

  select * into v_card from public.loyalty_cards where id = v_card_id for update;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_customer.status <> 'active' then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'card_inactive', 'card', v_card.id::text);
  end if;
  if v_card.rewards_balance < 1 then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'no_reward_available', 'card', v_card.id::text);
  end if;

  v_reward := private.next_available_reward(v_card.id);
  if v_reward.id is null then
    perform private.audit(v_branch.business_id, 'ledger.redeem', 'card', v_card.id::text, 'error',
      jsonb_build_object('code', 'projection_mismatch'));
    return jsonb_build_object('ok', false, 'code', 'no_reward_available');
  end if;

  insert into public.ledger_events (
    business_id, branch_id, card_id, customer_id, campaign_version_id, event_type, rewards_delta,
    related_event_id, reward_value_cap_cents, idempotency_key, source, actor_user_id, actor_staff_id, validation
  ) values (
    v_card.business_id, v_branch.id, v_card.id, v_card.customer_id, v_reward.campaign_version_id, 'redeem', -1,
    v_reward.id, v_reward.reward_value_cap_cents, p_idempotency_key, 'staff_qr', auth.uid(), v_staff.id,
    jsonb_build_object('result', 'accepted', 'customer_confirmation', 'redeem_token')
  ) returning id into v_event_id;

  update public.loyalty_cards set rewards_balance = rewards_balance - 1, version = version + 1 where id = v_card.id;

  select cv.reward_description into v_description from public.campaign_versions cv where cv.id = v_reward.campaign_version_id;

  perform private.audit(v_branch.business_id, 'ledger.redeem', 'ledger_event', v_event_id::text, 'success',
    jsonb_build_object('card_id', v_card.id, 'branch_id', v_branch.id, 'reward_event_id', v_reward.id));

  return jsonb_build_object('ok', true, 'replayed', false, 'event_id', v_event_id,
    'reward_value_cap_cents', v_reward.reward_value_cap_cents, 'reward_description', v_description)
    || private.card_result(v_card.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Estado en vivo para el cliente
-- ---------------------------------------------------------------------
create or replace function public.my_card_status(p_card_id uuid, p_token_hash text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_card public.loyalty_cards;
  v_token public.scan_tokens;
  v_last public.ledger_events;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.owns_card(p_card_id) then
    return jsonb_build_object('ok', false, 'code', 'card_not_found');
  end if;
  select * into v_card from public.loyalty_cards where id = p_card_id;
  select * into v_last from public.ledger_events where card_id = p_card_id order by occurred_at desc, id desc limit 1;
  if p_token_hash is not null and p_token_hash ~ '^[a-f0-9]{64}$' then
    select * into v_token from public.scan_tokens where token_hash = p_token_hash and card_id = p_card_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'version', v_card.version,
    'stamps_balance', v_card.stamps_balance,
    'rewards_balance', v_card.rewards_balance,
    'token_state', case
      when v_token.id is null then 'unknown'
      when v_token.consumed_at is not null then 'scanned'
      when v_token.expires_at <= now() then 'expired'
      else 'active' end,
    'last_event', case when v_last.id is null then null else jsonb_build_object(
      'event_type', v_last.event_type, 'stamps_delta', v_last.stamps_delta, 'rewards_delta', v_last.rewards_delta,
      'occurred_at', v_last.occurred_at) end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Catálogo de barra por popularidad (últimos 30 días)
-- ---------------------------------------------------------------------
create or replace function public.staff_catalog(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if private.staff_role_in(p_business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'category', p.category, 'price_cents', p.price_cents,
      'eligible', p.eligible_for_stamp, 'sold_30d', coalesce(s.qty, 0)
    ) order by p.eligible_for_stamp desc, coalesce(s.qty, 0) desc, p.name)
    from public.products p
    left join (
      select pi.product_id, sum(pi.quantity) as qty
      from public.purchase_items pi join public.purchases pu on pu.id = pi.purchase_id
      where pu.business_id = p_business_id and pu.created_at >= now() - interval '30 days' and pu.status = 'completed'
      group by pi.product_id
    ) s on s.product_id = p.id
    where p.business_id = p_business_id and p.active
  ), '[]'::jsonb));
end;
$$;

revoke execute on function
  public.staff_claim_card(uuid, text, text), public.staff_release_hold(text),
  public.my_card_status(uuid, text), public.staff_catalog(uuid)
from public, anon;
grant execute on function
  public.staff_claim_card(uuid, text, text), public.staff_release_hold(text),
  public.my_card_status(uuid, text), public.staff_catalog(uuid)
to authenticated;
-- record_earn y redeem_reward conservan su firma y sus privilegios.
