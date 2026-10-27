-- Amplía exclusivamente el negocio piloto marcado como demo. No modifica
-- productos ni existencias existentes y puede repetirse sin duplicados.
insert into public.products (business_id, name, base_name, variant_label, category, price_cents, cost_cents, eligible_for_stamp)
select b.id, v.name, v.base_name, v.variant_label, v.category, v.price_cents, v.cost_cents, v.eligible
from public.businesses b
cross join (values
  ('Espresso (ejemplo)', null, null, 'Bebidas', 4500, 1100, true),
  ('Americano (ejemplo)', null, null, 'Bebidas', 5000, 1250, true),
  ('Capuchino (ejemplo)', null, null, 'Bebidas', 6500, 2300, true),
  ('Latte de temporada (ejemplo)', null, null, 'Bebidas', 7500, 2900, true),
  ('Concha artesanal (ejemplo)', null, null, 'Panadería', 3500, 1500, false),
  ('Americano · Grande (DEMO)', 'Americano', 'Grande', 'Bebidas', 6200, 1650, true),
  ('Latte · Chico (DEMO)', 'Latte', 'Chico', 'Bebidas', 6800, 2400, true),
  ('Latte · Grande (DEMO)', 'Latte', 'Grande', 'Bebidas', 7900, 3300, true),
  ('Chocolate caliente · Chico (DEMO)', 'Chocolate caliente', 'Chico', 'Bebidas', 6000, 2300, true),
  ('Chocolate caliente · Grande (DEMO)', 'Chocolate caliente', 'Grande', 'Bebidas', 7200, 3100, true),
  ('Té chai · Chico (DEMO)', 'Té chai', 'Chico', 'Bebidas', 6200, 2200, true),
  ('Té chai · Grande (DEMO)', 'Té chai', 'Grande', 'Bebidas', 7400, 2900, true),
  ('Cold brew (DEMO)', null, null, 'Bebidas frías', 7000, 1900, true),
  ('Croissant de mantequilla (DEMO)', null, null, 'Panadería', 4200, 1800, false),
  ('Galleta de avena (DEMO)', null, null, 'Panadería', 3000, 1200, false)
) as v(name, base_name, variant_label, category, price_cents, cost_cents, eligible)
where b.id = '00000000-0000-4000-8000-000000000001' and b.is_demo
on conflict (business_id, name) do nothing;

insert into public.stock_items (business_id, name, unit)
select b.id, v.name, v.unit
from public.businesses b
cross join (values
  ('Café molido (DEMO)', 'g'),
  ('Agua (DEMO)', 'ml'),
  ('Leche (DEMO)', 'ml'),
  ('Jarabe de temporada (DEMO)', 'ml'),
  ('Concha (DEMO)', 'pieza'),
  ('Chocolate en polvo (DEMO)', 'g'),
  ('Concentrado chai (DEMO)', 'ml'),
  ('Hielo (DEMO)', 'g'),
  ('Croissant (DEMO)', 'pieza'),
  ('Galleta de avena (DEMO)', 'pieza')
) as v(name, unit)
where b.id = '00000000-0000-4000-8000-000000000001' and b.is_demo
on conflict (business_id, name) do nothing;

insert into public.stock_balances (business_id, branch_id, item_id, quantity, minimum)
select i.business_id, b.id, i.id,
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
from public.stock_items i
join public.businesses business on business.id = i.business_id and business.is_demo
join public.branches b on b.business_id = i.business_id and b.id = '00000000-0000-4000-8000-0000000000b1'
where i.business_id = '00000000-0000-4000-8000-000000000001'
  and i.name in ('Café molido (DEMO)', 'Agua (DEMO)', 'Leche (DEMO)', 'Jarabe de temporada (DEMO)', 'Concha (DEMO)',
    'Chocolate en polvo (DEMO)', 'Concentrado chai (DEMO)', 'Hielo (DEMO)', 'Croissant (DEMO)', 'Galleta de avena (DEMO)')
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
join public.businesses b on b.id = p.business_id and b.is_demo
join public.stock_items i on i.business_id = p.business_id and i.name = recipe.item_name
on conflict (product_id, item_id) do nothing;
