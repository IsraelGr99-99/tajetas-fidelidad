-- Datos iniciales del piloto (solo entorno local / proyecto nuevo).
-- No contiene clientes ni personal reales. Los precios del catálogo son DE EJEMPLO
-- y deben sustituirse por los reales de Café Nómada antes del piloto.

insert into public.businesses (id, slug, name, timezone, currency, is_demo)
values ('00000000-0000-4000-8000-000000000001', 'cafe-nomada', 'Café Nómada', 'America/Mexico_City', 'MXN', true)
on conflict (id) do nothing;

insert into public.branches (id, business_id, slug, name, address)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'san-pedro-cholula',
        'San Pedro Cholula', 'San Pedro Cholula, Puebla (dirección por confirmar)')
on conflict (id) do nothing;

insert into public.campaigns (id, business_id, name)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'Bitácora del viajero')
on conflict (id) do nothing;

insert into public.campaign_versions (
  campaign_id, business_id, version, name, reward_description, stamps_required, stamps_per_purchase,
  reward_cap_kind, reward_cap_max_cents, min_seconds_between_earns, max_earns_per_day, change_reason, effective_from
)
select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 1, 'Bitácora del viajero',
       'Una bebida estándar de cortesía', 9, 1, 'min_eligible_item_in_completing_ticket', null, 600, 3,
       'Regla inicial del piloto', '2026-01-01T00:00:00-06:00'
where not exists (select 1 from public.campaign_versions where campaign_id = '00000000-0000-4000-8000-0000000000c1');

insert into public.products (business_id, name, category, price_cents, eligible_for_stamp) values
  ('00000000-0000-4000-8000-000000000001', 'Espresso (ejemplo)', 'Bebidas', 4500, true),
  ('00000000-0000-4000-8000-000000000001', 'Americano (ejemplo)', 'Bebidas', 5000, true),
  ('00000000-0000-4000-8000-000000000001', 'Capuchino (ejemplo)', 'Bebidas', 6500, true),
  ('00000000-0000-4000-8000-000000000001', 'Latte de temporada (ejemplo)', 'Bebidas', 7500, true),
  ('00000000-0000-4000-8000-000000000001', 'Concha artesanal (ejemplo)', 'Panadería', 3500, false)
on conflict (business_id, name) do nothing;
