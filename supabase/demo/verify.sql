-- Consulta de solo lectura para el proyecto Supabase DEMO.
-- Después de seed.sql + seed-rich.sql: por empresa, 2 sucursales,
-- 14 productos, 1680 líneas sintéticas, 60 gastos y 0 clientes.
select b.slug, b.name, b.is_demo,
  (select count(*) from public.branches br where br.business_id = b.id) as sucursales,
  (select count(*) from public.products p where p.business_id = b.id) as productos,
  (select count(*) from public.stock_items i where i.business_id = b.id) as insumos,
  (select count(*) from public.product_recipes r where r.business_id = b.id) as componentes_receta,
  (select count(*) from public.products p where p.business_id = b.id and not exists
    (select 1 from public.product_recipes r where r.product_id = p.id)) as productos_sin_receta,
  (select count(*) from public.sales_lines l where l.business_id = b.id and l.is_demo) as renglones_venta_simulada,
  (select count(*) from public.expenses e where e.business_id = b.id and e.is_demo) as gastos_simulados,
  (select count(*) from public.sales_imports i where i.business_id = b.id and
    (i.row_count <> (select count(*) from public.sales_lines l where l.import_id = i.id)
     or i.total_cents <> (select coalesce(sum(l.total_cents), 0) from public.sales_lines l where l.import_id = i.id))) as reportes_inconsistentes,
  (select count(*) from public.customers c where c.business_id = b.id) as clientes
from public.businesses b
order by b.slug;
