-- Ejecutar solo en el proyecto DEMO, después de crear usuarios en Supabase Auth.
-- En la MISMA sesión, configurar app.demo_owner_user_id (obligatorio) y
-- app.demo_norte_manager_user_id / app.demo_brisa_manager_user_id (opcionales).
-- No insertar usuarios directamente en auth.users ni guardar UUID reales aquí.
do $$
declare
  v_owner uuid := nullif(current_setting('app.demo_owner_user_id', true), '')::uuid;
  v_norte_manager uuid := nullif(current_setting('app.demo_norte_manager_user_id', true), '')::uuid;
  v_brisa_manager uuid := nullif(current_setting('app.demo_brisa_manager_user_id', true), '')::uuid;
  v_staff uuid;
begin
  if v_owner is null or not exists (select 1 from auth.users where id = v_owner and email_confirmed_at is not null) then
    raise exception 'Se requiere un propietario con correo verificado en el proyecto DEMO';
  end if;

  insert into public.staff_members (business_id, user_id, role, display_name)
  values ('10000000-0000-4000-8000-000000000001', v_owner, 'owner', 'Propietario')
  on conflict (business_id, user_id) do update set role = 'owner', active = true;
  insert into public.staff_members (business_id, user_id, role, display_name)
  values ('20000000-0000-4000-8000-000000000001', v_owner, 'owner', 'Propietario')
  on conflict (business_id, user_id) do update set role = 'owner', active = true;

  if v_norte_manager is not null then
    if v_norte_manager = v_owner or not exists (select 1 from auth.users where id = v_norte_manager and email_confirmed_at is not null) then
      raise exception 'Cuenta de responsable de Norte inválida o sin verificar';
    end if;
    insert into public.staff_members (business_id, user_id, role, display_name)
    values ('10000000-0000-4000-8000-000000000001', v_norte_manager, 'manager', 'Responsable Centro')
    on conflict (business_id, user_id) do update set role = 'manager', active = true
    returning id into v_staff;
    insert into public.staff_branch_access (staff_member_id, branch_id, business_id)
    values (v_staff, '10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001')
    on conflict do nothing;
  end if;

  if v_brisa_manager is not null then
    if v_brisa_manager = v_owner or not exists (select 1 from auth.users where id = v_brisa_manager and email_confirmed_at is not null) then
      raise exception 'Cuenta de responsable de Brisa inválida o sin verificar';
    end if;
    insert into public.staff_members (business_id, user_id, role, display_name)
    values ('20000000-0000-4000-8000-000000000001', v_brisa_manager, 'manager', 'Responsable Cholula')
    on conflict (business_id, user_id) do update set role = 'manager', active = true
    returning id into v_staff;
    insert into public.staff_branch_access (staff_member_id, branch_id, business_id)
    values (v_staff, '20000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001')
    on conflict do nothing;
  end if;
end $$;
