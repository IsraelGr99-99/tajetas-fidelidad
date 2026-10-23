-- =====================================================================
-- Seguimiento de la re-revisión de la auditoría (2026-10-28).
-- N2: la operación de barra (sellos y canjes) no exige aal2; la verificación en
--     dos pasos protege la administración (has_role/is_admin vía staff_role_in).
-- B2: los bloqueos se toman en orden de id para evitar interbloqueos entre
--     dos administradores que se modifican al mismo tiempo.
-- =====================================================================


-- N2
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
      and (
        sm.role in ('owner', 'admin')
        or exists (select 1 from public.staff_branch_access a where a.staff_member_id = sm.id and a.branch_id = b.id)
      )
  )
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
  perform 1 from public.staff_members where business_id = v_target.business_id and role = 'owner' and active order by id for update;
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

-- B2
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
    perform 1 from public.branches where business_id = p_business_id and active order by id for update;
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
