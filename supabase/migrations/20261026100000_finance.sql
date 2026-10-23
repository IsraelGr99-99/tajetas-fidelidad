-- =====================================================================
-- Finanzas del negocio: costo por producto, ventas importadas del punto de
-- venta (POS), gastos, datos de demostración y dashboard.
-- Fuentes separadas y rotuladas: “ventas POS” (reporte importado) y “ventas con
-- tarjeta” (compras registradas en barra). No se mezclan ni se inventan cifras.
-- =====================================================================

alter table public.products add column cost_cents integer check (cost_cents >= 0 and cost_cents <= 1000000);
alter table public.branches add column is_demo boolean not null default false;

-- ---------------------------------------------------------------------
-- Ventas importadas
-- ---------------------------------------------------------------------
create table public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  file_name text not null check (length(file_name) between 1 and 200),
  row_count integer not null check (row_count > 0),
  total_cents bigint not null check (total_cents >= 0),
  period_start date not null,
  period_end date not null,
  is_demo boolean not null default false,
  imported_by uuid,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete cascade
);
create index sales_imports_business_idx on public.sales_imports (business_id, period_start);

create table public.sales_lines (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.sales_imports (id) on delete cascade,
  business_id uuid not null,
  branch_id uuid not null,
  sold_on date not null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null check (length(product_name) between 1 and 120),
  category text check (length(category) <= 60),
  quantity numeric(12, 2) not null check (quantity > 0 and quantity <= 100000),
  total_cents bigint not null check (total_cents >= 0),
  unit_cost_cents integer check (unit_cost_cents >= 0),
  is_demo boolean not null default false
);
create index sales_lines_business_day_idx on public.sales_lines (business_id, sold_on);
create index sales_lines_branch_day_idx on public.sales_lines (branch_id, sold_on);

-- ---------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  branch_id uuid,
  spent_on date not null,
  category text not null check (length(category) between 2 and 60),
  description text check (length(description) <= 200),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (branch_id, business_id) references public.branches (id, business_id) on delete cascade
);
create index expenses_business_day_idx on public.expenses (business_id, spent_on);

alter table public.sales_imports enable row level security;
alter table public.sales_lines enable row level security;
alter table public.expenses enable row level security;
grant select on public.sales_imports, public.sales_lines, public.expenses to authenticated;
create policy sales_imports_admin_read on public.sales_imports for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));
create policy sales_lines_admin_read on public.sales_lines for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));
create policy expenses_admin_read on public.expenses for select to authenticated
  using (private.has_role(business_id, array['owner', 'admin']::public.staff_role[]));

-- El costo del producto es información interna: el barista no lo necesita.
revoke select on public.products from authenticated;
grant select (id, business_id, name, category, price_cents, eligible_for_stamp, active, created_at, updated_at) on public.products to authenticated;

-- ---------------------------------------------------------------------
-- Catálogo: importación masiva (alta o actualización por nombre)
-- ---------------------------------------------------------------------
create or replace function public.bulk_upsert_products(p_business_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
  v_row record;
  v_existing uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'product.import', 'forbidden');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then
    return private.reject(p_business_id, 'product.import', 'invalid_request');
  end if;

  begin
    for v_row in
      select btrim(r.name) as name, btrim(r.category) as category, r.price_cents, r.cost_cents,
             coalesce(r.eligible, false) as eligible, coalesce(r.active, true) as active
      from jsonb_to_recordset(p_rows) as r(name text, category text, price_cents integer, cost_cents integer, eligible boolean, active boolean)
    loop
      select id into v_existing from public.products where business_id = p_business_id and lower(name) = lower(v_row.name);
      if v_existing is null then
        insert into public.products (business_id, name, category, price_cents, cost_cents, eligible_for_stamp, active)
        values (p_business_id, v_row.name, v_row.category, v_row.price_cents, v_row.cost_cents, v_row.eligible, v_row.active);
        v_inserted := v_inserted + 1;
      else
        update public.products
          set category = v_row.category, price_cents = v_row.price_cents, cost_cents = v_row.cost_cents,
              eligible_for_stamp = v_row.eligible, active = v_row.active
          where id = v_existing;
        v_updated := v_updated + 1;
      end if;
      v_existing := null;
    end loop;
  exception when others then
    -- Todo o nada: un renglón inválido revierte la importación completa.
    return private.reject(p_business_id, 'product.import', 'invalid_rows');
  end;

  perform private.audit(p_business_id, 'product.import', 'product', null, 'success',
    jsonb_build_object('inserted', v_inserted, 'updated', v_updated));
  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'updated', v_updated);
end;
$$;

-- Costo unitario en el alta/edición individual (la función original no lo tenía).
create or replace function public.set_product_cost(p_business_id uuid, p_product_id uuid, p_cost_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'product.cost', 'forbidden');
  end if;
  if p_cost_cents is not null and (p_cost_cents < 0 or p_cost_cents > 1000000) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  update public.products set cost_cents = p_cost_cents where id = p_product_id and business_id = p_business_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Catálogo completo para administración (incluye costo).
create or replace function public.admin_catalog(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'category', category, 'price_cents', price_cents, 'cost_cents', cost_cents,
      'eligible', eligible_for_stamp, 'active', active
    ) order by active desc, category, name)
    from public.products where business_id = p_business_id
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Ventas del POS
-- ---------------------------------------------------------------------
create or replace function public.import_sales(p_business_id uuid, p_branch_id uuid, p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.sales_imports;
  v_count integer;
  v_total bigint;
  v_start date;
  v_end date;
  v_matched integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'sales.import', 'forbidden');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and business_id = p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 10000 then
    return private.reject(p_business_id, 'sales.import', 'invalid_request');
  end if;
  if not private.rate_limit_allow('sales_import:' || auth.uid(), 30, 3600) then
    return private.reject(p_business_id, 'sales.import', 'rate_limited');
  end if;

  begin
    -- Sin tablas temporales (frágiles con el pooler): el JSON se lee directamente.
    select count(*), coalesce(sum(r.total_cents), 0), min(r.sold_on), max(r.sold_on) into v_count, v_total, v_start, v_end
    from jsonb_to_recordset(p_rows) as r(sold_on date, total_cents bigint);

    -- Mismo archivo dos veces (misma sucursal, periodo, renglones y total): se rechaza.
    if exists (
      select 1 from public.sales_imports
      where business_id = p_business_id and branch_id = p_branch_id and period_start = v_start and period_end = v_end
        and row_count = v_count and total_cents = v_total
    ) then
      return private.reject(p_business_id, 'sales.import', 'duplicate_import');
    end if;

    insert into public.sales_imports (business_id, branch_id, file_name, row_count, total_cents, period_start, period_end, imported_by)
    values (p_business_id, p_branch_id, left(btrim(p_file_name), 200), v_count, v_total, v_start, v_end, auth.uid())
    returning * into v_import;

    insert into public.sales_lines (import_id, business_id, branch_id, sold_on, product_id, product_name, category, quantity, total_cents, unit_cost_cents)
    select v_import.id, p_business_id, p_branch_id, r.sold_on, p.id, btrim(r.product_name),
           coalesce(nullif(btrim(coalesce(r.category, '')), ''), p.category), r.quantity, r.total_cents, p.cost_cents
    from jsonb_to_recordset(p_rows) as r(sold_on date, product_name text, category text, quantity numeric, total_cents bigint)
    left join public.products p on p.business_id = p_business_id and lower(p.name) = lower(btrim(r.product_name));
  exception when others then
    return private.reject(p_business_id, 'sales.import', 'invalid_rows');
  end;

  select count(*) into v_matched from public.sales_lines where import_id = v_import.id and product_id is not null;
  perform private.audit(p_business_id, 'sales.import', 'sales_import', v_import.id::text, 'success',
    jsonb_build_object('rows', v_count, 'matched', v_matched, 'branch_id', p_branch_id));
  return jsonb_build_object('ok', true, 'import_id', v_import.id, 'rows', v_count, 'matched', v_matched,
    'total_cents', v_total, 'period_start', v_start, 'period_end', v_end);
end;
$$;

create or replace function public.delete_sales_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.sales_imports;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_import from public.sales_imports where id = p_import_id;
  if not found or not private.is_admin(v_import.business_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  delete from public.sales_imports where id = p_import_id;
  perform private.audit(v_import.business_id, 'sales.import_delete', 'sales_import', p_import_id::text, 'success',
    jsonb_build_object('rows', v_import.row_count, 'file', v_import.file_name));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------
create or replace function public.add_expenses(p_business_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'expense.add', 'forbidden');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    return private.reject(p_business_id, 'expense.add', 'invalid_request');
  end if;
  begin
    insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, created_by)
    select p_business_id, r.branch_id, r.spent_on, btrim(r.category), nullif(btrim(coalesce(r.description, '')), ''), r.amount_cents, auth.uid()
    from jsonb_to_recordset(p_rows) as r(branch_id uuid, spent_on date, category text, description text, amount_cents bigint);
    get diagnostics v_count = row_count;
  exception when others then
    return private.reject(p_business_id, 'expense.add', 'invalid_rows');
  end;
  perform private.audit(p_business_id, 'expense.add', 'expense', null, 'success', jsonb_build_object('rows', v_count));
  return jsonb_build_object('ok', true, 'inserted', v_count);
end;
$$;

create or replace function public.delete_expense(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into v_expense from public.expenses where id = p_expense_id;
  if not found or not private.is_admin(v_expense.business_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  delete from public.expenses where id = p_expense_id;
  perform private.audit(v_expense.business_id, 'expense.delete', 'expense', p_expense_id::text, 'success',
    jsonb_build_object('amount_cents', v_expense.amount_cents, 'category', v_expense.category));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Datos de demostración (rotulados y removibles)
-- ---------------------------------------------------------------------
create or replace function public.generate_demo_finance(p_business_id uuid, p_days integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch record;
  v_demo_branch uuid;
  v_import uuid;
  v_days integer := least(greatest(coalesce(p_days, 60), 7), 180);
  v_start date;
  v_slug text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'demo.generate', 'forbidden');
  end if;
  if exists (select 1 from public.sales_imports where business_id = p_business_id and is_demo)
     or exists (select 1 from public.expenses where business_id = p_business_id and is_demo) then
    return jsonb_build_object('ok', false, 'code', 'demo_exists');
  end if;
  if not exists (select 1 from public.products where business_id = p_business_id and active and price_cents > 0) then
    return jsonb_build_object('ok', false, 'code', 'catalog_empty');
  end if;

  v_start := (now() at time zone 'America/Mexico_City')::date - (v_days - 1);
  perform setseed(0.42);

  -- Sucursal de comparación, inactiva para operar y marcada como demo.
  v_slug := 'demo-angelopolis';
  select id into v_demo_branch from public.branches where business_id = p_business_id and slug = v_slug;
  if v_demo_branch is null then
    insert into public.branches (business_id, slug, name, address, active, is_demo)
    values (p_business_id, v_slug, 'Angelópolis (DEMO)', 'Sucursal ficticia para la demostración', false, true)
    returning id into v_demo_branch;
  end if;

  for v_branch in
    select b.id, b.is_demo from public.branches b
    where b.business_id = p_business_id and (b.active or b.id = v_demo_branch)
  loop
    insert into public.sales_imports (business_id, branch_id, file_name, row_count, total_cents, period_start, period_end, is_demo, imported_by)
    values (p_business_id, v_branch.id, 'Datos de demostración', 1, 0, v_start, v_start + (v_days - 1), true, auth.uid())
    returning id into v_import;

    -- Ventas diarias por producto: más los fines de semana; la sucursal demo vende ~35 % menos.
    insert into public.sales_lines (import_id, business_id, branch_id, sold_on, product_id, product_name, category, quantity, total_cents, unit_cost_cents, is_demo)
    select v_import, p_business_id, v_branch.id, d::date, p.id, p.name, p.category, q.qty,
           q.qty * p.price_cents, coalesce(p.cost_cents, round(p.price_cents * 0.32)::integer), true
    from generate_series(v_start, v_start + (v_days - 1), interval '1 day') d
    cross join public.products p
    cross join lateral (
      select greatest(1, round(
        (case when p.eligible_for_stamp then 9 else 5 end)
        * (case when extract(isodow from d) in (6, 7) then 1.45 else 1 end)
        * (case when v_branch.is_demo then 0.65 else 1 end)
        * (0.6 + random() * 0.8)
      ))::numeric as qty
    ) q
    where p.business_id = p_business_id and p.active and p.price_cents > 0;

    update public.sales_imports si
      set row_count = s.n, total_cents = s.total
      from (select count(*) n, sum(total_cents) total from public.sales_lines where import_id = v_import) s
      where si.id = v_import;

    -- Gastos mensuales típicos y compras de insumos semanales.
    insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo, created_by)
    select p_business_id, v_branch.id, m::date, g.category, g.description,
           round(g.amount * (case when v_branch.is_demo then 0.8 else 1 end))::bigint, true, auth.uid()
    from generate_series(date_trunc('month', v_start::timestamp), v_start + (v_days - 1), interval '1 month') m
    cross join (values ('Renta', 'Renta del local', 1800000), ('Nómina', 'Sueldos del personal', 3200000),
                       ('Servicios', 'Luz, agua, gas e internet', 450000)) as g(category, description, amount)
    where m::date >= v_start;

    insert into public.expenses (business_id, branch_id, spent_on, category, description, amount_cents, is_demo, created_by)
    select p_business_id, v_branch.id, w::date, 'Insumos', 'Café de origen, leche y panadería',
           round((380000 + random() * 120000) * (case when v_branch.is_demo then 0.7 else 1 end))::bigint, true, auth.uid()
    from generate_series(v_start, v_start + (v_days - 1), interval '7 days') w;
  end loop;

  perform private.audit(p_business_id, 'demo.generate', null, null, 'success', jsonb_build_object('days', v_days));
  return jsonb_build_object('ok', true, 'days', v_days);
end;
$$;

create or replace function public.clear_demo_finance(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sales integer;
  v_expenses integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return private.reject(p_business_id, 'demo.clear', 'forbidden');
  end if;
  delete from public.sales_imports where business_id = p_business_id and is_demo;
  get diagnostics v_sales = row_count;
  delete from public.expenses where business_id = p_business_id and is_demo;
  get diagnostics v_expenses = row_count;
  -- La sucursal demo solo se borra si no tiene historial de fidelidad.
  delete from public.branches b
    where b.business_id = p_business_id and b.is_demo
      and not exists (select 1 from public.ledger_events e where e.branch_id = b.id)
      and not exists (select 1 from public.purchases pu where pu.branch_id = b.id);
  perform private.audit(p_business_id, 'demo.clear', null, null, 'success', jsonb_build_object('imports', v_sales, 'expenses', v_expenses));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------
create or replace function public.finance_dashboard(p_business_id uuid, p_from date, p_to date, p_include_demo boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_demo boolean := coalesce(p_include_demo, true);
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select timezone into v_tz from public.businesses where id = p_business_id;
  v_from := (p_from::timestamp at time zone v_tz);
  v_to := ((p_to + 1)::timestamp at time zone v_tz);

  return (
    with
    lines as (
      select l.*, b.name as branch_name
      from public.sales_lines l join public.branches b on b.id = l.branch_id
      where l.business_id = p_business_id and l.sold_on between p_from and p_to and (v_demo or not l.is_demo)
    ),
    exp as (
      select e.*, b.name as branch_name
      from public.expenses e left join public.branches b on b.id = e.branch_id
      where e.business_id = p_business_id and e.spent_on between p_from and p_to and (v_demo or not e.is_demo)
    ),
    card_sales as (
      select pu.*, b.name as branch_name, (pu.created_at at time zone v_tz)::date as day
      from public.purchases pu join public.branches b on b.id = pu.branch_id
      where pu.business_id = p_business_id and pu.status = 'completed' and pu.created_at >= v_from and pu.created_at < v_to
    ),
    totals as (
      select
        (select coalesce(sum(total_cents), 0) from lines) as pos_sales,
        (select coalesce(sum(quantity * unit_cost_cents), 0) from lines where unit_cost_cents is not null) as cogs,
        (select coalesce(sum(total_cents), 0) from lines where unit_cost_cents is not null) as revenue_with_cost,
        (select coalesce(sum(amount_cents), 0) from exp) as expenses,
        (select coalesce(sum(total_cents), 0) from card_sales) as card_sales,
        (select count(*) from card_sales) as card_visits
    )
    select jsonb_build_object(
      'ok', true,
      'from', p_from, 'to', p_to,
      'has_pos_data', exists (select 1 from lines),
      'has_demo', exists (select 1 from public.sales_lines where business_id = p_business_id and is_demo)
                  or exists (select 1 from public.expenses where business_id = p_business_id and is_demo),
      'totals', (select jsonb_build_object(
          'pos_sales_cents', pos_sales,
          'cogs_cents', round(cogs),
          'cost_coverage', case when pos_sales > 0 then round(revenue_with_cost::numeric / pos_sales, 3) else null end,
          'gross_profit_cents', pos_sales - round(cogs),
          'expenses_cents', expenses,
          'net_profit_cents', pos_sales - round(cogs) - expenses,
          'card_sales_cents', card_sales,
          'card_visits', card_visits,
          'card_share', case when pos_sales > 0 then round(card_sales::numeric / pos_sales, 3) else null end,
          'avg_card_ticket_cents', case when card_visits > 0 then round(card_sales::numeric / card_visits) else null end
        ) from totals),
      'loyalty', jsonb_build_object(
        'new_customers', (select count(*) from public.customers where business_id = p_business_id and created_at >= v_from and created_at < v_to),
        'redemptions', (select count(*) from public.ledger_events where business_id = p_business_id and event_type = 'redeem'
                        and occurred_at >= v_from and occurred_at < v_to),
        'rewards_outstanding', (select coalesce(sum(rewards_balance), 0) from public.loyalty_cards where business_id = p_business_id),
        'rewards_outstanding_value_cents', (
          select coalesce(sum(r.reward_value_cap_cents), 0) from public.ledger_events r
          where r.business_id = p_business_id and r.event_type = 'reward_issued'
            and not exists (select 1 from public.ledger_events x where x.related_event_id = r.id and x.event_type = 'reverse')
            and not exists (select 1 from public.ledger_events d where d.related_event_id = r.id and d.event_type = 'redeem'
                            and not exists (select 1 from public.ledger_events z where z.related_event_id = d.id and z.event_type = 'reverse'))
        )
      ),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day, 'pos_sales_cents', coalesce(s.total, 0), 'expenses_cents', coalesce(e.total, 0),
                                            'card_sales_cents', coalesce(c.total, 0)) order by d.day)
        from (select generate_series(p_from, p_to, interval '1 day')::date as day) d
        left join (select sold_on, sum(total_cents) total from lines group by sold_on) s on s.sold_on = d.day
        left join (select spent_on, sum(amount_cents) total from exp group by spent_on) e on e.spent_on = d.day
        left join (select day, sum(total_cents) total from card_sales group by day) c on c.day = d.day
      ), '[]'::jsonb),
      'top_products', coalesce((
        select jsonb_agg(t order by t.revenue_cents desc) from (
          select product_name as name, max(category) as category, sum(quantity) as quantity, sum(total_cents) as revenue_cents,
                 case when bool_and(unit_cost_cents is not null) then sum(total_cents) - round(sum(quantity * unit_cost_cents)) end as profit_cents
          from lines group by product_name order by sum(total_cents) desc limit 10
        ) t
      ), '[]'::jsonb),
      'by_branch', coalesce((
        select jsonb_agg(t order by t.pos_sales_cents desc) from (
          select b.id, b.name, b.is_demo,
                 coalesce((select sum(total_cents) from lines where branch_id = b.id), 0) as pos_sales_cents,
                 coalesce((select round(sum(quantity * unit_cost_cents)) from lines where branch_id = b.id and unit_cost_cents is not null), 0) as cogs_cents,
                 coalesce((select sum(amount_cents) from exp where branch_id = b.id), 0) as expenses_cents,
                 (select count(*) from card_sales where branch_id = b.id) as card_visits
          from public.branches b
          where b.business_id = p_business_id and (v_demo or not b.is_demo)
            and (b.active or exists (select 1 from lines where branch_id = b.id))
        ) t
      ), '[]'::jsonb),
      'by_category', coalesce((
        select jsonb_agg(t order by t.revenue_cents desc) from (
          select coalesce(category, 'Sin categoría') as category, sum(total_cents) as revenue_cents from lines group by 1
        ) t
      ), '[]'::jsonb),
      'expenses_by_category', coalesce((
        select jsonb_agg(t order by t.amount_cents desc) from (
          select category, sum(amount_cents) as amount_cents from exp group by category
        ) t
      ), '[]'::jsonb),
      'unallocated_expenses_cents', (select coalesce(sum(amount_cents), 0) from exp where branch_id is null)
    )
  );
end;
$$;

-- Listas para la pantalla de finanzas.
create or replace function public.finance_records(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  return jsonb_build_object(
    'ok', true,
    'imports', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'file_name', i.file_name, 'branch_name', b.name, 'row_count', i.row_count,
        'total_cents', i.total_cents, 'period_start', i.period_start, 'period_end', i.period_end, 'is_demo', i.is_demo,
        'created_at', i.created_at) order by i.created_at desc)
      from public.sales_imports i join public.branches b on b.id = i.branch_id
      where i.business_id = p_business_id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(t order by t.spent_on desc, t.created_at desc) from (
        select e.id, e.spent_on, e.category, e.description, e.amount_cents, e.is_demo, e.created_at, b.name as branch_name
        from public.expenses e left join public.branches b on b.id = e.branch_id
        where e.business_id = p_business_id
        order by e.spent_on desc, e.created_at desc limit 100
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function
  public.bulk_upsert_products(uuid, jsonb), public.set_product_cost(uuid, uuid, integer), public.admin_catalog(uuid),
  public.import_sales(uuid, uuid, text, jsonb), public.delete_sales_import(uuid),
  public.add_expenses(uuid, jsonb), public.delete_expense(uuid),
  public.generate_demo_finance(uuid, integer), public.clear_demo_finance(uuid),
  public.finance_dashboard(uuid, date, date, boolean), public.finance_records(uuid)
from public, anon;
grant execute on function
  public.bulk_upsert_products(uuid, jsonb), public.set_product_cost(uuid, uuid, integer), public.admin_catalog(uuid),
  public.import_sales(uuid, uuid, text, jsonb), public.delete_sales_import(uuid),
  public.add_expenses(uuid, jsonb), public.delete_expense(uuid),
  public.generate_demo_finance(uuid, integer), public.clear_demo_finance(uuid),
  public.finance_dashboard(uuid, date, date, boolean), public.finance_records(uuid)
to authenticated;
