-- =====================================================================
-- Café Nómada · Fidelidad — Esquema base multiempresa
-- Ledger append-only, campañas versionadas e integridad por empresa.
-- No contiene datos reales. Se aplica con `supabase db push`.
-- =====================================================================

create schema if not exists private;
comment on schema private is 'Funciones internas no expuestas por la API de datos (PostgREST).';

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'admin', 'manager', 'barista');
create type public.contact_channel as enum ('email', 'phone');
create type public.customer_status as enum ('active', 'deleted');
create type public.reward_cap_kind as enum ('min_eligible_item_in_completing_ticket', 'fixed');
create type public.purchase_status as enum ('completed', 'voided', 'refunded');
create type public.ledger_event_type as enum ('earn', 'reward_issued', 'redeem', 'reverse', 'manual_adjustment');
create type public.ledger_source as enum ('staff_qr', 'staff_lookup', 'staff_nfc', 'admin_console', 'system');
create type public.scan_token_purpose as enum ('identify', 'redeem');

-- ---------------------------------------------------------------------
-- Guardas genéricas
-- ---------------------------------------------------------------------
create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabla %.% es append-only: % no está permitido', tg_table_schema, tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Empresas, sucursales y personal
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name text not null check (length(name) between 2 and 120),
  timezone text not null default 'America/Mexico_City',
  currency char(3) not null default 'MXN',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name text not null check (length(name) between 2 and 120),
  address text check (length(address) <= 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, slug),
  unique (id, business_id)
);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  display_name text not null check (length(display_name) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (id, business_id)
);
create trigger staff_members_touch before update on public.staff_members
  for each row execute function private.touch_updated_at();

-- Acceso de gerentes y baristas a sucursales concretas. owner/admin acceden a todas.
create table public.staff_branch_access (
  staff_member_id uuid not null,
  branch_id uuid not null,
  business_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (staff_member_id, branch_id),
  foreign key (staff_member_id, business_id) references public.staff_members (id, business_id) on delete cascade,
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Clientes (PII mínima: un solo canal verificado) y tarjetas
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  auth_user_id uuid references auth.users (id) on delete set null,
  contact_channel public.contact_channel not null,
  contact_email text check (contact_email = lower(contact_email) and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email) <= 254),
  contact_phone text check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text check (length(display_name) between 1 and 40),
  verified_at timestamptz not null,
  status public.customer_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  -- Exactamente el canal elegido; ningún dato de contacto tras la eliminación.
  check (
    (status = 'deleted' and contact_email is null and contact_phone is null and display_name is null and deleted_at is not null)
    or (status = 'active' and contact_channel = 'email' and contact_email is not null and contact_phone is null)
    or (status = 'active' and contact_channel = 'phone' and contact_phone is not null and contact_email is null)
  )
);
create unique index customers_business_auth_user_uq on public.customers (business_id, auth_user_id) where auth_user_id is not null;
create unique index customers_business_email_uq on public.customers (business_id, contact_email) where contact_email is not null;
create unique index customers_business_phone_uq on public.customers (business_id, contact_phone) where contact_phone is not null;
create trigger customers_touch before update on public.customers
  for each row execute function private.touch_updated_at();

-- Proyección de saldos. Solo la modifican funciones transaccionales que también
-- escriben el ledger; `private.verify_card_projection` permite recalcularla.
create table public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null unique,
  -- Identificador público estable y aleatorio (serial de Wallet). No es secreto ni contiene PII.
  public_serial text not null unique default replace(gen_random_uuid()::text, '-', ''),
  stamps_balance integer not null default 0 check (stamps_balance >= 0),
  rewards_balance integer not null default 0 check (rewards_balance >= 0),
  last_earn_at timestamptz,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict
);
create trigger loyalty_cards_touch before update on public.loyalty_cards
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Campañas versionadas (cada cambio crea una versión inmutable)
-- ---------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  name text not null check (length(name) between 3 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index campaigns_one_active_per_business on public.campaigns (business_id) where is_active;

create table public.campaign_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  business_id uuid not null,
  version integer not null check (version >= 1),
  name text not null check (length(name) between 3 and 80),
  reward_description text not null check (length(reward_description) between 3 and 160),
  stamps_required integer not null check (stamps_required between 1 and 50),
  stamps_per_purchase integer not null default 1 check (stamps_per_purchase between 1 and 5),
  reward_cap_kind public.reward_cap_kind not null,
  reward_cap_max_cents integer check (reward_cap_max_cents > 0 and reward_cap_max_cents <= 1000000),
  min_seconds_between_earns integer not null default 600 check (min_seconds_between_earns between 0 and 86400),
  max_earns_per_day integer not null default 3 check (max_earns_per_day between 1 and 20),
  effective_from timestamptz not null default now(),
  change_reason text check (length(change_reason) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (id, business_id),
  foreign key (campaign_id, business_id) references public.campaigns (id, business_id) on delete restrict,
  check (reward_cap_kind <> 'fixed' or reward_cap_max_cents is not null)
);
create trigger campaign_versions_append_only before update or delete on public.campaign_versions
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------------
-- Catálogo y compras (precios siempre desde el servidor)
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  name text not null check (length(name) between 2 and 80),
  category text not null check (length(category) between 2 and 40),
  price_cents integer not null check (price_cents >= 0 and price_cents <= 1000000),
  eligible_for_stamp boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, name)
);
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  card_id uuid not null,
  -- HMAC-SHA256 del folio del ticket calculado en servidor con un pepper secreto.
  reference_hash text not null check (reference_hash ~ '^[a-f0-9]{64}$'),
  status public.purchase_status not null default 'completed',
  total_cents integer not null check (total_cents >= 0),
  eligible_units integer not null check (eligible_units >= 0),
  min_eligible_price_cents integer check (min_eligible_price_cents >= 0),
  recorded_by_staff_id uuid not null,
  status_reason text check (length(status_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reference_hash),
  unique (id, business_id),
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete restrict,
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete restrict,
  foreign key (recorded_by_staff_id, business_id) references public.staff_members (id, business_id) on delete restrict
);
create trigger purchases_touch before update on public.purchases
  for each row execute function private.touch_updated_at();

create table public.purchase_items (
  id bigint generated always as identity primary key,
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20),
  complimentary boolean not null default false,
  counts_for_stamp boolean not null
);
create trigger purchase_items_append_only before update or delete on public.purchase_items
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------------
-- Sellos físicos NFC (el identificador es público y NO autoriza nada por sí solo)
-- ---------------------------------------------------------------------
create table public.nfc_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9_-]{22,64}$'),
  label text not null check (length(label) between 2 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete restrict
);

-- ---------------------------------------------------------------------
-- Ledger append-only
-- ---------------------------------------------------------------------
create table public.ledger_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid,
  card_id uuid not null,
  customer_id uuid not null,
  campaign_version_id uuid,
  event_type public.ledger_event_type not null,
  stamps_delta integer not null default 0 check (stamps_delta between -100 and 100),
  rewards_delta integer not null default 0 check (rewards_delta between -1 and 1),
  purchase_id uuid,
  purchase_reference_hash text check (purchase_reference_hash ~ '^[a-f0-9]{64}$'),
  related_event_id uuid references public.ledger_events (id) on delete restrict,
  reward_value_cap_cents integer check (reward_value_cap_cents >= 0),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9:_-]{8,120}$'),
  source public.ledger_source not null,
  -- Sin FK a auth.users: el historial no debe cambiar si se elimina una cuenta.
  actor_user_id uuid,
  actor_staff_id uuid,
  nfc_device_id uuid,
  reason text check (length(reason) between 5 and 300),
  validation jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete restrict,
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete restrict,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict,
  foreign key (campaign_version_id, business_id) references public.campaign_versions (id, business_id) on delete restrict,
  foreign key (purchase_id, business_id) references public.purchases (id, business_id) on delete restrict,
  foreign key (nfc_device_id, business_id) references public.nfc_devices (id, business_id) on delete restrict,
  check (
    case event_type
      when 'earn' then stamps_delta > 0 and rewards_delta = 0 and purchase_id is not null and branch_id is not null
      when 'reward_issued' then stamps_delta < 0 and rewards_delta = 1 and reward_value_cap_cents is not null and related_event_id is not null
      when 'redeem' then stamps_delta = 0 and rewards_delta = -1 and related_event_id is not null and branch_id is not null
      when 'reverse' then related_event_id is not null and reason is not null
      when 'manual_adjustment' then stamps_delta <> 0 and rewards_delta = 0 and reason is not null
    end
  )
);
-- Una compra solo puede acreditar una vez y un evento solo se revierte una vez.
-- El doble canje se impide por el bloqueo FOR UPDATE de la tarjeta más
-- `rewards_balance >= 0`; no hay índice único por recompensa porque un canje
-- revertido debe permitir volver a canjear esa misma recompensa.
create unique index ledger_one_earn_per_purchase on public.ledger_events (purchase_id) where event_type = 'earn';
create index ledger_related_event_idx on public.ledger_events (related_event_id) where related_event_id is not null;
create unique index ledger_one_reverse_per_event on public.ledger_events (related_event_id) where event_type = 'reverse';
create index ledger_card_time_idx on public.ledger_events (card_id, occurred_at desc);
create index ledger_business_time_idx on public.ledger_events (business_id, occurred_at desc);
create index ledger_branch_time_idx on public.ledger_events (branch_id, occurred_at desc);

create trigger ledger_events_append_only before update or delete on public.ledger_events
  for each row execute function private.forbid_mutation();
create trigger ledger_events_no_truncate before truncate on public.ledger_events
  for each statement execute function private.forbid_mutation();

-- ---------------------------------------------------------------------
-- Códigos QR temporales de un solo uso (se guarda solo el hash)
-- ---------------------------------------------------------------------
create table public.scan_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  card_id uuid not null,
  purpose public.scan_token_purpose not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_staff_id uuid,
  created_at timestamptz not null default now(),
  foreign key (card_id, business_id) references public.loyalty_cards (id, business_id) on delete cascade,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);
create index scan_tokens_card_idx on public.scan_tokens (card_id, created_at desc);
create index scan_tokens_expiry_idx on public.scan_tokens (expires_at);

-- ---------------------------------------------------------------------
-- Rate limiting en base de datos (ventana fija), sin servicios externos
-- ---------------------------------------------------------------------
create table private.rate_limit_hits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------------
-- Auditoría append-only (sin secretos, tokens ni PII completa)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id) on delete restrict,
  actor_user_id uuid,
  actor_role text,
  action text not null check (length(action) <= 80),
  entity_type text check (length(entity_type) <= 60),
  entity_id text check (length(entity_id) <= 120),
  outcome text not null check (outcome in ('success', 'denied', 'rejected', 'error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_business_time_idx on public.audit_log (business_id, created_at desc);
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function private.forbid_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.forbid_mutation();
