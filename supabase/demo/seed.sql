-- Solo para un proyecto Supabase NUEVO y aislado de demostración.
-- No ejecutar sobre el proyecto del piloto. No contiene PII ni credenciales.
-- Las cifras son sintéticas: is_demo=true conserva esa procedencia en reportes.

begin;

do $$
begin
  if exists (
    select 1 from public.businesses
    where id not in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
  ) then
    raise exception 'Seed DEMO cancelado: este proyecto contiene otras empresas';
  end if;
end $$;

insert into public.businesses (id, slug, name, timezone, currency, is_demo,
  card_background_color, card_secondary_color, card_text_color) values
  ('10000000-0000-4000-8000-000000000001', 'norte-barber-studio', 'Norte Barber Studio', 'America/Mexico_City', 'MXN', true, '#17243D', '#67D7CF', '#FFFFFF'),
  ('20000000-0000-4000-8000-000000000001', 'brisa-helados', 'Brisa Helados', 'America/Mexico_City', 'MXN', true, '#234D68', '#FFD48D', '#FFFFFF')
on conflict (id) do nothing;

insert into public.branches (id, business_id, slug, name, address) values
  ('10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 'centro', 'Centro', 'Centro, Puebla, Pue.'),
  ('10000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000001', 'angelopolis', 'Angelópolis', 'Angelópolis, Puebla, Pue.'),
  ('20000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001', 'cholula', 'Cholula', 'San Pedro Cholula, Pue.'),
  ('20000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-000000000001', 'la-paz', 'La Paz', 'Col. La Paz, Puebla, Pue.')
on conflict (id) do nothing;

insert into public.campaigns (id, business_id, name) values
  ('10000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001', 'Cortes que cuentan'),
  ('20000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001', 'Momentos de sabor')
on conflict (id) do nothing;

insert into public.campaign_versions (campaign_id, business_id, version, name, reward_description,
  stamps_required, stamps_per_purchase, reward_cap_kind, min_seconds_between_earns,
  max_earns_per_day, change_reason, effective_from)
select c.id, c.business_id, 1, c.name,
  case c.business_id when '10000000-0000-4000-8000-000000000001' then 'Un arreglo de barba de cortesía'
    else 'Una bola de helado de cortesía' end,
  case c.business_id when '10000000-0000-4000-8000-000000000001' then 6 else 8 end,
  1, 'min_eligible_item_in_completing_ticket', 600, 3,
  'Configuración inicial del programa', now() - interval '90 days'
from public.campaigns c
where c.id in ('10000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-0000000000c1')
  and not exists (select 1 from public.campaign_versions v where v.campaign_id = c.id);

-- Catálogo, costos y variantes coherentes con cada giro.
insert into public.products (business_id, name, base_name, variant_label, category, price_cents, cost_cents, eligible_for_stamp) values
  ('10000000-0000-4000-8000-000000000001', 'Corte clásico', null, null, 'Servicios', 22000, 4800, true),
  ('10000000-0000-4000-8000-000000000001', 'Corte y barba', null, null, 'Servicios', 32000, 7200, true),
  ('10000000-0000-4000-8000-000000000001', 'Arreglo de barba', null, null, 'Servicios', 14000, 3500, true),
  ('10000000-0000-4000-8000-000000000001', 'Lavado capilar', null, null, 'Servicios', 9000, 1800, false),
  ('10000000-0000-4000-8000-000000000001', 'Cera modeladora · 50 g', 'Cera modeladora', '50 g', 'Cuidado personal', 18000, 8200, false),
  ('10000000-0000-4000-8000-000000000001', 'Pomada mate · 100 g', 'Pomada mate', '100 g', 'Cuidado personal', 24000, 11800, false),
  ('20000000-0000-4000-8000-000000000001', 'Helado · Sencillo', 'Helado', 'Sencillo', 'Helados', 5200, 1600, true),
  ('20000000-0000-4000-8000-000000000001', 'Helado · Doble', 'Helado', 'Doble', 'Helados', 8500, 2900, true),
  ('20000000-0000-4000-8000-000000000001', 'Malteada · Vainilla', 'Malteada', 'Vainilla', 'Bebidas', 8900, 3100, true),
  ('20000000-0000-4000-8000-000000000001', 'Malteada · Chocolate', 'Malteada', 'Chocolate', 'Bebidas', 9400, 3400, true),
  ('20000000-0000-4000-8000-000000000001', 'Sundae de frutos rojos', null, null, 'Especialidades', 10500, 3900, true),
  ('20000000-0000-4000-8000-000000000001', 'Paleta artesanal · Mango', 'Paleta artesanal', 'Mango', 'Paletas', 4800, 1500, true)
on conflict (business_id, name) do nothing;

insert into public.stock_items (business_id, name, unit) values
  ('10000000-0000-4000-8000-000000000001', 'Cuchillas desechables', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Champú profesional', 'ml'),
  ('10000000-0000-4000-8000-000000000001', 'Bálsamo para barba', 'ml'),
  ('10000000-0000-4000-8000-000000000001', 'Cera modeladora envasada', 'pieza'),
  ('10000000-0000-4000-8000-000000000001', 'Pomada mate envasada', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Base de helado de vainilla', 'g'),
  ('20000000-0000-4000-8000-000000000001', 'Leche entera', 'ml'),
  ('20000000-0000-4000-8000-000000000001', 'Conos de waffle', 'pieza'),
  ('20000000-0000-4000-8000-000000000001', 'Jarabe de chocolate', 'ml'),
  ('20000000-0000-4000-8000-000000000001', 'Salsa de frutos rojos', 'g'),
  ('20000000-0000-4000-8000-000000000001', 'Paletas de mango', 'pieza')
on conflict (business_id, name) do nothing;

insert into public.product_recipes (business_id, product_id, item_id, quantity)
select p.business_id, p.id, i.id, r.quantity
from (values
  ('Corte clásico', 'Cuchillas desechables', 1::numeric),
  ('Corte y barba', 'Cuchillas desechables', 2),
  ('Corte y barba', 'Bálsamo para barba', 8),
  ('Arreglo de barba', 'Cuchillas desechables', 1),
  ('Arreglo de barba', 'Bálsamo para barba', 8),
  ('Lavado capilar', 'Champú profesional', 20),
  ('Cera modeladora · 50 g', 'Cera modeladora envasada', 1),
  ('Pomada mate · 100 g', 'Pomada mate envasada', 1),
  ('Helado · Sencillo', 'Base de helado de vainilla', 90),
  ('Helado · Sencillo', 'Conos de waffle', 1),
  ('Helado · Doble', 'Base de helado de vainilla', 160),
  ('Helado · Doble', 'Conos de waffle', 1),
  ('Malteada · Vainilla', 'Base de helado de vainilla', 120),
  ('Malteada · Vainilla', 'Leche entera', 220),
  ('Malteada · Chocolate', 'Base de helado de vainilla', 120),
  ('Malteada · Chocolate', 'Leche entera', 220),
  ('Malteada · Chocolate', 'Jarabe de chocolate', 25),
  ('Sundae de frutos rojos', 'Base de helado de vainilla', 160),
  ('Sundae de frutos rojos', 'Salsa de frutos rojos', 40),
  ('Paleta artesanal · Mango', 'Paletas de mango', 1)
) as r(product_name, item_name, quantity)
join public.products p on p.name = r.product_name
join public.stock_items i on i.business_id = p.business_id and i.name = r.item_name
where p.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
on conflict (product_id, item_id) do nothing;

insert into public.stock_balances (business_id, branch_id, item_id, quantity, minimum)
select b.business_id, b.id, i.id,
  case i.unit when 'g' then 24000 when 'ml' then 18000 else 90 end
    - case when b.slug in ('angelopolis', 'la-paz') then
        case i.unit when 'g' then 3500 when 'ml' then 3500 else 12 end
      else 0 end,
  case i.unit when 'g' then 4000 when 'ml' then 3000 else 15 end
from public.branches b join public.stock_items i on i.business_id = b.business_id
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
on conflict (branch_id, item_id) do nothing;

-- 60 días de reportes sintéticos. No son tickets de caja ni ventas reales.
insert into public.sales_imports (id, business_id, branch_id, file_name, row_count,
  total_cents, period_start, period_end, is_demo)
select case b.id
    when '10000000-0000-4000-8000-0000000000b1' then '10000000-0000-4000-8000-0000000000f1'::uuid
    when '10000000-0000-4000-8000-0000000000b2' then '10000000-0000-4000-8000-0000000000f2'::uuid
    when '20000000-0000-4000-8000-0000000000b1' then '20000000-0000-4000-8000-0000000000f1'::uuid
    else '20000000-0000-4000-8000-0000000000f2'::uuid end,
  b.business_id, b.id, 'historial-sintetico-inicial.csv', 360,
  sum((case when b.business_id = '20000000-0000-4000-8000-000000000001' then 2 else 1 end
    + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) %
       case when b.business_id = '20000000-0000-4000-8000-000000000001' then 6 else 5 end)) * p.price_cents),
  current_date - 59, current_date, true
from public.branches b
join public.products p on p.business_id = b.business_id
cross join generate_series(current_date - 59, current_date, interval '1 day') as d(day)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
group by b.id, b.business_id
on conflict (id) do nothing;

insert into public.sales_lines (import_id, business_id, branch_id, sold_on, product_id,
  product_name, category, quantity, total_cents, unit_cost_cents, is_demo)
select si.id, b.business_id, b.id, d.day::date, p.id, p.name, p.category,
  (case when b.business_id = '20000000-0000-4000-8000-000000000001' then 2 else 1 end
    + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) %
       case when b.business_id = '20000000-0000-4000-8000-000000000001' then 6 else 5 end)),
  (case when b.business_id = '20000000-0000-4000-8000-000000000001' then 2 else 1 end
    + ((extract(doy from d.day)::int + length(p.name) + length(b.name)) %
       case when b.business_id = '20000000-0000-4000-8000-000000000001' then 6 else 5 end)) * p.price_cents,
  p.cost_cents, true
from public.sales_imports si
join public.branches b on b.id = si.branch_id
join public.products p on p.business_id = b.business_id
cross join generate_series(si.period_start, si.period_end, interval '1 day') as d(day)
where si.id in ('10000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000f2',
                '20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000f2')
  and not exists (select 1 from public.sales_lines l where l.import_id = si.id and l.sold_on = d.day::date and l.product_id = p.id);

insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo)
select b.business_id, b.id, d.day::date, x.category, x.description,
  (case when b.business_id = '10000000-0000-4000-8000-000000000001' then x.barber_cents else x.helados_cents end)
    + case when b.slug in ('angelopolis', 'la-paz') then 25000 else 0 end, true
from public.branches b
join public.sales_imports si on si.branch_id = b.id and si.file_name = 'historial-sintetico-inicial.csv'
cross join generate_series(si.period_start + 3, si.period_end, interval '7 days') as d(day)
cross join (values ('Insumos', 'Reposición semanal de insumos', 180000::bigint, 125000::bigint),
                   ('Servicios', 'Servicios y mantenimiento', 55000::bigint, 45000::bigint))
  as x(category, description, barber_cents, helados_cents)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.expenses e where e.branch_id = b.id and e.spent_on = d.day::date
    and e.category = x.category and e.description = x.description);

insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo)
select b.business_id, b.id, d.day::date, 'Nómina', 'Pago quincenal de personal',
  case when b.business_id = '10000000-0000-4000-8000-000000000001' then 800000 else 600000 end, true
from public.branches b
join public.sales_imports si on si.branch_id = b.id and si.file_name = 'historial-sintetico-inicial.csv'
cross join generate_series(si.period_start + 14, si.period_end, interval '15 days') as d(day)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.expenses e where e.branch_id = b.id and e.spent_on = d.day::date and e.category = 'Nómina');

insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo)
select b.business_id, b.id, d.day::date, x.category, x.description,
  case when b.business_id = '10000000-0000-4000-8000-000000000001' then x.barber_cents else x.helados_cents end, true
from public.branches b
join public.sales_imports si on si.branch_id = b.id and si.file_name = 'historial-sintetico-inicial.csv'
cross join generate_series(si.period_start + 29, si.period_end, interval '30 days') as d(day)
cross join (values ('Renta', 'Renta mensual de local', 1000000::bigint, 700000::bigint),
                   ('Servicios', 'Electricidad y agua', 200000::bigint, 150000::bigint))
  as x(category, description, barber_cents, helados_cents)
where b.business_id in ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.expenses e where e.branch_id = b.id and e.spent_on = d.day::date
    and e.category = x.category and e.description = x.description);

-- El propietario y el equipo se vinculan DESPUÉS de crear usuarios con Supabase Auth.
-- Nunca insertar directamente en auth.users ni inventar credenciales en este archivo.

commit;
