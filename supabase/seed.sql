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

-- Inventario de demostración para explorar caja local. Cantidades y recetas
-- ficticias; sustituir por conteo y ficha técnica reales antes del piloto.
insert into public.stock_items (business_id, name, unit) values
  ('00000000-0000-4000-8000-000000000001', 'Café molido (DEMO)', 'g'),
  ('00000000-0000-4000-8000-000000000001', 'Agua (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Leche (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Jarabe de temporada (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Concha (DEMO)', 'pieza')
on conflict (business_id, name) do nothing;

insert into public.stock_balances (business_id, branch_id, item_id, quantity, minimum)
select i.business_id, '00000000-0000-4000-8000-0000000000b1', i.id,
  case i.name when 'Café molido (DEMO)' then 3000 when 'Agua (DEMO)' then 100000
    when 'Leche (DEMO)' then 20000 when 'Jarabe de temporada (DEMO)' then 2000 else 40 end,
  case i.name when 'Café molido (DEMO)' then 500 when 'Agua (DEMO)' then 10000
    when 'Leche (DEMO)' then 3000 when 'Jarabe de temporada (DEMO)' then 500 else 10 end
from public.stock_items i where i.business_id = '00000000-0000-4000-8000-000000000001' and i.name like '%(DEMO)'
on conflict (branch_id, item_id) do nothing;

insert into public.product_recipes (business_id, product_id, item_id, quantity)
select p.business_id, p.id, i.id, recipe.quantity
from (values
  ('Espresso (ejemplo)', 'Café molido (DEMO)', 18::numeric),
  ('Americano (ejemplo)', 'Café molido (DEMO)', 18),
  ('Americano (ejemplo)', 'Agua (DEMO)', 150),
  ('Capuchino (ejemplo)', 'Café molido (DEMO)', 18),
  ('Capuchino (ejemplo)', 'Leche (DEMO)', 150),
  ('Latte de temporada (ejemplo)', 'Café molido (DEMO)', 18),
  ('Latte de temporada (ejemplo)', 'Leche (DEMO)', 250),
  ('Latte de temporada (ejemplo)', 'Jarabe de temporada (DEMO)', 25),
  ('Concha artesanal (ejemplo)', 'Concha (DEMO)', 1)
) as recipe(product_name, item_name, quantity)
join public.products p on p.business_id = '00000000-0000-4000-8000-000000000001' and p.name = recipe.product_name
join public.stock_items i on i.business_id = p.business_id and i.name = recipe.item_name
on conflict (product_id, item_id) do nothing;
