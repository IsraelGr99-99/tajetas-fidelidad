-- Café Nómada / Fidelidad
-- Ejecutar con Supabase CLI en un proyecto nuevo. No contiene datos reales.
create extension if not exists pgcrypto;

create type public.membership_role as enum ('owner', 'manager', 'staff');
create type public.ledger_event_type as enum ('earn', 'redeem', 'reverse', 'manual_adjustment');
create type public.ledger_event_status as enum ('accepted', 'rejected', 'reversed');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.business_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

create table public.branch_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  verified_email text,
  verified_phone text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verified_email is not null or verified_phone is not null),
  unique (business_id, auth_user_id)
);

create table public.campaign_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  stamps_required integer not null check (stamps_required between 1 and 100),
  reward_description text not null,
  reward_value_cap_mxn numeric(10,2) not null check (reward_value_cap_mxn >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.nfc_installations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  public_identifier text not null unique,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ledger_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  campaign_version_id uuid references public.campaign_versions(id) on delete restrict,
  event_type public.ledger_event_type not null,
  status public.ledger_event_status not null default 'accepted',
  stamps_delta integer not null check (stamps_delta between -100 and 100),
  purchase_reference_hash text,
  idempotency_key text not null,
  source text not null check (source in ('employee', 'admin', 'system')),
  reason text,
  validation jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  check (event_type = 'earn' and stamps_delta > 0 or event_type in ('redeem', 'reverse', 'manual_adjustment')),
  check (event_type not in ('reverse', 'manual_adjustment') or reason is not null)
);

create index ledger_events_customer_time_idx on public.ledger_events(customer_id, occurred_at desc);
create index ledger_events_business_time_idx on public.ledger_events(business_id, occurred_at desc);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_memberships
    where user_id = auth.uid() and business_id = target_business_id and active
  );
$$;

create or replace function public.is_branch_member(target_branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.branch_memberships bm
    join public.business_memberships bu on bu.user_id = bm.user_id and bu.active
    join public.branches b on b.id = bm.branch_id and b.business_id = bu.business_id
    where bm.user_id = auth.uid() and bm.branch_id = target_branch_id
  );
$$;

alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.business_memberships enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.customers enable row level security;
alter table public.campaign_versions enable row level security;
alter table public.nfc_installations enable row level security;
alter table public.ledger_events enable row level security;

create policy business_members_can_read_business on public.businesses for select using (public.is_business_member(id));
create policy business_members_can_read_branches on public.branches for select using (public.is_business_member(business_id));
create policy business_members_can_read_customers on public.customers for select using (public.is_business_member(business_id));
create policy business_members_can_read_campaigns on public.campaign_versions for select using (public.is_business_member(business_id));
create policy branch_members_can_read_nfc on public.nfc_installations for select using (public.is_branch_member(branch_id));
create policy branch_members_can_read_ledger on public.ledger_events for select using (public.is_branch_member(branch_id));

-- Las escrituras del ledger deben pasar por una función RPC transaccional del servidor.
-- No se expone INSERT/UPDATE/DELETE al cliente autenticado en esta etapa.
