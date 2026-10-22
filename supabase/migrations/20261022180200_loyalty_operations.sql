-- =====================================================================
-- Operaciones de fidelidad (única vía de escritura).
-- Todas devuelven jsonb {ok: true, ...} o {ok: false, code: '...'}.
-- Los rechazos de negocio NO lanzan excepción: así queda auditado el intento.
-- Concurrencia: cada operación bloquea la fila de la tarjeta (FOR UPDATE),
-- de modo que acreditaciones y canjes sobre la misma tarjeta se serializan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers internos
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
begin
  perform private.audit(
    p_business_id, p_action, p_entity_type, p_entity_id,
    case when p_code in ('forbidden', 'not_authenticated') then 'denied' else 'rejected' end,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object('code', p_code)
  );
  return jsonb_build_object('ok', false, 'code', p_code) || coalesce(p_details, '{}'::jsonb);
end;
$$;

create or replace function private.current_campaign_version(p_business_id uuid)
returns public.campaign_versions
language sql
stable
security definer
set search_path = ''
as $$
  select cv.*
  from public.campaigns c
  join public.campaign_versions cv on cv.campaign_id = c.id
  where c.business_id = p_business_id and c.is_active and cv.effective_from <= now()
  order by cv.version desc
  limit 1
$$;

create or replace function private.card_result(p_card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'card_id', c.id,
    'stamps_balance', c.stamps_balance,
    'rewards_balance', c.rewards_balance,
    'stamps_required', (private.current_campaign_version(c.business_id)).stamps_required
  )
  from public.loyalty_cards c
  where c.id = p_card_id
$$;

create or replace function private.mask_contact(p_customer public.customers)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_customer.contact_channel = 'phone' and p_customer.contact_phone is not null
      then '•••• ' || right(p_customer.contact_phone, 4)
    when p_customer.contact_email is not null
      then left(p_customer.contact_email, 1) || '•••@' || split_part(p_customer.contact_email, '@', 2)
    else null
  end
$$;

-- Recompensas disponibles: emitidas, no revertidas y sin canje vigente (canje no revertido).
create or replace function private.next_available_reward(p_card_id uuid)
returns public.ledger_events
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.ledger_events r
  where r.card_id = p_card_id
    and r.event_type = 'reward_issued'
    and not exists (select 1 from public.ledger_events x where x.related_event_id = r.id and x.event_type = 'reverse')
    and not exists (
      select 1 from public.ledger_events d
      where d.related_event_id = r.id and d.event_type = 'redeem'
        and not exists (select 1 from public.ledger_events z where z.related_event_id = d.id and z.event_type = 'reverse')
    )
  order by r.occurred_at, r.id
  limit 1
$$;

-- Convierte sellos en recompensas mientras el saldo alcance el ciclo. Requiere la tarjeta bloqueada.
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

  while v_card.stamps_balance >= p_cv.stamps_required loop
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

-- Comprueba que la proyección coincide con el ledger (para monitoreo y pruebas).
create or replace function private.verify_card_projection(p_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select c.stamps_balance = coalesce(sum(e.stamps_delta), 0)
     and c.rewards_balance = coalesce(sum(e.rewards_delta), 0)
  from public.loyalty_cards c
  left join public.ledger_events e on e.card_id = c.id
  where c.id = p_card_id
  group by c.id
$$;

-- ---------------------------------------------------------------------
-- Cliente: alta con el canal verificado por Supabase Auth
-- ---------------------------------------------------------------------
create or replace function public.enroll_customer(p_business_slug text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_business public.businesses;
  v_customer public.customers;
  v_card public.loyalty_cards;
  v_email text;
  v_phone text;
  v_email_confirmed timestamptz;
  v_phone_confirmed timestamptz;
  v_name text := nullif(btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]<>]', '', 'g')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select * into v_business from public.businesses where slug = p_business_slug;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'business_not_found');
  end if;

  if not private.rate_limit_allow('enroll:' || v_uid, 10, 3600) then
    return private.reject(v_business.id, 'customer.enroll', 'rate_limited');
  end if;

  select * into v_customer from public.customers where business_id = v_business.id and auth_user_id = v_uid;
  if found then
    select * into v_card from public.loyalty_cards where customer_id = v_customer.id;
    return jsonb_build_object('ok', true, 'already_enrolled', true) || private.card_result(v_card.id);
  end if;

  if v_name is not null and length(v_name) > 40 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- El canal de contacto proviene de Auth (verificado), nunca del navegador.
  select lower(u.email), u.phone, u.email_confirmed_at, u.phone_confirmed_at
    into v_email, v_phone, v_email_confirmed, v_phone_confirmed
  from auth.users u where u.id = v_uid;

  begin
    if v_email is not null and v_email <> '' and v_email_confirmed is not null then
      insert into public.customers (business_id, auth_user_id, contact_channel, contact_email, display_name, verified_at)
      values (v_business.id, v_uid, 'email', v_email, v_name, v_email_confirmed)
      returning * into v_customer;
    elsif v_phone is not null and v_phone <> '' and v_phone_confirmed is not null then
      insert into public.customers (business_id, auth_user_id, contact_channel, contact_phone, display_name, verified_at)
      values (v_business.id, v_uid, 'phone', '+' || regexp_replace(v_phone, '\D', '', 'g'), v_name, v_phone_confirmed)
      returning * into v_customer;
    else
      return private.reject(v_business.id, 'customer.enroll', 'contact_not_verified');
    end if;
  exception when unique_violation then
    return private.reject(v_business.id, 'customer.enroll', 'contact_already_enrolled');
  end;

  insert into public.loyalty_cards (business_id, customer_id) values (v_business.id, v_customer.id)
  returning * into v_card;

  perform private.audit(v_business.id, 'customer.enroll', 'customer', v_customer.id::text, 'success',
    jsonb_build_object('channel', v_customer.contact_channel));
  return jsonb_build_object('ok', true, 'already_enrolled', false) || private.card_result(v_card.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente: tarjeta, progreso e historial (sin actores ni hashes)
-- ---------------------------------------------------------------------
create or replace function public.get_my_card(p_business_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.loyalty_cards;
  v_customer public.customers;
  v_cv public.campaign_versions;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select cu.* into v_customer
  from public.customers cu join public.businesses b on b.id = cu.business_id
  where b.slug = p_business_slug and cu.auth_user_id = v_uid and cu.status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_enrolled');
  end if;

  select * into v_card from public.loyalty_cards where customer_id = v_customer.id;
  v_cv := private.current_campaign_version(v_card.business_id);

  return jsonb_build_object(
    'ok', true,
    'card', jsonb_build_object(
      'id', v_card.id,
      'public_serial', v_card.public_serial,
      'stamps_balance', v_card.stamps_balance,
      'rewards_balance', v_card.rewards_balance
    ),
    'customer', jsonb_build_object(
      'display_name', v_customer.display_name,
      'contact_channel', v_customer.contact_channel,
      'contact_masked', private.mask_contact(v_customer)
    ),
    'campaign', case when v_cv.id is null then null else jsonb_build_object(
      'name', v_cv.name,
      'version', v_cv.version,
      'stamps_required', v_cv.stamps_required,
      'reward_description', v_cv.reward_description,
      'reward_cap_kind', v_cv.reward_cap_kind,
      'reward_cap_max_cents', v_cv.reward_cap_max_cents
    ) end,
    'history', coalesce((
      select jsonb_agg(h order by h.occurred_at desc)
      from (
        select e.id, e.event_type, e.stamps_delta, e.rewards_delta, e.occurred_at, br.name as branch_name,
               e.reward_value_cap_cents
        from public.ledger_events e
        left join public.branches br on br.id = e.branch_id
        where e.card_id = v_card.id
        order by e.occurred_at desc
        limit 50
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente: registra un código QR temporal. El servidor de la app genera el
-- token aleatorio, entrega el token al navegador y aquí solo guarda su hash.
-- ---------------------------------------------------------------------
create or replace function public.issue_scan_token(
  p_card_id uuid,
  p_purpose public.scan_token_purpose,
  p_token_hash text,
  p_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.loyalty_cards;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  -- Misma respuesta si la tarjeta no existe o no es propia (evita enumeración).
  if not private.owns_card(p_card_id) then
    return jsonb_build_object('ok', false, 'code', 'card_not_found');
  end if;
  select * into v_card from public.loyalty_cards where id = p_card_id;

  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_ttl_seconds not between 30 and 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if not private.rate_limit_allow('scan_token:' || auth.uid(), 30, 600) then
    return private.reject(v_card.business_id, 'scan_token.issue', 'rate_limited', 'card', v_card.id::text);
  end if;
  if p_purpose = 'redeem' and v_card.rewards_balance < 1 then
    return jsonb_build_object('ok', false, 'code', 'no_reward_available');
  end if;

  v_expires := now() + make_interval(secs => p_ttl_seconds);
  insert into public.scan_tokens (business_id, card_id, purpose, token_hash, expires_at)
  values (v_card.business_id, v_card.id, p_purpose, p_token_hash, v_expires);

  return jsonb_build_object('ok', true, 'expires_at', v_expires, 'purpose', p_purpose);
end;
$$;

-- ---------------------------------------------------------------------
-- Personal: identifica la tarjeta por QR (no consume el código).
-- Devuelve solo datos mínimos y enmascarados.
-- ---------------------------------------------------------------------
create or replace function public.staff_lookup_card(p_branch_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_token public.scan_tokens;
  v_card public.loyalty_cards;
  v_customer public.customers;
  v_cv public.campaign_versions;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_branch from public.branches where id = p_branch_id;
  if not found or not private.can_operate_branch(p_branch_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]) then
    return private.reject(v_branch.business_id, 'card.lookup', 'forbidden', 'branch', p_branch_id::text);
  end if;
  if not private.rate_limit_allow('lookup:' || auth.uid(), 120, 600) then
    return private.reject(v_branch.business_id, 'card.lookup', 'rate_limited');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return private.reject(v_branch.business_id, 'card.lookup', 'token_invalid');
  end if;

  select * into v_token from public.scan_tokens
  where token_hash = p_token_hash and business_id = v_branch.business_id and consumed_at is null and expires_at > now();
  if not found then
    return private.reject(v_branch.business_id, 'card.lookup', 'token_invalid');
  end if;

  select * into v_card from public.loyalty_cards where id = v_token.card_id;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_customer.status <> 'active' then
    return private.reject(v_branch.business_id, 'card.lookup', 'card_inactive', 'card', v_card.id::text);
  end if;
  v_cv := private.current_campaign_version(v_branch.business_id);

  perform private.audit(v_branch.business_id, 'card.lookup', 'card', v_card.id::text, 'success',
    jsonb_build_object('branch_id', p_branch_id, 'purpose', v_token.purpose));

  return jsonb_build_object(
    'ok', true,
    'purpose', v_token.purpose,
    'expires_at', v_token.expires_at,
    'card_id', v_card.id,
    'display_name', v_customer.display_name,
    'contact_masked', private.mask_contact(v_customer),
    'stamps_balance', v_card.stamps_balance,
    'rewards_balance', v_card.rewards_balance,
    'stamps_required', v_cv.stamps_required
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Personal: acredita una compra elegible
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
      returning card_id into v_card_id;
    if v_card_id is null then
      -- Una petición concurrente con la misma llave pudo consumir el código y completar la operación.
      select * into v_prev from public.ledger_events where business_id = v_business.id and idempotency_key = p_idempotency_key;
      if found and v_prev.event_type = 'earn' and v_prev.purchase_reference_hash = p_purchase_reference_hash then
        return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id) || private.card_result(v_prev.card_id);
      end if;
      return private.reject(v_business.id, 'ledger.earn', 'token_invalid');
    end if;
    v_source := case when v_device.id is null then 'staff_qr' else 'staff_nfc' end;
  else
    -- Acreditar sin QR del cliente requiere rol de gerente o superior.
    if v_staff.role not in ('owner', 'admin', 'manager') then
      return private.reject(v_business.id, 'ledger.earn', 'forbidden', 'card', p_card_id::text);
    end if;
    v_card_id := p_card_id;
    v_source := 'staff_lookup';
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
  begin
    create temporary table if not exists pg_temp.earn_items (product_id uuid, quantity integer, complimentary boolean) on commit drop;
    truncate pg_temp.earn_items;
    insert into pg_temp.earn_items (product_id, quantity, complimentary)
    select (e ->> 'product_id')::uuid, (e ->> 'quantity')::integer, coalesce((e ->> 'complimentary')::boolean, false)
    from jsonb_array_elements(p_items) e;
  exception when others then
    return private.reject(v_business.id, 'ledger.earn', 'invalid_items');
  end;

  select count(*), count(p.id) into v_requested, v_known
  from pg_temp.earn_items i
  left join public.products p on p.id = i.product_id and p.business_id = v_business.id and p.active;
  if v_requested <> v_known
     or exists (select 1 from pg_temp.earn_items where quantity is null or quantity not between 1 and 20)
     or (select count(distinct product_id) from pg_temp.earn_items) <> v_requested then
    return private.reject(v_business.id, 'ledger.earn', 'invalid_items');
  end if;

  select
    coalesce(sum(i.quantity) filter (where p.eligible_for_stamp and not i.complimentary and p.price_cents > 0), 0),
    coalesce(sum(p.price_cents * i.quantity) filter (where not i.complimentary), 0),
    min(p.price_cents) filter (where p.eligible_for_stamp and not i.complimentary and p.price_cents > 0)
  into v_eligible_units, v_total, v_min_price
  from pg_temp.earn_items i
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
  select v_purchase_id, p.id, p.name, p.price_cents, i.quantity, i.complimentary,
         p.eligible_for_stamp and not i.complimentary and p.price_cents > 0
  from pg_temp.earn_items i join public.products p on p.id = i.product_id;

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

-- ---------------------------------------------------------------------
-- Personal: canjea una recompensa. Requiere el QR de canje generado por el
-- cliente en su sesión (confirmación del cliente) y es atómico por tarjeta.
-- ---------------------------------------------------------------------
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
-- Gerencia: revierte una acreditación, canje o ajuste (con motivo).
-- ---------------------------------------------------------------------
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

  if v_event.stamps_delta < 0 and v_event.event_type = 'manual_adjustment' then
    null; -- revertir un descuento manual devuelve sellos; no puede dejar saldo negativo.
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

  perform private.audit(v_event.business_id, 'ledger.reverse', 'ledger_event', v_reverse_id::text, 'success',
    jsonb_build_object('reversed_event_id', v_event.id, 'reversed_type', v_event.event_type, 'reason', v_reason));

  return jsonb_build_object('ok', true, 'replayed', false, 'event_id', v_reverse_id) || private.card_result(v_card.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Administración: ajuste manual de sellos con motivo
-- ---------------------------------------------------------------------
create or replace function public.adjust_stamps(p_card_id uuid, p_delta integer, p_reason text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.loyalty_cards;
  v_staff public.staff_members;
  v_prev public.ledger_events;
  v_cv public.campaign_versions;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_event_id uuid;
  v_issued integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_card from public.loyalty_cards where id = p_card_id;
  if not found or private.staff_role_in(v_card.business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not private.has_role(v_card.business_id, array['owner', 'admin']::public.staff_role[]) then
    return private.reject(v_card.business_id, 'ledger.adjust', 'forbidden', 'card', p_card_id::text);
  end if;
  select * into v_staff from public.staff_members where business_id = v_card.business_id and user_id = auth.uid();

  if p_delta is null or p_delta = 0 or p_delta not between -50 and 50 or length(v_reason) not between 5 and 300
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,100}$' then
    return private.reject(v_card.business_id, 'ledger.adjust', 'invalid_request');
  end if;

  select * into v_prev from public.ledger_events where business_id = v_card.business_id and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.event_type = 'manual_adjustment' and v_prev.card_id = p_card_id and v_prev.stamps_delta = p_delta then
      return jsonb_build_object('ok', true, 'replayed', true, 'event_id', v_prev.id) || private.card_result(p_card_id);
    end if;
    return private.reject(v_card.business_id, 'ledger.adjust', 'idempotency_conflict');
  end if;

  if not private.rate_limit_allow('adjust:' || v_staff.id, 30, 600) then
    return private.reject(v_card.business_id, 'ledger.adjust', 'rate_limited');
  end if;

  select * into v_card from public.loyalty_cards where id = p_card_id for update;
  if v_card.stamps_balance + p_delta < 0 then
    return private.reject(v_card.business_id, 'ledger.adjust', 'would_go_negative', 'card', p_card_id::text);
  end if;
  v_cv := private.current_campaign_version(v_card.business_id);

  insert into public.ledger_events (
    business_id, card_id, customer_id, campaign_version_id, event_type, stamps_delta,
    idempotency_key, source, actor_user_id, actor_staff_id, reason, validation
  ) values (
    v_card.business_id, v_card.id, v_card.customer_id, v_cv.id, 'manual_adjustment', p_delta,
    p_idempotency_key, 'admin_console', auth.uid(), v_staff.id, v_reason, jsonb_build_object('result', 'accepted')
  ) returning id into v_event_id;

  update public.loyalty_cards set stamps_balance = stamps_balance + p_delta, version = version + 1 where id = v_card.id;

  v_issued := 0;
  if v_cv.id is not null then
    v_issued := private.issue_rewards(v_card.id, v_cv, v_event_id, null, p_idempotency_key, null, v_staff.id, 'system');
  end if;

  perform private.audit(v_card.business_id, 'ledger.adjust', 'ledger_event', v_event_id::text, 'success',
    jsonb_build_object('card_id', v_card.id, 'delta', p_delta, 'reason', v_reason, 'rewards_issued', v_issued));

  return jsonb_build_object('ok', true, 'replayed', false, 'event_id', v_event_id, 'rewards_issued', v_issued)
    || private.card_result(v_card.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Administración: publica una nueva versión inmutable de la campaña
-- ---------------------------------------------------------------------
create or replace function public.publish_campaign_version(p_campaign_id uuid, p_rules jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_next integer;
  v_version public.campaign_versions;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if not found or private.staff_role_in(v_campaign.business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not private.has_role(v_campaign.business_id, array['owner', 'admin']::public.staff_role[]) then
    return private.reject(v_campaign.business_id, 'campaign.publish', 'forbidden', 'campaign', p_campaign_id::text);
  end if;
  if length(v_reason) not between 5 and 300 or p_rules is null or jsonb_typeof(p_rules) <> 'object' then
    return private.reject(v_campaign.business_id, 'campaign.publish', 'invalid_request');
  end if;

  perform 1 from public.campaigns where id = p_campaign_id for update;
  select coalesce(max(version), 0) + 1 into v_next from public.campaign_versions where campaign_id = p_campaign_id;

  begin
    insert into public.campaign_versions (
      campaign_id, business_id, version, name, reward_description, stamps_required, stamps_per_purchase,
      reward_cap_kind, reward_cap_max_cents, min_seconds_between_earns, max_earns_per_day, change_reason, created_by
    ) values (
      v_campaign.id, v_campaign.business_id, v_next,
      p_rules ->> 'name',
      p_rules ->> 'rewardDescription',
      (p_rules ->> 'stampsRequired')::integer,
      coalesce((p_rules ->> 'stampsPerPurchase')::integer, 1),
      (p_rules -> 'rewardCap' ->> 'kind')::public.reward_cap_kind,
      (p_rules -> 'rewardCap' ->> 'maxCents')::integer,
      coalesce((p_rules ->> 'minSecondsBetweenEarns')::integer, 600),
      coalesce((p_rules ->> 'maxEarnsPerDay')::integer, 3),
      v_reason, auth.uid()
    ) returning * into v_version;
  exception when others then
    return private.reject(v_campaign.business_id, 'campaign.publish', 'invalid_rules');
  end;

  perform private.audit(v_campaign.business_id, 'campaign.publish', 'campaign_version', v_version.id::text, 'success',
    jsonb_build_object('version', v_next, 'reason', v_reason, 'rules', p_rules));
  return jsonb_build_object('ok', true, 'campaign_version_id', v_version.id, 'version', v_next);
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegios de ejecución: solo usuarios autenticados, nunca anon.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.staff_role_in(uuid), private.has_role(uuid, public.staff_role[]),
  private.can_operate_branch(uuid, public.staff_role[]), private.owns_card(uuid) to authenticated;
grant execute on function
  public.enroll_customer(text, text),
  public.get_my_card(text),
  public.issue_scan_token(uuid, public.scan_token_purpose, text, integer),
  public.staff_lookup_card(uuid, text),
  public.record_earn(uuid, text, text, jsonb, text, uuid, text),
  public.redeem_reward(uuid, text, text),
  public.reverse_ledger_event(uuid, text, text, public.purchase_status),
  public.adjust_stamps(uuid, integer, text, text),
  public.publish_campaign_version(uuid, jsonb, text)
to authenticated;
