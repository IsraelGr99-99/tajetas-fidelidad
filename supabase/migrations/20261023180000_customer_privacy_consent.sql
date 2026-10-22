-- =====================================================================
-- Alta de cliente con aceptación del aviso de privacidad (LFPDPPP).
-- Se registra la versión aceptada y la fecha; `enroll_customer` la exige.
-- =====================================================================

alter table public.customers
  add column privacy_version text check (privacy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  add column privacy_accepted_at timestamptz;

-- NOT VALID: aplica a filas nuevas o modificadas sin reescribir las existentes.
alter table public.customers
  add constraint customers_privacy_required
  check (status = 'deleted' or (privacy_version is not null and privacy_accepted_at is not null)) not valid;

-- La firma cambia (nuevo parámetro obligatorio): se elimina la versión anterior.
drop function public.enroll_customer(text, text);

create or replace function public.enroll_customer(p_business_slug text, p_display_name text, p_privacy_version text)
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

  if (v_name is not null and length(v_name) > 40)
     or p_privacy_version is null or p_privacy_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- El canal de contacto proviene de Auth (verificado), nunca del navegador.
  select lower(u.email), u.phone, u.email_confirmed_at, u.phone_confirmed_at
    into v_email, v_phone, v_email_confirmed, v_phone_confirmed
  from auth.users u where u.id = v_uid;

  begin
    if v_email is not null and v_email <> '' and v_email_confirmed is not null then
      insert into public.customers (business_id, auth_user_id, contact_channel, contact_email, display_name, verified_at,
        privacy_version, privacy_accepted_at)
      values (v_business.id, v_uid, 'email', v_email, v_name, v_email_confirmed, p_privacy_version, now())
      returning * into v_customer;
    elsif v_phone is not null and v_phone <> '' and v_phone_confirmed is not null then
      insert into public.customers (business_id, auth_user_id, contact_channel, contact_phone, display_name, verified_at,
        privacy_version, privacy_accepted_at)
      values (v_business.id, v_uid, 'phone', '+' || regexp_replace(v_phone, '\D', '', 'g'), v_name, v_phone_confirmed,
        p_privacy_version, now())
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
    jsonb_build_object('channel', v_customer.contact_channel, 'privacy_version', p_privacy_version));
  return jsonb_build_object('ok', true, 'already_enrolled', false) || private.card_result(v_card.id);
end;
$$;

revoke execute on function public.enroll_customer(text, text, text) from public, anon;
grant execute on function public.enroll_customer(text, text, text) to authenticated;
