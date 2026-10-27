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

-- Precios y costos son ficticios. Las variantes tienen precio y receta propios.
-- Idempotente: no pisa productos que ya se hayan modificado en el entorno.
insert into public.products (business_id, name, base_name, variant_label, category, price_cents, cost_cents, eligible_for_stamp) values
  ('00000000-0000-4000-8000-000000000001', 'Espresso (ejemplo)', null, null, 'Bebidas', 4500, 1100, true),
  ('00000000-0000-4000-8000-000000000001', 'Americano (ejemplo)', null, null, 'Bebidas', 5000, 1250, true),
  ('00000000-0000-4000-8000-000000000001', 'Capuchino (ejemplo)', null, null, 'Bebidas', 6500, 2300, true),
  ('00000000-0000-4000-8000-000000000001', 'Latte de temporada (ejemplo)', null, null, 'Bebidas', 7500, 2900, true),
  ('00000000-0000-4000-8000-000000000001', 'Concha artesanal (ejemplo)', null, null, 'Panadería', 3500, 1500, false),
  ('00000000-0000-4000-8000-000000000001', 'Americano · Grande (DEMO)', 'Americano', 'Grande', 'Bebidas', 6200, 1650, true),
  ('00000000-0000-4000-8000-000000000001', 'Latte · Chico (DEMO)', 'Latte', 'Chico', 'Bebidas', 6800, 2400, true),
  ('00000000-0000-4000-8000-000000000001', 'Latte · Grande (DEMO)', 'Latte', 'Grande', 'Bebidas', 7900, 3300, true),
  ('00000000-0000-4000-8000-000000000001', 'Chocolate caliente · Chico (DEMO)', 'Chocolate caliente', 'Chico', 'Bebidas', 6000, 2300, true),
  ('00000000-0000-4000-8000-000000000001', 'Chocolate caliente · Grande (DEMO)', 'Chocolate caliente', 'Grande', 'Bebidas', 7200, 3100, true),
  ('00000000-0000-4000-8000-000000000001', 'Té chai · Chico (DEMO)', 'Té chai', 'Chico', 'Bebidas', 6200, 2200, true),
  ('00000000-0000-4000-8000-000000000001', 'Té chai · Grande (DEMO)', 'Té chai', 'Grande', 'Bebidas', 7400, 2900, true),
  ('00000000-0000-4000-8000-000000000001', 'Cold brew (DEMO)', null, null, 'Bebidas frías', 7000, 1900, true),
  ('00000000-0000-4000-8000-000000000001', 'Croissant de mantequilla (DEMO)', null, null, 'Panadería', 4200, 1800, false),
  ('00000000-0000-4000-8000-000000000001', 'Galleta de avena (DEMO)', null, null, 'Panadería', 3000, 1200, false)
on conflict (business_id, name) do nothing;

-- Inventario de demostración para explorar caja local. Cantidades y recetas
-- ficticias; sustituir por conteo y ficha técnica reales antes del piloto.
insert into public.stock_items (business_id, name, unit) values
  ('00000000-0000-4000-8000-000000000001', 'Café molido (DEMO)', 'g'),
  ('00000000-0000-4000-8000-000000000001', 'Agua (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Leche (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Jarabe de temporada (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Concha (DEMO)', 'pieza'),
  ('00000000-0000-4000-8000-000000000001', 'Chocolate en polvo (DEMO)', 'g'),
  ('00000000-0000-4000-8000-000000000001', 'Concentrado chai (DEMO)', 'ml'),
  ('00000000-0000-4000-8000-000000000001', 'Hielo (DEMO)', 'g'),
  ('00000000-0000-4000-8000-000000000001', 'Croissant (DEMO)', 'pieza'),
  ('00000000-0000-4000-8000-000000000001', 'Galleta de avena (DEMO)', 'pieza')
on conflict (business_id, name) do nothing;

insert into public.stock_balances (business_id, branch_id, item_id, quantity, minimum)
select i.business_id, '00000000-0000-4000-8000-0000000000b1', i.id,
  case i.name when 'Café molido (DEMO)' then 3000 when 'Agua (DEMO)' then 100000
    when 'Leche (DEMO)' then 20000 when 'Jarabe de temporada (DEMO)' then 2000
    when 'Chocolate en polvo (DEMO)' then 2200 when 'Concentrado chai (DEMO)' then 3000
    when 'Hielo (DEMO)' then 12000 when 'Croissant (DEMO)' then 8
    when 'Galleta de avena (DEMO)' then 24 else 40 end,
  case i.name when 'Café molido (DEMO)' then 500 when 'Agua (DEMO)' then 10000
    when 'Leche (DEMO)' then 3000 when 'Jarabe de temporada (DEMO)' then 500
    when 'Chocolate en polvo (DEMO)' then 400 when 'Concentrado chai (DEMO)' then 500
    when 'Hielo (DEMO)' then 1500 when 'Croissant (DEMO)' then 10
    when 'Galleta de avena (DEMO)' then 6 else 10 end
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
  ('Concha artesanal (ejemplo)', 'Concha (DEMO)', 1),
  ('Americano · Grande (DEMO)', 'Café molido (DEMO)', 22),
  ('Americano · Grande (DEMO)', 'Agua (DEMO)', 240),
  ('Latte · Chico (DEMO)', 'Café molido (DEMO)', 18),
  ('Latte · Chico (DEMO)', 'Leche (DEMO)', 200),
  ('Latte · Grande (DEMO)', 'Café molido (DEMO)', 22),
  ('Latte · Grande (DEMO)', 'Leche (DEMO)', 300),
  ('Chocolate caliente · Chico (DEMO)', 'Chocolate en polvo (DEMO)', 25),
  ('Chocolate caliente · Chico (DEMO)', 'Leche (DEMO)', 200),
  ('Chocolate caliente · Grande (DEMO)', 'Chocolate en polvo (DEMO)', 35),
  ('Chocolate caliente · Grande (DEMO)', 'Leche (DEMO)', 300),
  ('Té chai · Chico (DEMO)', 'Concentrado chai (DEMO)', 100),
  ('Té chai · Chico (DEMO)', 'Leche (DEMO)', 150),
  ('Té chai · Grande (DEMO)', 'Concentrado chai (DEMO)', 150),
  ('Té chai · Grande (DEMO)', 'Leche (DEMO)', 220),
  ('Cold brew (DEMO)', 'Café molido (DEMO)', 25),
  ('Cold brew (DEMO)', 'Agua (DEMO)', 220),
  ('Cold brew (DEMO)', 'Hielo (DEMO)', 120),
  ('Croissant de mantequilla (DEMO)', 'Croissant (DEMO)', 1),
  ('Galleta de avena (DEMO)', 'Galleta de avena (DEMO)', 1)
) as recipe(product_name, item_name, quantity)
join public.products p on p.business_id = '00000000-0000-4000-8000-000000000001' and p.name = recipe.product_name
join public.stock_items i on i.business_id = p.business_id and i.name = recipe.item_name
on conflict (product_id, item_id) do nothing;
