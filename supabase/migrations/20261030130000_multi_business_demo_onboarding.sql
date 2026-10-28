-- Alta controlada de espacios DEMO adicionales para propietarios existentes.
-- No habilita todavía el registro público ni planes de pago SaaS.
-- El catálogo activo no debe quedar visible a usuarios autenticados de otros tenants.
drop policy products_read on public.products;
create policy products_read_business on public.products for select to authenticated
  using (
    private.staff_role_in(business_id) is not null
    or exists (select 1 from public.customers c
      where c.business_id = products.business_id and c.auth_user_id = (select auth.uid()) and c.status = 'active')
  );

create or replace function public.create_demo_business(
  p_slug text, p_name text, p_branch_name text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_display_name text;
  v_business_id uuid;
  v_branch_id uuid;
  v_staff_id uuid;
  v_campaign_id uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if not exists (
    select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null
  ) then return jsonb_build_object('ok', false, 'code', 'email_unverified'); end if;
  select sm.display_name into v_display_name
    from public.staff_members sm where sm.user_id = v_uid and sm.role = 'owner' and sm.active
    order by sm.created_at limit 1;
  if v_display_name is null then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
  then return jsonb_build_object('ok', false, 'code', 'mfa_required'); end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 60
    or p_name is null or length(btrim(p_name)) not between 2 and 120
    or p_branch_name is null or length(btrim(p_branch_name)) not between 2 and 120
  then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  if exists (select 1 from public.businesses where slug = p_slug) then
    return jsonb_build_object('ok', false, 'code', 'slug_taken');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 0));
  if (select count(*) from public.staff_members sm join public.businesses b on b.id = sm.business_id
      where sm.user_id = v_uid and sm.role = 'owner' and sm.active and b.is_demo) >= 3
  then return jsonb_build_object('ok', false, 'code', 'demo_limit'); end if;
  if not private.rate_limit_allow('create_demo_business:' || v_uid::text, 3, 86400) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;

  insert into public.businesses (slug, name, is_demo) values (p_slug, btrim(p_name), true) returning id into v_business_id;
  insert into public.branches (business_id, slug, name)
    values (v_business_id, 'principal', btrim(p_branch_name)) returning id into v_branch_id;
  insert into public.staff_members (business_id, user_id, role, display_name)
    values (v_business_id, v_uid, 'owner', v_display_name) returning id into v_staff_id;
  insert into public.campaigns (business_id, name)
    values (v_business_id, 'Programa de visitas') returning id into v_campaign_id;
  insert into public.campaign_versions (
    campaign_id, business_id, version, name, reward_description, stamps_required,
    reward_cap_kind, change_reason, created_by
  ) values (
    v_campaign_id, v_business_id, 1, 'Programa de visitas', 'Una recompensa de cortesía', 5,
    'min_eligible_item_in_completing_ticket', 'Configuración inicial DEMO', v_staff_id
  );
  insert into public.products (business_id, name, category, price_cents, eligible_for_stamp)
    values (v_business_id, 'Visita elegible (DEMO)', 'General', 5000, true);
  perform private.audit(v_business_id, 'business.create_demo', 'business', v_business_id::text, 'success');
  return jsonb_build_object('ok', true, 'business_id', v_business_id, 'branch_id', v_branch_id, 'slug', p_slug);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'slug_taken');
end;
$$;

revoke execute on function public.create_demo_business(text, text, text) from public, anon;
grant execute on function public.create_demo_business(text, text, text) to authenticated;
