-- =====================================================================
-- Pases de Wallet (Google en el piloto; Apple después).
-- Metadatos de integración: qué tarjeta tiene pase, en qué versión del ledger
-- quedó sincronizado y el último error. Solo el servidor (service_role) los
-- escribe y lee: el navegador nunca habla con la API de Wallet.
-- El objeto de Google no lleva código escaneable: el QR de un solo uso vive en
-- /tarjeta; un código fijo en Wallet permitiría repetirlo.
-- =====================================================================

create table public.wallet_passes (
  card_id uuid not null references public.loyalty_cards (id) on delete cascade,
  platform text not null check (platform in ('google', 'apple')),
  business_id uuid not null references public.businesses (id) on delete restrict,
  object_id text not null unique check (length(object_id) <= 200),
  synced_version bigint,
  last_synced_at timestamptz,
  last_error text check (length(last_error) <= 300),
  created_at timestamptz not null default now(),
  primary key (card_id, platform)
);

alter table public.wallet_passes enable row level security;
revoke all on public.wallet_passes from anon, authenticated;
-- Sin políticas: inaccesible para anon/authenticated. service_role omite RLS.

-- Datos mínimos de la tarjeta para construir el pase (sin contacto del cliente).
create or replace function public.wallet_card_snapshot(p_card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'card_id', c.id,
    'public_serial', c.public_serial,
    'version', c.version,
    'stamps_balance', c.stamps_balance,
    'rewards_balance', c.rewards_balance,
    'display_name', cu.display_name,
    'customer_active', cu.status = 'active',
    'business_slug', b.slug,
    'business_name', b.name,
    'stamps_required', (private.current_campaign_version(c.business_id)).stamps_required,
    'reward_description', (private.current_campaign_version(c.business_id)).reward_description,
    'google_object_id', (select wp.object_id from public.wallet_passes wp where wp.card_id = c.id and wp.platform = 'google'),
    'google_synced_version', (select wp.synced_version from public.wallet_passes wp where wp.card_id = c.id and wp.platform = 'google')
  )
  from public.loyalty_cards c
  join public.customers cu on cu.id = c.customer_id
  join public.businesses b on b.id = c.business_id
  where c.id = p_card_id
$$;

create or replace function public.wallet_register_pass(p_card_id uuid, p_platform text, p_object_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.wallet_passes (card_id, platform, business_id, object_id)
  select c.id, p_platform, c.business_id, p_object_id from public.loyalty_cards c where c.id = p_card_id
  on conflict (card_id, platform) do nothing
$$;

create or replace function public.wallet_mark_synced(p_card_id uuid, p_platform text, p_version bigint, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.wallet_passes
    set synced_version = case when p_error is null then p_version else synced_version end,
        last_synced_at = case when p_error is null then now() else last_synced_at end,
        last_error = left(p_error, 300)
    where card_id = p_card_id and platform = p_platform
$$;

-- Tarjetas con pase desactualizado (para reintentos si un envío falló).
create or replace function public.wallet_stale_passes(p_limit integer default 50)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select wp.card_id
  from public.wallet_passes wp join public.loyalty_cards c on c.id = wp.card_id
  where wp.synced_version is distinct from c.version
  order by wp.last_synced_at nulls first
  limit least(greatest(coalesce(p_limit, 50), 1), 500)
$$;

revoke execute on function
  public.wallet_card_snapshot(uuid), public.wallet_register_pass(uuid, text, text),
  public.wallet_mark_synced(uuid, text, bigint, text), public.wallet_stale_passes(integer)
from public, anon, authenticated;
grant execute on function
  public.wallet_card_snapshot(uuid), public.wallet_register_pass(uuid, text, text),
  public.wallet_mark_synced(uuid, text, bigint, text), public.wallet_stale_passes(integer)
to service_role;
