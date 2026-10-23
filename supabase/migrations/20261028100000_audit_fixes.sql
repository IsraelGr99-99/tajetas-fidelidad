-- =====================================================================
-- Correcciones de la auditoría de seguridad independiente (2026-10-28).
-- M1 auto-acreditación del personal · M2 baja de cuenta y Wallet ·
-- M4 MFA para owner/admin · B1 auditoría acotada · B2 carreras de "último" ·
-- B4 emisión masiva de recompensas · B5 sucursal demo · B8 reverso de ajuste ·
-- I2/I3 lectura de campañas y tarjetas · I4 función obsoleta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- M4. MFA: si owner/admin tiene un factor TOTP verificado, sus permisos de
-- administración exigen una sesión aal2. (Obligatorio para todos: ver docs.)
-- ---------------------------------------------------------------------
create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function private.staff_role_in(p_business_id uuid)
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.staff_members sm
  where sm.user_id = auth.uid() and sm.business_id = p_business_id and sm.active
    and (sm.role not in ('owner', 'admin') or private.mfa_satisfied())
$$;

create or replace function private.can_operate_branch(p_branch_id uuid, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.branches b
    join public.staff_members sm on sm.business_id = b.business_id and sm.user_id = auth.uid() and sm.active
    where b.id = p_branch_id
      and b.active
      and sm.role = any (p_roles)
      and (sm.role not in ('owner', 'admin') or private.mfa_satisfied())
      and (
        sm.role in ('owner', 'admin')
        or exists (select 1 from public.staff_branch_access a where a.staff_member_id = sm.id and a.branch_id = b.id)
      )
  )
$$;

revoke execute on function private.mfa_satisfied() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- B1. Los rechazos solo se registran en la bitácora de una empresa si quien
-- llama pertenece a ella (personal o cliente), y con límite por usuario.
-- ---------------------------------------------------------------------
create or replace function private.reject(
  p_business_id uuid,
  p_action text,
  p_code text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_scope uuid := p_business_id;
begin
  if p_business_id is not null and v_uid is not null
     and not exists (select 1 from public.staff_members where user_id = v_uid and business_id = p_business_id)
     and not exists (select 1 from public.customers where auth_user_id = v_uid and business_id = p_business_id) then
    v_scope := null;
  end if;
  if v_uid is null or private.rate_limit_allow('audit_rejections:' || v_uid, 60, 600) then
    perform private.audit(
      v_scope, p_action, p_entity_type, p_entity_id,
      case when p_code in ('forbidden', 'not_authenticated') then 'denied' else 'rejected' end,
      coalesce(p_details, '{}'::jsonb) || jsonb_build_object('code', p_code)
    );
  end if;
  return jsonb_build_object('ok', false, 'code', p_code) || coalesce(p_details, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- I2/I3. Campañas: solo personal o clientes de esa empresa. Tarjetas: dueño o
-- administración (los gerentes ven tarjetas a través de RPC por sucursal).
-- ---------------------------------------------------------------------
drop policy campaigns_read_members on public.campaigns;
drop policy campaign_versions_read on public.campaign_versions;
create policy campaigns_read_business on public.campaigns for select to authenticated
  using (
    private.staff_role_in(business_id) is not null
    or exists (select 1 from public.customers c where c.business_id = campaigns.business_id and c.auth_user_id = (select auth.uid()))
  );
create policy campaign_versions_read_business on public.campaign_versions for select to authenticated
  using (
    private.staff_role_in(business_id) is not null
    or exists (select 1 from public.customers c where c.business_id = campaign_versions.business_id and c.auth_user_id = (select auth.uid()))
  );

drop policy cards_read_owner_or_staff on public.loyalty_cards;
create policy cards_read_owner_or_admin on public.loyalty_cards for select to authenticated
  using (private.owns_card(id) or private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

-- I4. La consulta sin consumo quedó obsoleta (la barra usa staff_claim_card).
revoke execute on function public.staff_lookup_card(uuid, text) from authenticated;

-- ---------------------------------------------------------------------
-- Funciones actualizadas (copias de la versión vigente con cambios marcados)
-- ---------------------------------------------------------------------


-- M1
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
  if v_customer.auth_user_id = auth.uid() then
    return private.reject(v_branch.business_id, 'card.claim', 'self_service_forbidden', 'card', v_card.id::text);
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

-- M1
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
  if v_customer.auth_user_id = auth.uid() then
    return private.reject(v_business.id, 'ledger.earn', 'self_service_forbidden', 'card', v_card.id::text);
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

-- M1
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
  if v_customer.auth_user_id = auth.uid() then
    return private.reject(v_branch.business_id, 'ledger.redeem', 'self_service_forbidden', 'card', v_card.id::text);
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

-- B4
create or replace function private.issue_rewards(
  p_card_id uuid,
  p_cv public.campaign_versions,
  p_trigger_event_id uuid,
  p_min_eligible_price_cents integer,
  p_idempotency_base text,
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_source public.ledger_source
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.loyalty_cards;
  v_issued integer := 0;
  v_cap integer;
  v_base_price integer;
begin
  select * into v_card from public.loyalty_cards where id = p_card_id for update;

  -- B4: como máximo una recompensa por evento; el excedente se emite en el siguiente.
  while v_card.stamps_balance >= p_cv.stamps_required and v_issued < 1 loop
    if p_cv.reward_cap_kind = 'fixed' then
      v_cap := p_cv.reward_cap_max_cents;
    else
      -- Ticket que completó el ciclo; si no hay ticket (ajuste manual), la bebida elegible activa más económica.
      v_base_price := coalesce(
        p_min_eligible_price_cents,
        (select min(p.price_cents) from public.products p
          where p.business_id = v_card.business_id and p.active and p.eligible_for_stamp and p.price_cents > 0)
      );
      v_cap := case
        when v_base_price is null then p_cv.reward_cap_max_cents
        when p_cv.reward_cap_max_cents is null then v_base_price
        else least(v_base_price, p_cv.reward_cap_max_cents)
      end;
      v_cap := coalesce(v_cap, 0);
    end if;

    insert into public.ledger_events (
      business_id, branch_id, card_id, customer_id, campaign_version_id, event_type,
      stamps_delta, rewards_delta, related_event_id, reward_value_cap_cents,
      idempotency_key, source, actor_user_id, actor_staff_id, validation
    ) values (
      v_card.business_id, p_branch_id, v_card.id, v_card.customer_id, p_cv.id, 'reward_issued',
      -p_cv.stamps_required, 1, p_trigger_event_id, v_cap,
      left(p_idempotency_base, 110) || ':rw' || v_issued, p_source, auth.uid(), p_actor_staff_id,
      jsonb_build_object('cap_kind', p_cv.reward_cap_kind, 'cap_base_price_cents', v_base_price)
    );

    update public.loyalty_cards
      set stamps_balance = stamps_balance - p_cv.stamps_required,
          rewards_balance = rewards_balance + 1,
          version = version + 1
      where id = v_card.id
      returning * into v_card;
    v_issued := v_issued + 1;
  end loop;

  return v_issued;
end;
$$;

-- B8
create or replace function public.reverse_ledger_event(
  p_event_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_purchase_status public.purchase_status default 'voided'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.ledger_events;
  v_prev public.ledger_events;
  v_card public.loyalty_cards;
  v_reward public.ledger_events;
  v_staff public.staff_members;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_reverse_id uuid;
  v_allowed boolean;
  v_cv public.campaign_versions;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select * into v_event from public.ledger_events where id = p_event_id;
  -- Sin rol en la empresa del evento => "no encontrado" (no revela existencia: anti-IDOR).
  if not found or private.staff_role_in(v_event.business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_allowed := private.has_role(v_event.business_id, array['owner', 'admin']::public.staff_role[])
    or (v_event.branch_id is not null and private.can_operate_branch(v_event.branch_id, array['manager']::public.staff_role[]));
  if not v_allowed then
    return private.reject(v_event.business_id, 'ledger.reverse', 'forbidden', 'ledger_event', p_event_id::text);
  end if;
  select * into v_staff from public.staff_members where business_id = v_event.business_id and user_id = auth.uid();

  if length(v_reason) not between 5 and 300 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,100}$'
     or p_purchase_status = 'completed' then
    return private.reject(v_event.business_id, 'ledger.reverse', 'invalid_request');
  end if;

  select * into v_prev from public.ledger_events where business_id = v_event.business_id and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.event_type = 'reverse' and v_prev.related_event_id = p_event_id then
      return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id) || private.card_result(v_prev.card_id);
    end if;
    return private.reject(v_event.business_id, 'ledger.reverse', 'idempotency_conflict');
  end if;

  if v_event.event_type not in ('earn', 'redeem', 'manual_adjustment') then
    return private.reject(v_event.business_id, 'ledger.reverse', 'not_reversible', 'ledger_event', p_event_id::text);
  end if;

  select * into v_card from public.loyalty_cards where id = v_event.card_id for update;

  if exists (select 1 from public.ledger_events where related_event_id = v_event.id and event_type = 'reverse') then
    return private.reject(v_event.business_id, 'ledger.reverse', 'already_reversed', 'ledger_event', p_event_id::text);
  end if;

  if v_event.event_type in ('earn', 'manual_adjustment') and v_event.stamps_delta > 0
     and v_card.stamps_balance < v_event.stamps_delta then
    -- Los sellos ya se convirtieron en recompensa: se anula una recompensa no canjeada.
    v_reward := private.next_available_reward(v_card.id);
    if v_reward.id is null then
      return private.reject(v_event.business_id, 'ledger.reverse', 'requires_manual_review', 'ledger_event', p_event_id::text);
    end if;
    insert into public.ledger_events (
      business_id, branch_id, card_id, customer_id, campaign_version_id, event_type, stamps_delta, rewards_delta,
      related_event_id, idempotency_key, source, actor_user_id, actor_staff_id, reason, validation
    ) values (
      v_card.business_id, v_event.branch_id, v_card.id, v_card.customer_id, v_reward.campaign_version_id, 'reverse',
      -v_reward.stamps_delta, -1, v_reward.id, left(p_idempotency_key, 110) || ':rw', 'admin_console', auth.uid(), v_staff.id,
      v_reason, jsonb_build_object('cascade_from', p_event_id)
    );
    update public.loyalty_cards
      set stamps_balance = stamps_balance - v_reward.stamps_delta, rewards_balance = rewards_balance - 1, version = version + 1
      where id = v_card.id returning * into v_card;
  end if;

  insert into public.ledger_events (
    business_id, branch_id, card_id, customer_id, campaign_version_id, event_type, stamps_delta, rewards_delta,
    related_event_id, purchase_id, purchase_reference_hash, idempotency_key, source, actor_user_id, actor_staff_id, reason, validation
  ) values (
    v_card.business_id, v_event.branch_id, v_card.id, v_card.customer_id, v_event.campaign_version_id, 'reverse',
    -v_event.stamps_delta, -v_event.rewards_delta, v_event.id, v_event.purchase_id, v_event.purchase_reference_hash,
    p_idempotency_key, 'admin_console', auth.uid(), v_staff.id, v_reason,
    jsonb_build_object('reversed_type', v_event.event_type)
  ) returning id into v_reverse_id;

  update public.loyalty_cards
    set stamps_balance = stamps_balance - v_event.stamps_delta,
        rewards_balance = rewards_balance - v_event.rewards_delta,
        version = version + 1
    where id = v_card.id;

  if v_event.event_type = 'earn' then
    update public.purchases set status = p_purchase_status, status_reason = v_reason where id = v_event.purchase_id;
  end if;

  -- B8: revertir un descuento manual devuelve sellos; si completan el ciclo, se emite la recompensa.
  if v_event.event_type = 'manual_adjustment' and v_event.stamps_delta < 0 then
    v_cv := private.current_campaign_version(v_card.business_id);
    if v_cv.id is not null then
      perform private.issue_rewards(v_card.id, v_cv, v_reverse_id, null, p_idempotency_key, v_event.branch_id, v_staff.id, 'system');
    end if;
  end if;

  perform private.audit(v_event.business_id, 'ledger.reverse', 'ledger_event', v_reverse_id::text, 'success',
    jsonb_build_object('reversed_event_id', v_event.id, 'reversed_type', v_event.event_type, 'reason', v_reason));

  return jsonb_build_object('ok', true, 'replayed', false, 'event_id', v_reverse_id) || private.card_result(v_card.id);
end;
$$;

-- M2
create or replace function public.delete_my_customer_data(p_business_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select cu.* into v_customer
  from public.customers cu join public.businesses b on b.id = cu.business_id
  where b.slug = p_business_slug and cu.auth_user_id = auth.uid() and cu.status = 'active'
  for update of cu;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_enrolled');
  end if;

  update public.customers
    set status = 'deleted', contact_email = null, contact_phone = null, display_name = null,
        deleted_at = now(), auth_user_id = null
    where id = v_customer.id;
  update public.loyalty_cards set version = version + 1 where customer_id = v_customer.id;
  delete from public.scan_tokens where card_id = (select id from public.loyalty_cards where customer_id = v_customer.id);

  perform private.audit(v_customer.business_id, 'customer.delete', 'customer', v_customer.id::text, 'success',
    jsonb_build_object('requested_by', 'customer'));
  return jsonb_build_object('ok', true, 'is_staff', exists (select 1 from public.staff_members where user_id = auth.uid()));
end;
$$;

-- B2
create or replace function public.update_staff_member(
  p_staff_member_id uuid,
  p_role public.staff_role,
  p_active boolean,
  p_branch_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.staff_members;
  v_before jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_target from public.staff_members where id = p_staff_member_id for update;
  if not found or private.staff_role_in(v_target.business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.user_id = auth.uid() then
    return private.reject(v_target.business_id, 'staff.update', 'cannot_modify_self', 'staff_member', p_staff_member_id::text);
  end if;
  if not private.is_admin(v_target.business_id)
     or not private.can_manage_role(v_target.business_id, v_target.role)
     or not private.can_manage_role(v_target.business_id, p_role) then
    return private.reject(v_target.business_id, 'staff.update', 'forbidden', 'staff_member', p_staff_member_id::text);
  end if;
  if not private.branches_belong(v_target.business_id, p_branch_ids) then
    return private.reject(v_target.business_id, 'staff.update', 'invalid_request');
  end if;
  if p_role in ('manager', 'barista') and coalesce(p_active, true) and coalesce(cardinality(p_branch_ids), 0) = 0 then
    return private.reject(v_target.business_id, 'staff.update', 'branch_required');
  end if;
  -- B2: bloquear a todos los owners activos antes de contar, para evitar carreras.
  perform 1 from public.staff_members where business_id = v_target.business_id and role = 'owner' and active for update;
  if v_target.role = 'owner' and v_target.active and (p_role <> 'owner' or not coalesce(p_active, true))
     and not exists (select 1 from public.staff_members where business_id = v_target.business_id and role = 'owner' and active and id <> v_target.id) then
    return private.reject(v_target.business_id, 'staff.update', 'last_owner');
  end if;

  v_before := jsonb_build_object('role', v_target.role, 'active', v_target.active,
    'branches', (select coalesce(jsonb_agg(branch_id), '[]'::jsonb) from public.staff_branch_access where staff_member_id = v_target.id));

  update public.staff_members set role = p_role, active = coalesce(p_active, true) where id = v_target.id;
  delete from public.staff_branch_access where staff_member_id = v_target.id;
  if p_role in ('manager', 'barista') then
    insert into public.staff_branch_access (staff_member_id, branch_id, business_id)
    select v_target.id, b, v_target.business_id from unnest(coalesce(p_branch_ids, '{}')) b
    on conflict do nothing;
  end if;

  perform private.audit(v_target.business_id, 'staff.update', 'staff_member', v_target.id::text, 'success',
    jsonb_build_object('before', v_before, 'after', jsonb_build_object('role', p_role, 'active', coalesce(p_active, true),
      'branches', to_jsonb(coalesce(p_branch_ids, '{}')))));
  return jsonb_build_object('ok', true);
end;
$$;

-- B2/B5
create or replace function public.upsert_branch(
  p_business_id uuid,
  p_branch_id uuid,
  p_slug text,
  p_name text,
  p_address text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.branches;
  v_after public.branches;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'branch.upsert', 'forbidden');
  end if;

  if p_branch_id is not null then
    -- B2: bloquear las sucursales activas antes de contar.
    perform 1 from public.branches where business_id = p_business_id and active for update;
    select * into v_before from public.branches where id = p_branch_id and business_id = p_business_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    -- B5: la sucursal de demostración no se puede activar para operar.
    if v_before.is_demo and coalesce(p_active, true) then
      return private.reject(p_business_id, 'branch.upsert', 'demo_branch_locked');
    end if;
    if v_before.active and not coalesce(p_active, true)
       and not exists (select 1 from public.branches where business_id = p_business_id and active and id <> p_branch_id) then
      return private.reject(p_business_id, 'branch.upsert', 'last_active_branch');
    end if;
  end if;

  begin
    if p_branch_id is null then
      insert into public.branches (business_id, slug, name, address, active)
      values (p_business_id, p_slug, btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''), coalesce(p_active, true))
      returning * into v_after;
    else
      update public.branches
        set name = btrim(p_name), address = nullif(btrim(coalesce(p_address, '')), ''), active = coalesce(p_active, true)
        where id = p_branch_id
        returning * into v_after;
    end if;
  exception
    when unique_violation then
      return private.reject(p_business_id, 'branch.upsert', 'duplicate_name');
    when check_violation or not_null_violation then
      return private.reject(p_business_id, 'branch.upsert', 'invalid_request');
  end;

  perform private.audit(p_business_id, 'branch.upsert', 'branch', v_after.id::text, 'success',
    jsonb_build_object('before', case when v_before.id is null then null else to_jsonb(v_before) end, 'after', to_jsonb(v_after)));
  return jsonb_build_object('ok', true, 'branch_id', v_after.id);
end;
$$;

-- B5
create or replace function public.generate_demo_finance(p_business_id uuid, p_days integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch record;
  v_demo_branch uuid;
  v_import uuid;
  v_days integer := least(greatest(coalesce(p_days, 60), 7), 180);
  v_start date;
  v_slug text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'demo.generate', 'forbidden');
  end if;
  if exists (select 1 from public.sales_imports where business_id = p_business_id and is_demo)
     or exists (select 1 from public.expenses where business_id = p_business_id and is_demo) then
    return jsonb_build_object('ok', false, 'code', 'demo_exists');
  end if;
  if not exists (select 1 from public.products where business_id = p_business_id and active and price_cents > 0) then
    return jsonb_build_object('ok', false, 'code', 'catalog_empty');
  end if;

  v_start := (now() at time zone 'America/Mexico_City')::date - (v_days - 1);

  -- Sucursal de comparación, inactiva para operar y marcada como demo.
  v_slug := 'demo-angelopolis';
  select id into v_demo_branch from public.branches where business_id = p_business_id and slug = v_slug;
  if v_demo_branch is null then
    insert into public.branches (business_id, slug, name, address, active, is_demo)
    values (p_business_id, v_slug, 'Angelópolis (DEMO)', 'Sucursal ficticia para la demostración', false, true)
    returning id into v_demo_branch;
  end if;

  for v_branch in
    select b.id, b.is_demo from public.branches b
    where b.business_id = p_business_id and (b.active or b.id = v_demo_branch)
  loop
    insert into public.sales_imports (business_id, branch_id, file_name, row_count, total_cents, period_start, period_end, is_demo, imported_by)
    values (p_business_id, v_branch.id, 'Datos de demostración', 1, 0, v_start, v_start + (v_days - 1), true, auth.uid())
    returning id into v_import;

    -- Ventas diarias por producto: más los fines de semana; la sucursal demo vende ~35 % menos.
    insert into public.sales_lines (import_id, business_id, branch_id, sold_on, product_id, product_name, category, quantity, total_cents, unit_cost_cents, is_demo)
    select v_import, p_business_id, v_branch.id, d::date, p.id, p.name, p.category, q.qty,
           q.qty * p.price_cents, coalesce(p.cost_cents, round(p.price_cents * 0.32)::integer), true
    from generate_series(v_start, v_start + (v_days - 1), interval '1 day') d
    cross join public.products p
    cross join lateral (
      select greatest(1, round(
        (case when p.eligible_for_stamp then 9 else 5 end)
        * (case when extract(isodow from d) in (6, 7) then 1.45 else 1 end)
        * (case when v_branch.is_demo then 0.65 else 1 end)
        * (0.6 + random() * 0.8)
      ))::numeric as qty
    ) q
    where p.business_id = p_business_id and p.active and p.price_cents > 0;

    update public.sales_imports si
      set row_count = s.n, total_cents = s.total
      from (select count(*) n, sum(total_cents) total from public.sales_lines where import_id = v_import) s
      where si.id = v_import;

    -- Gastos mensuales típicos y compras de insumos semanales.
    insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo, created_by)
    select p_business_id, v_branch.id, m::date, g.category, g.description,
           round(g.amount * (case when v_branch.is_demo then 0.8 else 1 end))::bigint, true, auth.uid()
    from generate_series(date_trunc('month', v_start::timestamp), v_start + (v_days - 1), interval '1 month') m
    cross join (values ('Renta', 'Renta del local', 1800000), ('Nómina', 'Sueldos del personal', 3200000),
                       ('Servicios', 'Luz, agua, gas e internet', 450000)) as g(category, description, amount)
    where m::date >= v_start;

    insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo, created_by)
    select p_business_id, v_branch.id, w::date, 'Insumos', 'Café de origen, leche y panadería',
           round((380000 + random() * 120000) * (case when v_branch.is_demo then 0.7 else 1 end))::bigint, true, auth.uid()
    from generate_series(v_start, v_start + (v_days - 1), interval '7 days') w;
  end loop;

  perform private.audit(p_business_id, 'demo.generate', null, null, 'success', jsonb_build_object('days', v_days));
  return jsonb_build_object('ok', true, 'days', v_days);
end;
$$;

-- M4
create or replace function public.get_staff_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  return jsonb_build_object(
    'ok', true,
    'memberships', coalesce((
      select jsonb_agg(m order by m.business_name)
      from (
        select
          sm.id as staff_member_id,
          sm.display_name,
          sm.role,
          (sm.role in ('owner', 'admin') and not private.mfa_satisfied()) as mfa_pending,
          b.id as business_id,
          b.slug as business_slug,
          b.name as business_name,
          b.is_demo,
          coalesce((
            select jsonb_agg(jsonb_build_object('id', br.id, 'slug', br.slug, 'name', br.name) order by br.name)
            from public.branches br
            where br.business_id = b.id
              and br.active
              and (
                sm.role in ('owner', 'admin')
                or exists (select 1 from public.staff_branch_access a where a.staff_member_id = sm.id and a.branch_id = br.id)
              )
          ), '[]'::jsonb) as branches
        from public.staff_members sm
        join public.businesses b on b.id = sm.business_id
        where sm.user_id = v_uid and sm.active
      ) m
    ), '[]'::jsonb)
  );
end;
$$;
