-- =====================================================================
-- Gerencia y administración: bitácora, resumen, catálogo, sucursales,
-- invitaciones de personal, gestión de roles, clientes y baja de cuenta.
-- Mismo patrón: funciones `security definer`, jsonb {ok, ...}, auditoría.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Invitaciones de personal (se aceptan al entrar con el correo verificado)
-- ---------------------------------------------------------------------
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  display_name text not null check (length(display_name) between 1 and 80),
  role public.staff_role not null,
  branch_ids uuid[] not null default '{}',
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid,
  revoked_at timestamptz,
  check (not (accepted_at is not null and revoked_at is not null))
);
create unique index staff_invitations_one_pending on public.staff_invitations (business_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.staff_invitations enable row level security;
grant select on public.staff_invitations to authenticated;
create policy staff_invitations_read_admins on public.staff_invitations for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

-- Administración necesita ver también sucursales inactivas (para reactivarlas).
create policy branches_admin_read_all on public.branches for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.is_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_business_id, array['owner', 'admin']::public.staff_role[])
$$;

-- Valida que todas las sucursales existan y pertenezcan a la empresa.
create or replace function private.branches_belong(p_business_id uuid, p_branch_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_branch_ids), 0) <= 50
     and not exists (
       select 1 from unnest(coalesce(p_branch_ids, '{}')) as x(id)
       where not exists (select 1 from public.branches b where b.id = x.id and b.business_id = p_business_id)
     )
$$;

-- ---------------------------------------------------------------------
-- Bitácora de movimientos (gerente: su sucursal; admin: todas o una)
-- ---------------------------------------------------------------------
create or replace function public.list_ledger(
  p_business_id uuid,
  p_branch_id uuid default null,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  v_admin := private.is_admin(p_business_id);
  if not v_admin and (p_branch_id is null or not private.can_operate_branch(p_branch_id, array['manager']::public.staff_role[])) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and business_id = p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'events', coalesce((
    select jsonb_agg(row_to_json(t) order by t.occurred_at desc, t.id)
    from (
      select
        e.id, e.event_type, e.stamps_delta, e.rewards_delta, e.occurred_at, e.source, e.reason,
        e.reward_value_cap_cents, e.related_event_id,
        br.name as branch_name,
        sm.display_name as actor_name,
        coalesce(cu.display_name, case when cu.status = 'deleted' then 'Cuenta eliminada' else 'Cliente' end) as customer_label,
        private.mask_contact(cu) as customer_contact_masked,
        c.public_serial as card_serial,
        p.total_cents as purchase_total_cents,
        p.status as purchase_status,
        exists (select 1 from public.ledger_events r where r.related_event_id = e.id and r.event_type = 'reverse') as reversed,
        (
          e.event_type in ('earn', 'redeem', 'manual_adjustment')
          and not exists (select 1 from public.ledger_events r where r.related_event_id = e.id and r.event_type = 'reverse')
          and (v_admin or (e.event_type <> 'manual_adjustment' and e.branch_id is not null))
        ) as reversible
      from public.ledger_events e
      join public.loyalty_cards c on c.id = e.card_id
      join public.customers cu on cu.id = e.customer_id
      left join public.branches br on br.id = e.branch_id
      left join public.staff_members sm on sm.id = e.actor_staff_id
      left join public.purchases p on p.id = e.purchase_id
      where e.business_id = p_business_id
        and (p_branch_id is null or e.branch_id = p_branch_id)
        and (p_before is null or e.occurred_at < p_before)
      order by e.occurred_at desc, e.id
      limit v_limit
    ) t
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Resumen de actividad real (sin métricas inventadas)
-- ---------------------------------------------------------------------
create or replace function public.business_summary(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  select timezone into v_tz from public.businesses where id = p_business_id;
  v_today := (now() at time zone v_tz)::date;

  return jsonb_build_object(
    'ok', true,
    'customers_total', (select count(*) from public.customers where business_id = p_business_id and status = 'active'),
    'customers_new_7d', (select count(*) from public.customers where business_id = p_business_id and status = 'active'
                          and created_at >= now() - interval '7 days'),
    'earns_today', (select count(*) from public.ledger_events where business_id = p_business_id and event_type = 'earn'
                     and (occurred_at at time zone v_tz)::date = v_today),
    'earns_7d', (select count(*) from public.ledger_events where business_id = p_business_id and event_type = 'earn'
                  and occurred_at >= now() - interval '7 days'),
    'redeems_7d', (select count(*) from public.ledger_events where business_id = p_business_id and event_type = 'redeem'
                    and occurred_at >= now() - interval '7 days'),
    'reversals_7d', (select count(*) from public.ledger_events where business_id = p_business_id and event_type = 'reverse'
                      and occurred_at >= now() - interval '7 days'),
    'rewards_outstanding', (select coalesce(sum(rewards_balance), 0) from public.loyalty_cards where business_id = p_business_id),
    'staff_active', (select count(*) from public.staff_members where business_id = p_business_id and active)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create or replace function public.upsert_product(
  p_business_id uuid,
  p_product_id uuid,
  p_name text,
  p_category text,
  p_price_cents integer,
  p_eligible boolean,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.products;
  v_after public.products;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'product.upsert', 'forbidden');
  end if;

  begin
    if p_product_id is null then
      insert into public.products (business_id, name, category, price_cents, eligible_for_stamp, active)
      values (p_business_id, btrim(p_name), btrim(p_category), p_price_cents, coalesce(p_eligible, false), coalesce(p_active, true))
      returning * into v_after;
    else
      select * into v_before from public.products where id = p_product_id and business_id = p_business_id for update;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'not_found');
      end if;
      update public.products
        set name = btrim(p_name), category = btrim(p_category), price_cents = p_price_cents,
            eligible_for_stamp = coalesce(p_eligible, false), active = coalesce(p_active, true)
        where id = p_product_id
        returning * into v_after;
    end if;
  exception
    when unique_violation then
      return private.reject(p_business_id, 'product.upsert', 'duplicate_name');
    when check_violation or not_null_violation then
      return private.reject(p_business_id, 'product.upsert', 'invalid_request');
  end;

  perform private.audit(p_business_id, 'product.upsert', 'product', v_after.id::text, 'success',
    jsonb_build_object('before', case when v_before.id is null then null else to_jsonb(v_before) - 'business_id' end,
                       'after', to_jsonb(v_after) - 'business_id'));
  return jsonb_build_object('ok', true, 'product_id', v_after.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Sucursales
-- ---------------------------------------------------------------------
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
    select * into v_before from public.branches where id = p_branch_id and business_id = p_business_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
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

-- ---------------------------------------------------------------------
-- Personal: invitar, revocar, aceptar y actualizar
-- Reglas: solo owner invita/gestiona owner y admin; admin gestiona manager y
-- barista; nadie se modifica a sí mismo; siempre queda al menos un owner activo.
-- ---------------------------------------------------------------------
create or replace function private.can_manage_role(p_business_id uuid, p_target_role public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.staff_role_in(p_business_id)
    when 'owner' then true
    when 'admin' then p_target_role in ('manager', 'barista')
    else false
  end
$$;

create or replace function public.invite_staff(
  p_business_id uuid,
  p_email text,
  p_display_name text,
  p_role public.staff_role,
  p_branch_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_invitation public.staff_invitations;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) or not private.can_manage_role(p_business_id, p_role) then
    return private.reject(p_business_id, 'staff.invite', 'forbidden');
  end if;
  if not private.rate_limit_allow('invite:' || auth.uid(), 30, 3600) then
    return private.reject(p_business_id, 'staff.invite', 'rate_limited');
  end if;
  if not private.branches_belong(p_business_id, p_branch_ids) then
    return private.reject(p_business_id, 'staff.invite', 'invalid_request');
  end if;
  if p_role in ('manager', 'barista') and coalesce(cardinality(p_branch_ids), 0) = 0 then
    return private.reject(p_business_id, 'staff.invite', 'branch_required');
  end if;
  if exists (
    select 1 from public.staff_members sm join auth.users u on u.id = sm.user_id
    where sm.business_id = p_business_id and lower(u.email) = v_email
  ) then
    return private.reject(p_business_id, 'staff.invite', 'staff_exists');
  end if;

  begin
    insert into public.staff_invitations (business_id, email, display_name, role, branch_ids, invited_by)
    values (p_business_id, v_email, btrim(p_display_name), p_role,
            case when p_role in ('owner', 'admin') then '{}' else p_branch_ids end, auth.uid())
    returning * into v_invitation;
  exception
    when unique_violation then
      return private.reject(p_business_id, 'staff.invite', 'invitation_exists');
    when check_violation or not_null_violation then
      return private.reject(p_business_id, 'staff.invite', 'invalid_request');
  end;

  perform private.audit(p_business_id, 'staff.invite', 'staff_invitation', v_invitation.id::text, 'success',
    jsonb_build_object('role', p_role, 'branches', cardinality(v_invitation.branch_ids)));
  return jsonb_build_object('ok', true, 'invitation_id', v_invitation.id);
end;
$$;

create or replace function public.revoke_staff_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.staff_invitations;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_inv from public.staff_invitations where id = p_invitation_id for update;
  if not found or private.staff_role_in(v_inv.business_id) is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not private.is_admin(v_inv.business_id) or not private.can_manage_role(v_inv.business_id, v_inv.role) then
    return private.reject(v_inv.business_id, 'staff.invite_revoke', 'forbidden');
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'invitation_closed');
  end if;
  update public.staff_invitations set revoked_at = now() where id = p_invitation_id;
  perform private.audit(v_inv.business_id, 'staff.invite_revoke', 'staff_invitation', p_invitation_id::text, 'success');
  return jsonb_build_object('ok', true);
end;
$$;

-- La llama el propio usuario tras iniciar sesión: acepta invitaciones de su correo verificado.
create or replace function public.claim_staff_invitations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_inv public.staff_invitations;
  v_staff_id uuid;
  v_claimed integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  if v_email is null or v_confirmed is null then
    return jsonb_build_object('ok', true, 'claimed', 0);
  end if;

  for v_inv in
    select * from public.staff_invitations
    where email = v_email and accepted_at is null and revoked_at is null
    for update
  loop
    insert into public.staff_members (business_id, user_id, role, display_name)
    values (v_inv.business_id, auth.uid(), v_inv.role, v_inv.display_name)
    on conflict (business_id, user_id) do nothing
    returning id into v_staff_id;

    if v_staff_id is not null then
      insert into public.staff_branch_access (staff_member_id, branch_id, business_id)
      select v_staff_id, b, v_inv.business_id from unnest(v_inv.branch_ids) b
      where exists (select 1 from public.branches br where br.id = b and br.business_id = v_inv.business_id)
      on conflict do nothing;
      v_claimed := v_claimed + 1;
    end if;

    update public.staff_invitations set accepted_at = now(), accepted_user_id = auth.uid() where id = v_inv.id;
    perform private.audit(v_inv.business_id, 'staff.invite_accept', 'staff_invitation', v_inv.id::text, 'success',
      jsonb_build_object('role', v_inv.role, 'created', v_staff_id is not null));
  end loop;

  return jsonb_build_object('ok', true, 'claimed', v_claimed);
end;
$$;

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

-- Listado de personal para administración (correo enmascarado salvo para owner).
create or replace function public.list_staff(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_owner := private.staff_role_in(p_business_id) = 'owner';

  return jsonb_build_object(
    'ok', true,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sm.id, 'display_name', sm.display_name, 'role', sm.role, 'active', sm.active,
        'is_self', sm.user_id = auth.uid(),
        'email', case when v_owner then lower(u.email) else left(lower(u.email), 1) || '•••@' || split_part(lower(u.email), '@', 2) end,
        'branch_ids', (select coalesce(jsonb_agg(a.branch_id), '[]'::jsonb) from public.staff_branch_access a where a.staff_member_id = sm.id),
        'manageable', sm.user_id <> auth.uid() and private.can_manage_role(p_business_id, sm.role)
      ) order by sm.active desc, sm.display_name)
      from public.staff_members sm join auth.users u on u.id = sm.user_id
      where sm.business_id = p_business_id
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'display_name', i.display_name, 'role', i.role,
        'branch_ids', to_jsonb(i.branch_ids), 'created_at', i.created_at,
        'manageable', private.can_manage_role(p_business_id, i.role)
      ) order by i.created_at desc)
      from public.staff_invitations i
      where i.business_id = p_business_id and i.accepted_at is null and i.revoked_at is null
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Clientes (administración): búsqueda exacta por contacto o serial; contacto enmascarado
-- ---------------------------------------------------------------------
create or replace function public.admin_find_customers(p_business_id uuid, p_query text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_phone text := '+52' || right(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), 10);
  v_kind text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'customer.search', 'forbidden');
  end if;
  if not private.rate_limit_allow('customer_search:' || auth.uid(), 60, 600) then
    return private.reject(p_business_id, 'customer.search', 'rate_limited');
  end if;
  if length(v_q) < 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  v_kind := case when v_q like '%@%' then 'email' when v_q ~ '^[0-9a-f]{32}$' then 'serial' else 'phone' end;

  -- Se audita el tipo de búsqueda, nunca el dato buscado.
  perform private.audit(p_business_id, 'customer.search', null, null, 'success', jsonb_build_object('kind', v_kind));

  return jsonb_build_object('ok', true, 'customers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'card_id', c.id, 'card_serial', c.public_serial, 'display_name', cu.display_name,
      'contact_masked', private.mask_contact(cu), 'contact_channel', cu.contact_channel,
      'stamps_balance', c.stamps_balance, 'rewards_balance', c.rewards_balance,
      'enrolled_at', cu.created_at, 'last_earn_at', c.last_earn_at
    ))
    from public.customers cu join public.loyalty_cards c on c.customer_id = cu.id
    where cu.business_id = p_business_id and cu.status = 'active'
      and case v_kind
        when 'email' then cu.contact_email = v_q
        when 'serial' then c.public_serial = v_q
        else cu.contact_phone = v_phone and length(regexp_replace(coalesce(p_query, ''), '\D', '', 'g')) >= 10
      end
    limit 10
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente: eliminar sus datos personales (el historial queda anonimizado)
-- ---------------------------------------------------------------------
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
  delete from public.scan_tokens where card_id = (select id from public.loyalty_cards where customer_id = v_customer.id);

  perform private.audit(v_customer.business_id, 'customer.delete', 'customer', v_customer.id::text, 'success',
    jsonb_build_object('requested_by', 'customer'));
  return jsonb_build_object('ok', true, 'is_staff', exists (select 1 from public.staff_members where user_id = auth.uid()));
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------
revoke execute on function
  private.is_admin(uuid), private.branches_belong(uuid, uuid[]), private.can_manage_role(uuid, public.staff_role)
from public, anon, authenticated;

revoke execute on function
  public.list_ledger(uuid, uuid, integer, timestamptz),
  public.business_summary(uuid),
  public.upsert_product(uuid, uuid, text, text, integer, boolean, boolean),
  public.upsert_branch(uuid, uuid, text, text, text, boolean),
  public.invite_staff(uuid, text, text, public.staff_role, uuid[]),
  public.revoke_staff_invitation(uuid),
  public.claim_staff_invitations(),
  public.update_staff_member(uuid, public.staff_role, boolean, uuid[]),
  public.list_staff(uuid),
  public.admin_find_customers(uuid, text),
  public.delete_my_customer_data(text)
from public, anon;

grant execute on function
  public.list_ledger(uuid, uuid, integer, timestamptz),
  public.business_summary(uuid),
  public.upsert_product(uuid, uuid, text, text, integer, boolean, boolean),
  public.upsert_branch(uuid, uuid, text, text, text, boolean),
  public.invite_staff(uuid, text, text, public.staff_role, uuid[]),
  public.revoke_staff_invitation(uuid),
  public.claim_staff_invitations(),
  public.update_staff_member(uuid, public.staff_role, boolean, uuid[]),
  public.list_staff(uuid),
  public.admin_find_customers(uuid, text),
  public.delete_my_customer_data(text)
to authenticated;
