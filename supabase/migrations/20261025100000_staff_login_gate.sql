-- =====================================================================
-- Acceso del personal con código: solo se envía a correos autorizados
-- (personal activo o con invitación pendiente). Lo llama el servidor de la
-- app con la llave secreta; nunca el navegador.
-- La respuesta no se muestra tal cual al usuario (la UI siempre dice lo mismo)
-- para no revelar qué correos pertenecen al personal.
-- =====================================================================

create or replace function public.request_staff_login_code(p_email text, p_client_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_eligible boolean;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254
     or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- Límites antes de consultar elegibilidad: aplican igual a cualquier correo.
  if not private.rate_limit_allow('staff_otp_email:' || md5(v_email), 5, 3600)
     or not private.rate_limit_allow('staff_otp_client:' || p_client_hash, 20, 3600) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  select exists (
    select 1 from public.staff_members sm join auth.users u on u.id = sm.user_id
    where sm.active and lower(u.email) = v_email
  ) or exists (
    select 1 from public.staff_invitations i
    where i.email = v_email and i.accepted_at is null and i.revoked_at is null
  ) into v_eligible;

  if not v_eligible then
    insert into public.audit_log (action, outcome, details)
    values ('staff.login_code', 'denied', jsonb_build_object('reason', 'not_staff'));
  end if;

  return jsonb_build_object('ok', true, 'eligible', v_eligible);
end;
$$;

revoke execute on function public.request_staff_login_code(text, text) from public, anon, authenticated;
grant execute on function public.request_staff_login_code(text, text) to service_role;
