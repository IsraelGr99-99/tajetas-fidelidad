-- =====================================================================
-- Autorización: helpers, RLS y privilegios.
-- Principio: lectura mínima por RLS; toda escritura pasa por funciones
-- transaccionales `security definer` que validan rol y objeto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de autorización (schema private, no expuesto por la API)
-- ---------------------------------------------------------------------
create or replace function private.staff_role_in(p_business_id uuid)
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.staff_members sm
  where sm.user_id = auth.uid() and sm.business_id = p_business_id and sm.active
$$;

create or replace function private.has_role(p_business_id uuid, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role_in(p_business_id) = any (p_roles), false)
$$;

-- owner/admin operan en todas las sucursales; manager/barista solo en las asignadas.
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

create or replace function private.owns_card(p_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.loyalty_cards c
    join public.customers cu on cu.id = c.customer_id
    where c.id = p_card_id and cu.auth_user_id = auth.uid() and cu.status = 'active'
  )
$$;

-- ---------------------------------------------------------------------
-- Rate limiting de ventana fija. Devuelve true si la petición está permitida.
-- ---------------------------------------------------------------------
create or replace function private.rate_limit_allow(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into private.rate_limit_hits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- Escritura de auditoría centralizada. Los detalles nunca deben incluir tokens ni PII completa.
create or replace function private.audit(
  p_business_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_outcome text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (business_id, actor_user_id, actor_role, action, entity_type, entity_id, outcome, details)
  values (
    p_business_id,
    auth.uid(),
    case when p_business_id is null then null else private.staff_role_in(p_business_id)::text end,
    p_action, p_entity_type, p_entity_id, p_outcome, coalesce(p_details, '{}'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------
-- Privilegios: Supabase concede por defecto ALL a anon/authenticated.
-- Se revoca todo y se concede solo lectura donde RLS lo permite.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on schema private from public, anon;
revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.staff_role_in(uuid), private.has_role(uuid, public.staff_role[]),
  private.can_operate_branch(uuid, public.staff_role[]), private.owns_card(uuid) to authenticated;

-- Futuras tablas/funciones no quedan abiertas por accidente.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Datos públicos no sensibles (nombre del negocio y sucursales).
grant select on public.businesses, public.branches to anon, authenticated;
grant select on public.staff_members, public.staff_branch_access, public.customers, public.loyalty_cards,
  public.campaigns, public.campaign_versions, public.products, public.purchases, public.purchase_items,
  public.nfc_devices, public.ledger_events, public.audit_log to authenticated;
-- Columnas con PII de clientes: solo owner/admin vía RLS de fila; baristas usan RPC enmascarada.

-- ---------------------------------------------------------------------
-- RLS (habilitada en todas las tablas; sin políticas de escritura)
-- ---------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.staff_members enable row level security;
alter table public.staff_branch_access enable row level security;
alter table public.customers enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_versions enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.nfc_devices enable row level security;
alter table public.ledger_events enable row level security;
alter table public.scan_tokens enable row level security;
alter table public.audit_log enable row level security;
alter table private.rate_limit_hits enable row level security;

create policy businesses_public_read on public.businesses for select to anon, authenticated using (true);
create policy branches_public_read on public.branches for select to anon, authenticated using (active);

create policy staff_read_self_or_admin on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));
create policy staff_access_read on public.staff_branch_access for select to authenticated
  using (
    exists (select 1 from public.staff_members sm where sm.id = staff_member_id and sm.user_id = (select auth.uid()))
    or private.has_role(business_id, array['owner', 'admin']::public.staff_role[])
  );

create policy customers_read_self_or_admin on public.customers for select to authenticated
  using (auth_user_id = (select auth.uid()) or private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

create policy cards_read_owner_or_staff on public.loyalty_cards for select to authenticated
  using (
    private.owns_card(id)
    or private.has_role(business_id, array['owner', 'admin', 'manager']::public.staff_role[])
  );

create policy campaigns_read_members on public.campaigns for select to authenticated using (true);
create policy campaign_versions_read on public.campaign_versions for select to authenticated using (true);
create policy products_read on public.products for select to authenticated
  using (active or private.has_role(business_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]));

create policy purchases_read_managers on public.purchases for select to authenticated
  using (private.can_operate_branch(branch_id, array['owner', 'admin', 'manager']::public.staff_role[]));
create policy purchase_items_read_managers on public.purchase_items for select to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.id = purchase_id and private.can_operate_branch(p.branch_id, array['owner', 'admin', 'manager']::public.staff_role[])
  ));

create policy nfc_read_staff on public.nfc_devices for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin', 'manager', 'barista']::public.staff_role[]));

-- El cliente consulta su historial por RPC (`get_my_card`), que oculta actor y hashes.
create policy ledger_read_managers on public.ledger_events for select to authenticated
  using (
    private.has_role(business_id, array['owner', 'admin']::public.staff_role[])
    or (branch_id is not null and private.can_operate_branch(branch_id, array['manager']::public.staff_role[]))
  );

create policy audit_read_admins on public.audit_log for select to authenticated
  using (business_id is not null and private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

-- scan_tokens y rate_limit_hits: sin políticas => sin acceso directo.
