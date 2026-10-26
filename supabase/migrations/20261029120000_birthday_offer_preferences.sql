-- Cumpleaños promocional: solo día y mes, consentimiento separado y revocable.
-- No hay envío automático ni descuento sin reglas y canal configurados.
alter table public.customers
  add column birth_month smallint,
  add column birth_day smallint,
  add column birthday_offer_consented_at timestamptz,
  add column birthday_offer_consent_version text,
  add constraint customers_birthday_offer_state check (
    (birth_month is null and birth_day is null and birthday_offer_consented_at is null and birthday_offer_consent_version is null)
    or (birth_month between 1 and 12 and birth_day between 1 and 31
        and birthday_offer_consented_at is not null and birthday_offer_consent_version is not null)
  );

create or replace function private.clear_birthday_on_customer_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'deleted' then
    new.birth_month := null;
    new.birth_day := null;
    new.birthday_offer_consented_at := null;
    new.birthday_offer_consent_version := null;
  end if;
  return new;
end $$;
create trigger customers_clear_birthday before update of status on public.customers
  for each row execute function private.clear_birthday_on_customer_delete();

create or replace function public.set_my_birthday_offer(
  p_business_slug text, p_month integer, p_day integer, p_consent boolean, p_consent_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers; v_max_day integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  select cu.* into v_customer from public.customers cu join public.businesses b on b.id = cu.business_id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid() and cu.status = 'active' for update of cu;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_enrolled'); end if;
  if not coalesce(p_consent, false) then
    if v_customer.birthday_offer_consented_at is not null then
      update public.customers set birth_month = null, birth_day = null,
        birthday_offer_consented_at = null, birthday_offer_consent_version = null where id = v_customer.id;
      perform private.audit(v_customer.business_id, 'birthday.opt_out', 'customer', v_customer.id::text, 'success');
    end if;
    return jsonb_build_object('ok', true, 'opted_in', false);
  end if;
  v_max_day := case p_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
    when 1 then 31 when 3 then 31 when 5 then 31 when 7 then 31 when 8 then 31 when 10 then 31 when 12 then 31 else 0 end;
  if p_day is null or p_day < 1 or p_day > v_max_day or p_consent_version <> '2026-10-26' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if v_customer.birthday_offer_consented_at is not null and v_customer.birth_month = p_month
    and v_customer.birth_day = p_day and v_customer.birthday_offer_consent_version = p_consent_version then
    return jsonb_build_object('ok', true, 'opted_in', true, 'unchanged', true);
  end if;
  update public.customers set birth_month = p_month, birth_day = p_day,
    birthday_offer_consented_at = now(), birthday_offer_consent_version = p_consent_version
    where id = v_customer.id;
  perform private.audit(v_customer.business_id, 'birthday.opt_in', 'customer', v_customer.id::text, 'success',
    jsonb_build_object('consent_version', p_consent_version));
  return jsonb_build_object('ok', true, 'opted_in', true);
end $$;

create or replace function public.get_my_birthday_offer(p_business_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_customer public.customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  select cu.* into v_customer from public.customers cu join public.businesses b on b.id = cu.business_id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid() and cu.status = 'active';
  if not found then return jsonb_build_object('ok', false, 'code', 'not_enrolled'); end if;
  return jsonb_build_object('ok', true, 'opted_in', v_customer.birthday_offer_consented_at is not null,
    'month', v_customer.birth_month, 'day', v_customer.birth_day);
end $$;

create or replace function public.enroll_customer_with_birthday(
  p_business_slug text, p_display_name text, p_privacy_version text,
  p_month integer, p_day integer, p_birthday_consent boolean, p_birthday_consent_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_pref jsonb; v_max_day integer;
begin
  if coalesce(p_birthday_consent, false) then
    v_max_day := case p_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
      when 1 then 31 when 3 then 31 when 5 then 31 when 7 then 31 when 8 then 31 when 10 then 31 when 12 then 31 else 0 end;
    if p_day is null or p_day < 1 or p_day > v_max_day or p_birthday_consent_version <> '2026-10-26' then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
  end if;
  v_result := public.enroll_customer(p_business_slug, p_display_name, p_privacy_version);
  if not coalesce((v_result->>'ok')::boolean, false) or not coalesce(p_birthday_consent, false) then return v_result; end if;
  v_pref := public.set_my_birthday_offer(p_business_slug, p_month, p_day, true, p_birthday_consent_version);
  if not coalesce((v_pref->>'ok')::boolean, false) then raise exception 'birthday preference failed'; end if;
  return v_result;
end $$;

revoke execute on function private.clear_birthday_on_customer_delete() from public, anon, authenticated;
revoke execute on function public.set_my_birthday_offer(text,integer,integer,boolean,text),
  public.get_my_birthday_offer(text),
  public.enroll_customer_with_birthday(text,text,text,integer,integer,boolean,text) from public, anon;
grant execute on function public.set_my_birthday_offer(text,integer,integer,boolean,text),
  public.get_my_birthday_offer(text),
  public.enroll_customer_with_birthday(text,text,text,integer,integer,boolean,text) to authenticated;
