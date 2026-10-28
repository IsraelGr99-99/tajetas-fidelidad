-- Ampliación idempotente de la DEMO aislada. Ejecutar DESPUÉS de seed.sql.
-- Solo cifras ficticias, sin clientes, empleados, tickets de caja ni credenciales.
-- Las ventas son importaciones sintéticas; no descuentan existencias.
begin;

do $$
begin
  if (select count(*) from public.businesses) <> 2
    or not exists (select 1 from public.businesses where id = '10000000-0000-4000-8000-000000000001' and slug = 'norte-barber-studio' and is_demo)
    or not exists (select 1 from public.businesses where id = '20000000-0000-4000-8000-000000000001' and slug = 'brisa-helados' and is_demo)
  then
    raise exception 'Ampliación DEMO cancelada: se requieren únicamente las dos empresas ficticias';
  end if;
end $$;

insert into public.products (business_id, name, base_name, variant_label, category, price_cents, cost_cents, eligible_for_stamp) values
  ('10000000-0000-4000-8000-000000000001', 'Fade moderno', null, null, 'Servicios', 26000, 5600, true),
  ('10000000-0000-4000-8000-000000000001', 'Corte infantil', null, null, 'Servicios', 18000, 4100, true),
  ('10000000-0000-4000-8000-000000000001', 'Afeitado clásico', null, null, 'Servicios', 19000, 4900, true),
  ('10000000-0000-4000-8000-000000000001', 'Tratamiento capilar', null, null, 'Servicios', 24000, 6600, true),
  ('10000000-0000-4000-8000-000000000001', 'Cera modeladora · 100 g', 'Cera modeladora', '100 g', 'Cuidado personal', 28000, 13600, false),
  ('10000000-0000-4000-8000-000000000001', 'Pomada mate · 50 g', 'Pomada mate', '50 g', 'Cuidado personal', 15500, 7100, false),
  ('10000000-0000-4000-8000-000000000001', 'Aceite para barba · 30 ml', 'Aceite para barba', '30 ml', 'Cuidado personal', 19500, 8800, false),
  ('10000000-0000-4000-8000-000000000001', 'Kit de cuidado de barba', null, null, 'Kits', 39000, 19000, false),
  ('20000000-0000-4000-8000-000000000001', 'Helado · Triple', 'Helado', 'Triple', 'Helados', 11500, 4300, true),
  ('20000000-0000-4000-8000-000000000001', 'Cono waffle de chocolate', null, null, 'Helados', 9800, 3700, true),
  ('20000000-0000-4000-8000-000000000001', 'Malteada · Fresa', 'Malteada', 'Fresa', 'Bebidas', 9400, 3500, true),
  ('20000000-0000-4000-8000-000000000001', 'Frappé de café', null, null, 'Bebidas', 8200, 3100, true),
  ('20000000-0000-4000-8000-000000000001', 'Banana split', null, null, 'Especialidades', 12900, 4800, true),
  ('20000000-0000-4000-8000-000000000001', 'Brownie con helado', null, null, 'Especialidades', 11900, 4600, true),
  ('20000000-0000-4000-8000-000000000001', 'Paleta artesanal · Frutos rojos', 'Paleta artesanal', 'Frutos rojos', 'Paletas', 5200, 1700, true),
  ('20000000-0000-4000-8000-000000000001', 'Sundae de caramelo', null, null, 'Especialidades', 9900, 3600, true)
on conflict (business_id, name) do nothing;

insert into public.stock_items (business_id, name, unit) values
  ('10000000-0000-4000-8000-000000000001', 'Toallas desechables', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Loción de afeitar', 'ml'),
  ('10000000-0000-4000-8000-000000000001', 'Tratamiento hidratante', 'ml'),
  ('10000000-0000-4000-8000-000000000001', 'Cera modeladora envasada 100 g', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Pomada mate envasada 50 g', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Aceite para barba envasado 30 ml', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Kit de cuidado envasado', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Base de helado de chocolate', 'g'),
  ('20000000-0000-4000-8000-000000000001', 'Fresas frescas', 'g'),
  ('20000000-0000-4000-8000-000000000001', 'Plátanos', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Brownies horneados', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Jarabe de caramelo', 'ml'),
  ('20000000-0000-4000-8000-000000000001', 'Paletas de frutos rojos', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Café concentrado', 'ml')
on conflict (business_id, name) do nothing;

insert into public.product_recipes (business_id, product_id, item_id, quantity)
select p.business_id, p.id, i.id, r.quantity
from (values
  ('Fade moderno', 'Cuchillas desechables', 1::numeric),
  ('Fade moderno', 'Toallas desechables', 1),
  ('Corte infantil', 'Cuchillas desechables', 1),
  ('Corte infantil', 'Toallas desechables', 1),
  ('Afeitado clásico', 'Cuchillas desechables', 2),
  ('Afeitado clásico', 'Loción de afeitar', 15),
  ('Afeitado clásico', 'Toallas desechables', 1),
  ('Tratamiento capilar', 'Champú profesional', 20),
  ('Tratamiento capilar', 'Tratamiento hidratante', 30),
  ('Tratamiento capilar', 'Toallas desechables', 1),
  ('Cera modeladora · 100 g', 'Cera modeladora envasada 100 g', 1),
  ('Pomada mate · 50 g', 'Pomada mate envasada 50 g', 1),
  ('Aceite para barba · 30 ml', 'Aceite para barba envasado 30 ml', 1),
  ('Kit de cuidado de barba', 'Kit de cuidado envasado', 1),
  ('Helado · Triple', 'Base de helado de vainilla', 240),
  ('Helado · Triple', 'Conos de waffle', 1),
  ('Cono waffle de chocolate', 'Base de helado de chocolate', 120),
  ('Cono waffle de chocolate', 'Conos de waffle', 1),
  ('Malteada · Fresa', 'Base de helado de vainilla', 120),
  ('Malteada · Fresa', 'Leche entera', 220),
  ('Malteada · Fresa', 'Fresas frescas', 70),
  ('Frappé de café', 'Leche entera', 180),
  ('Frappé de café', 'Café concentrado', 45),
  ('Banana split', 'Base de helado de vainilla', 210),
  ('Banana split', 'Plátanos', 1),
  ('Banana split', 'Jarabe de chocolate', 25),
  ('Brownie con helado', 'Brownies horneados', 1),
  ('Brownie con helado', 'Base de helado de vainilla', 110),
  ('Paleta artesanal · Frutos rojos', 'Paletas de frutos rojos', 1),
  ('Sundae de caramelo', 'Base de helado de vainilla', 160),
  ('Sundae de caramelo', 'Jarabe de caramelo', 35)
) as r(product_name, item_name, quantity)
join public.products p on p.name = r.product_name
join public.stock_items i on i.business_id = p.business_id and i.name = r.item_name
where p.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
on conflict (product_id, item_id) do nothing;

insert into public.stock_balances (business_id, branch_id, item_id, quantity, minimum)
select b.business_id, b.id, i.id,
  case i.unit when 'g' then 22000 when 'ml' then 12000 else 110 end
    - case when b.slug in ('angelopolis', 'la-paz') then
        case i.unit when 'g' then 3000 when 'ml' then 2000 else 15 end
      else 0 end,
  case i.unit when 'g' then 3500 when 'ml' then 2000 else 15 end
from public.branches b join public.stock_items i on i.business_id = b.business_id
where i.name in ('Toallas desechables', 'Loción de afeitar', 'Tratamiento hidratante',
  'Cera modeladora envasada 100 g', 'Pomada mate envasada 50 g', 'Aceite para barba envasado 30 ml',
  'Kit de cuidado envasado', 'Base de helado de chocolate', 'Fresas frescas', 'Plátanos',
  'Brownies horneados', 'Jarabe de caramelo', 'Paletas de frutos rojos', 'Café concentrado')
  and b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
on conflict (branch_id, item_id) do nothing;

-- Segundo reporte importado, etiquetado como sintético y separado del original.
insert into public.sales_imports (id, business_id, branch_id, file_name, row_count,
  total_cents, period_start, period_end, is_demo)
select case b.id
    when '10000000-0000-4000-8000-0000000000b1' then '10000000-0000-4000-8000-0000000000f3'::uuid
    when '10000000-0000-4000-8000-0000000000b2' then '10000000-0000-4000-8000-0000000000f4'::uuid
    when '20000000-0000-4000-8000-0000000000b1' then '20000000-0000-4000-8000-0000000000f3'::uuid
    else '20000000-0000-4000-8000-0000000000f4'::uuid end,
  b.business_id, b.id, 'catalogo-ampliado-sintetico.csv', count(*)::int,
  sum((1 + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) % 4)) * p.price_cents),
  current_date - 59, current_date, true
from public.branches b
join public.products p on p.business_id = b.business_id
  and p.name in ('Fade moderno', 'Corte infantil', 'Afeitado clásico', 'Tratamiento capilar',
    'Cera modeladora · 100 g', 'Pomada mate · 50 g', 'Aceite para barba · 30 ml', 'Kit de cuidado de barba',
    'Helado · Triple', 'Cono waffle de chocolate', 'Malteada · Fresa', 'Frappé de café',
    'Banana split', 'Brownie con helado', 'Paleta artesanal · Frutos rojos', 'Sundae de caramelo')
cross join generate_series(current_date - 59, current_date, interval '1 day') as d(day)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
group by b.id, b.business_id
on conflict (id) do nothing;

insert into public.sales_lines (import_id, business_id, branch_id, sold_on, product_id,
  product_name, category, quantity, total_cents, unit_cost_cents, is_demo)
select si.id, b.business_id, b.id, d.day::date, p.id, p.name, p.category,
  1 + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) % 4),
  (1 + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) % 4)) * p.price_cents,
  p.cost_cents, true
from public.sales_imports si
join public.branches b on b.id = si.branch_id
join public.products p on p.business_id = b.business_id
  and p.name in ('Fade moderno', 'Corte infantil', 'Afeitado clásico', 'Tratamiento capilar',
    'Cera modeladora · 100 g', 'Pomada mate · 50 g', 'Aceite para barba · 30 ml', 'Kit de cuidado de barba',
    'Helado · Triple', 'Cono waffle de chocolate', 'Malteada · Fresa', 'Frappé de café',
    'Banana split', 'Brownie con helado', 'Paleta artesanal · Frutos rojos', 'Sundae de caramelo')
cross join generate_series(si.period_start, si.period_end, interval '1 day') as d(day)
where si.id in ('10000000-0000-4000-8000-0000000000f3', '10000000-0000-4000-8000-0000000000f4',
  '20000000-0000-4000-8000-0000000000f3', '20000000-0000-4000-8000-0000000000f4')
  and not exists (select 1 from public.sales_lines l where l.import_id = si.id and l.sold_on = d.day::date and l.product_id = p.id);

insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo)
select b.business_id, b.id, d.day::date, x.category, x.description,
  case when b.business_id = '10000000-0000-4000-8000-000000000001' then x.barber_cents else x.helados_cents end, true
from public.branches b
join public.sales_imports si on si.branch_id = b.id and si.file_name = 'catalogo-ampliado-sintetico.csv'
cross join generate_series(si.period_start + 20, si.period_end, interval '30 days') as d(day)
cross join (values ('Marketing', 'Campaña local y material de mostrador', 95000::bigint, 78000::bigint),
                   ('Equipamiento', 'Mantenimiento de equipo', 120000::bigint, 135000::bigint))
  as x(category, description, barber_cents, helados_cents)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.expenses e where e.branch_id = b.id and e.spent_on = d.day::date
    and e.category = x.category and e.description = x.description);

commit;
