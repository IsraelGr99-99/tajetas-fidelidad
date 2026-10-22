-- =====================================================================
-- Contexto del personal autenticado: empresas, rol y sucursales operables.
-- La UI lo usa para mostrar opciones; cada RPC vuelve a validar permisos.
-- =====================================================================

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

revoke execute on function public.get_staff_context() from public, anon;
grant execute on function public.get_staff_context() to authenticated;
