-- =====================================================================
-- Mantenimiento: retención de datos temporales (docs/privacidad.md).
-- - Códigos QR y apartados: se borran 24 h después de caducar.
-- - Ventanas de límite de frecuencia: se borran a las 24 h.
-- Se programa con pg_cron cuando la extensión está disponible (Supabase);
-- en entornos sin pg_cron la función existe y puede llamarse a mano.
-- =====================================================================

create or replace function private.cleanup_ephemeral()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tokens integer;
  v_windows integer;
begin
  delete from public.scan_tokens where expires_at < now() - interval '24 hours';
  get diagnostics v_tokens = row_count;
  delete from private.rate_limit_hits where window_start < now() - interval '24 hours';
  get diagnostics v_windows = row_count;
  return jsonb_build_object('scan_tokens', v_tokens, 'rate_limit_windows', v_windows);
end;
$$;

revoke execute on function private.cleanup_ephemeral() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      -- Cada hora, al minuto 17 (evita la hora en punto, cuando corren más tareas).
      perform cron.schedule('fidelidad-limpieza-temporal', '17 * * * *', 'select private.cleanup_ephemeral()');
    exception when others then
      raise notice 'pg_cron no disponible (%); programar private.cleanup_ephemeral() desde el panel de Supabase', sqlerrm;
    end;
  end if;
end;
$$;
