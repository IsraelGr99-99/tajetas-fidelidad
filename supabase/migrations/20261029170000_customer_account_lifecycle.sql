-- Baja temporal reversible y eliminación definitiva iniciadas exclusivamente
-- por el cliente autenticado. El motivo libre solo vive mientras esté desactivado.
alter table public.customers add column disabled_at timestamptz,
  add column closure_reason text,
  add column closure_category text;
alter table public.customers drop constraint customers_check;
alter table public.customers add constraint customers_check check (
  (status = 'deleted' and contact_email is null and contact_phone is null
    and display_name is null and deleted_at is not null and auth_user_id is null
    and closure_reason is null)
  or (status in ('active','disabled') and contact_channel = 'email'
    and contact_email is not null and contact_phone is null and deleted_at is null)
  or (status in ('active','disabled') and contact_channel = 'phone'
    and contact_phone is not null and contact_email is null and deleted_at is null)
);
alter table public.customers add constraint customers_closure_state check (
  (status = 'active' and disabled_at is null and closure_reason is null and closure_category is null)
  or (status = 'disabled' and disabled_at is not null and closure_reason is not null
    and length(closure_reason) between 3 and 200
    and closure_category in ('no_uso','privacidad','experiencia','otro'))
  or (status = 'deleted' and disabled_at is null and closure_reason is null
    and closure_category in ('no_uso','privacidad','experiencia','otro'))
);

create or replace function public.get_my_account_status(p_business_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_status public.customer_status; v_card_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','not_authenticated'); end if;
  select cu.status,c.id into v_status,v_card_id from public.customers cu
    join public.businesses b on b.id = cu.business_id
    left join public.loyalty_cards c on c.customer_id = cu.id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid();
  return jsonb_build_object('ok',true,'status',coalesce(v_status::text,'not_enrolled'),'card_id',v_card_id);
end $$;

create or replace function public.disable_my_customer_account(p_business_slug text,p_category text,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers; v_reason text := btrim(coalesce(p_reason,''));
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','not_authenticated'); end if;
  if p_category not in ('no_uso','privacidad','experiencia','otro')
    or length(v_reason) not between 3 and 200 or v_reason ~ '[[:cntrl:]<>]' then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  select cu.* into v_customer from public.customers cu
    join public.businesses b on b.id = cu.business_id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid() and cu.status = 'active'
    for update of cu;
  if not found then return jsonb_build_object('ok',false,'code','not_enrolled'); end if;
  update public.customers set status = 'disabled', disabled_at = now(),
    closure_category = p_category, closure_reason = v_reason where id = v_customer.id;
  update public.loyalty_cards set version = version + 1 where customer_id = v_customer.id;
  delete from public.scan_tokens where card_id = (select id from public.loyalty_cards where customer_id = v_customer.id);
  perform private.audit(v_customer.business_id,'customer.disable','customer',v_customer.id::text,'success',
    jsonb_build_object('category',p_category));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.reactivate_my_customer_account(p_business_slug text,p_privacy_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','not_authenticated'); end if;
  if p_privacy_version is null or p_privacy_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  select cu.* into v_customer from public.customers cu
    join public.businesses b on b.id = cu.business_id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid() and cu.status = 'disabled'
    for update of cu;
  if not found then return jsonb_build_object('ok',false,'code','not_disabled'); end if;
  update public.customers set status = 'active', disabled_at = null,
    closure_category = null, closure_reason = null,
    privacy_version = p_privacy_version, privacy_accepted_at = now()
    where id = v_customer.id;
  update public.loyalty_cards set version = version + 1 where customer_id = v_customer.id;
  perform private.audit(v_customer.business_id,'customer.reactivate','customer',v_customer.id::text,'success');
  return jsonb_build_object('ok',true);
end $$;

drop function public.delete_my_customer_data(text);
create function public.delete_my_customer_data(p_business_slug text,p_category text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','not_authenticated'); end if;
  if p_category not in ('no_uso','privacidad','experiencia','otro') then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  select cu.* into v_customer from public.customers cu
    join public.businesses b on b.id = cu.business_id
    where b.slug = p_business_slug and cu.auth_user_id = auth.uid()
      and cu.status in ('active','disabled') for update of cu;
  if not found then return jsonb_build_object('ok',false,'code','not_enrolled'); end if;
  update public.customers set status = 'deleted', contact_email = null, contact_phone = null,
    display_name = null, deleted_at = now(), disabled_at = null,
    closure_reason = null, closure_category = p_category, auth_user_id = null
    where id = v_customer.id;
  update public.loyalty_cards set version = version + 1 where customer_id = v_customer.id;
  delete from public.scan_tokens where card_id = (select id from public.loyalty_cards where customer_id = v_customer.id);
  perform private.audit(v_customer.business_id,'customer.delete','customer',v_customer.id::text,'success',
    jsonb_build_object('category',p_category));
  return jsonb_build_object('ok',true,'is_staff',exists (
    select 1 from public.staff_members where user_id = auth.uid()));
end $$;

revoke execute on function public.get_my_account_status(text),
  public.disable_my_customer_account(text,text,text),
  public.reactivate_my_customer_account(text,text),
  public.delete_my_customer_data(text,text) from public,anon;
grant execute on function public.get_my_account_status(text),
  public.disable_my_customer_account(text,text,text),
  public.reactivate_my_customer_account(text,text),
  public.delete_my_customer_data(text,text) to authenticated;
