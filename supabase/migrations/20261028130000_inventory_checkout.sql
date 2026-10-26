-- Inventario por sucursal y ventas de caja. El stock solo cambia en RPC
-- transaccionales; movimientos y renglones de venta son inmutables.
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (length(name) between 2 and 100),
  unit text not null check (unit in ('pieza', 'g', 'kg', 'ml', 'l')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table public.stock_balances (
  business_id uuid not null,
  branch_id uuid not null,
  item_id uuid not null,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  minimum numeric(14,3) not null default 0 check (minimum >= 0),
  updated_at timestamptz not null default now(),
  primary key (branch_id, item_id),
  foreign key (branch_id, business_id) references public.branches(id, business_id) on delete restrict,
  foreign key (item_id, business_id) references public.stock_items(id, business_id) on delete restrict
);

create table public.product_recipes (
  business_id uuid not null,
  product_id uuid not null,
  item_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  primary key (product_id, item_id),
  foreign key (product_id, business_id) references public.products(id, business_id) on delete restrict,
  foreign key (item_id, business_id) references public.stock_items(id, business_id) on delete restrict
);

create table public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  staff_member_id uuid not null,
  idempotency_key uuid not null,
  payment_method text not null check (payment_method in ('cash', 'card_manual', 'transfer_manual')),
  total_cents integer not null check (total_cents >= 0 and total_cents <= 100000000),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (branch_id, business_id) references public.branches(id, business_id) on delete restrict,
  foreign key (staff_member_id, business_id) references public.staff_members(id, business_id) on delete restrict
);

create table public.pos_sale_lines (
  sale_id uuid not null,
  business_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 100),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  primary key (sale_id, product_id),
  foreign key (sale_id, business_id) references public.pos_sales(id, business_id) on delete restrict,
  foreign key (product_id, business_id) references public.products(id, business_id) on delete restrict
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  branch_id uuid not null,
  item_id uuid not null,
  sale_id uuid,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason text not null check (length(reason) between 3 and 200),
  actor_staff_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (branch_id, business_id) references public.branches(id, business_id) on delete restrict,
  foreign key (item_id, business_id) references public.stock_items(id, business_id) on delete restrict,
  foreign key (sale_id, business_id) references public.pos_sales(id, business_id) on delete restrict,
  foreign key (actor_staff_id, business_id) references public.staff_members(id, business_id) on delete restrict
);

create trigger pos_sales_append_only before update or delete on public.pos_sales
  for each row execute function private.forbid_mutation();
create trigger pos_sale_lines_append_only before update or delete on public.pos_sale_lines
  for each row execute function private.forbid_mutation();
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function private.forbid_mutation();

alter table public.stock_items enable row level security;
alter table public.stock_balances enable row level security;
alter table public.product_recipes enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_lines enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.stock_items, public.stock_balances, public.product_recipes,
  public.pos_sales, public.pos_sale_lines, public.stock_movements from public, anon, authenticated;
grant select on public.stock_items, public.stock_balances, public.product_recipes,
  public.pos_sales, public.pos_sale_lines, public.stock_movements to authenticated;
create policy stock_items_admin_read on public.stock_items for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));
create policy stock_balances_admin_read on public.stock_balances for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));
create policy product_recipes_admin_read on public.product_recipes for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));
create policy pos_sales_admin_read on public.pos_sales for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));
create policy pos_sale_lines_admin_read on public.pos_sale_lines for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));
create policy stock_movements_admin_read on public.stock_movements for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));

create or replace function public.upsert_stock_item(p_business_id uuid, p_name text, p_unit text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 100 or p_unit not in ('pieza','g','kg','ml','l') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  insert into public.stock_items(business_id, name, unit) values (p_business_id, trim(p_name), p_unit)
    on conflict (business_id, name) do update set active = true
    where public.stock_items.unit = excluded.unit returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'code', 'unit_conflict'); end if;
  perform private.audit(p_business_id, 'stock.item_upsert', 'stock_item', v_id::text, 'success');
  return jsonb_build_object('ok', true, 'item_id', v_id);
end $$;

create or replace function public.set_product_recipe(p_business_id uuid, p_product_id uuid, p_components jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_item uuid; v_qty numeric; v_count integer := 0;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if not exists (select 1 from public.products where id = p_product_id and business_id = p_business_id)
     or p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  -- Validar todo antes de tocar la receta; errores de cast revierten la transacción.
  for v_row in select value from jsonb_array_elements(p_components) loop
    v_item := (v_row->>'item_id')::uuid;
    v_qty := (v_row->>'quantity')::numeric;
    if v_qty <= 0 or v_qty > 100000 or scale(v_qty) > 3 or not exists (
      select 1 from public.stock_items where id = v_item and business_id = p_business_id and active
    ) then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  end loop;
  delete from public.product_recipes where product_id = p_product_id and business_id = p_business_id;
  for v_row in select value from jsonb_array_elements(p_components) loop
    insert into public.product_recipes(business_id, product_id, item_id, quantity)
      values (p_business_id, p_product_id, (v_row->>'item_id')::uuid, (v_row->>'quantity')::numeric);
    v_count := v_count + 1;
  end loop;
  perform private.audit(p_business_id, 'stock.recipe_set', 'product', p_product_id::text, 'success', jsonb_build_object('components', v_count));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.adjust_stock(p_branch_id uuid, p_item_id uuid, p_delta numeric, p_minimum numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_staff uuid; v_quantity numeric;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.is_admin(v_business) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select id into v_staff from public.staff_members where business_id = v_business and user_id = auth.uid() and active;
  if not exists (select 1 from public.stock_items where id = p_item_id and business_id = v_business and active)
     or p_delta is null or p_delta = 0 or abs(p_delta) > 1000000
     or scale(p_delta) > 3 or p_minimum is null or p_minimum < 0 or p_minimum > 1000000 or scale(p_minimum) > 3
     or length(trim(coalesce(p_reason, ''))) not between 3 and 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  insert into public.stock_balances(business_id, branch_id, item_id)
    values (v_business, p_branch_id, p_item_id) on conflict do nothing;
  update public.stock_balances set quantity = quantity + p_delta, minimum = p_minimum, updated_at = now()
    where branch_id = p_branch_id and item_id = p_item_id and quantity + p_delta >= 0
    returning quantity into v_quantity;
  if v_quantity is null then return jsonb_build_object('ok', false, 'code', 'insufficient_stock'); end if;
  insert into public.stock_movements(business_id, branch_id, item_id, quantity_delta, reason, actor_staff_id)
    values (v_business, p_branch_id, p_item_id, p_delta, trim(p_reason), v_staff);
  perform private.audit(v_business, 'stock.adjust', 'stock_item', p_item_id::text, 'success',
    jsonb_build_object('branch_id', p_branch_id, 'delta', p_delta, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true, 'quantity', v_quantity);
end $$;

create or replace function public.import_stock_count(p_branch_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid; v_staff uuid; v_row jsonb; v_name text; v_unit text;
  v_item uuid; v_count numeric; v_min numeric; v_old numeric; v_delta numeric; v_imported integer := 0;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.is_admin(v_business) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select id into v_staff from public.staff_members where business_id = v_business and user_id = auth.uid() and active;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := trim(v_row->>'name'); v_unit := v_row->>'unit';
    v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    if length(v_name) not between 2 and 100 or v_unit not in ('pieza','g','kg','ml','l')
      or v_count < 0 or v_count > 1000000 or v_min < 0 or v_min > 1000000
      or scale(v_count) > 3 or scale(v_min) > 3 then
      return jsonb_build_object('ok', false, 'code', 'invalid_rows');
    end if;
    if exists (select 1 from public.stock_items where business_id = v_business and name = v_name and unit <> v_unit) then
      return jsonb_build_object('ok', false, 'code', 'unit_conflict');
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_rows)) <>
     (select count(distinct trim(value->>'name')) from jsonb_array_elements(p_rows)) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_item');
  end if;
  perform 1 from public.branches where id = p_branch_id for update;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := trim(v_row->>'name'); v_unit := v_row->>'unit';
    v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    v_item := null;
    insert into public.stock_items(business_id,name,unit) values (v_business,v_name,v_unit)
      on conflict (business_id,name) do update set active = true
      where public.stock_items.unit = excluded.unit returning id into v_item;
    if v_item is null then return jsonb_build_object('ok', false, 'code', 'unit_conflict'); end if;
    select quantity into v_old from public.stock_balances where branch_id = p_branch_id and item_id = v_item for update;
    v_delta := v_count - coalesce(v_old, 0);
    insert into public.stock_balances(business_id,branch_id,item_id,quantity,minimum)
      values (v_business,p_branch_id,v_item,v_count,v_min)
      on conflict (branch_id,item_id) do update set quantity = excluded.quantity, minimum = excluded.minimum, updated_at = now();
    if v_delta <> 0 then
      insert into public.stock_movements(business_id,branch_id,item_id,quantity_delta,reason,actor_staff_id)
        values (v_business,p_branch_id,v_item,v_delta,'Conteo importado de Excel/CSV',v_staff);
    end if;
    v_imported := v_imported + 1;
  end loop;
  perform private.audit(v_business,'stock.import_count','branch',p_branch_id::text,'success',jsonb_build_object('rows',v_imported));
  return jsonb_build_object('ok',true,'rows',v_imported);
end $$;

create or replace function public.record_pos_sale(p_branch_id uuid, p_idempotency_key uuid, p_payment_method text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid; v_staff uuid; v_sale uuid; v_total bigint := 0;
  v_line jsonb; v_product public.products; v_qty integer; v_need record;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.can_operate_branch(p_branch_id, array['owner','admin','manager','barista']::public.staff_role[]) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  select id into v_staff from public.staff_members where business_id = v_business and user_id = auth.uid() and active;
  if p_idempotency_key is null or p_payment_method is null or p_payment_method not in ('cash','card_manual','transfer_manual')
     or p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  -- Serializar ventas simultáneas de la misma sucursal; evita carreras de stock e idempotencia.
  perform 1 from public.branches where id = p_branch_id for update;
  select id, total_cents into v_sale, v_total from public.pos_sales
    where business_id = v_business and idempotency_key = p_idempotency_key;
  if v_sale is not null then return jsonb_build_object('ok', true, 'sale_id', v_sale, 'total_cents', v_total, 'replayed', true); end if;
  v_total := 0;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if (v_line->>'product_id') is null or (v_line->>'quantity') !~ '^[0-9]{1,3}$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    v_qty := (v_line->>'quantity')::integer;
    if v_qty not between 1 and 100 then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
    select * into v_product from public.products where id = (v_line->>'product_id')::uuid and business_id = v_business and active for share;
    if not found or not exists (select 1 from public.product_recipes where product_id = v_product.id) then
      return jsonb_build_object('ok', false, 'code', 'product_unavailable');
    end if;
    if exists (select 1 from jsonb_array_elements(p_lines) x where x->>'product_id' = v_product.id::text
      group by x->>'product_id' having count(*) > 1) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_product');
    end if;
    v_total := v_total + v_product.price_cents::bigint * v_qty;
  end loop;
  if v_total > 100000000 then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  -- Todas las existencias requeridas se comprueban antes de insertar la venta.
  for v_need in
    select r.item_id, sum(r.quantity * (x.value->>'quantity')::integer) as required,
      coalesce(b.quantity, 0) as available
    from jsonb_array_elements(p_lines) x
    join public.product_recipes r on r.product_id = (x.value->>'product_id')::uuid
    left join public.stock_balances b on b.branch_id = p_branch_id and b.item_id = r.item_id
    group by r.item_id, b.quantity order by r.item_id
  loop
    if v_need.available < v_need.required then
      return jsonb_build_object('ok', false, 'code', 'insufficient_stock', 'item_id', v_need.item_id);
    end if;
  end loop;
  insert into public.pos_sales(business_id, branch_id, staff_member_id, idempotency_key, payment_method, total_cents)
    values (v_business, p_branch_id, v_staff, p_idempotency_key, p_payment_method, v_total) returning id into v_sale;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = (v_line->>'product_id')::uuid and business_id = v_business;
    v_qty := (v_line->>'quantity')::integer;
    insert into public.pos_sale_lines(sale_id, business_id, product_id, product_name, quantity, unit_price_cents, total_cents)
      values (v_sale, v_business, v_product.id, v_product.name, v_qty, v_product.price_cents, v_qty * v_product.price_cents);
  end loop;
  for v_need in
    select r.item_id, sum(r.quantity * (x.value->>'quantity')::integer) as required
    from jsonb_array_elements(p_lines) x
    join public.product_recipes r on r.product_id = (x.value->>'product_id')::uuid
    group by r.item_id order by r.item_id
  loop
    update public.stock_balances set quantity = quantity - v_need.required, updated_at = now()
      where branch_id = p_branch_id and item_id = v_need.item_id and quantity >= v_need.required;
    if not found then raise exception 'stock_changed'; end if;
    insert into public.stock_movements(business_id, branch_id, item_id, sale_id, quantity_delta, reason, actor_staff_id)
      values (v_business, p_branch_id, v_need.item_id, v_sale, -v_need.required, 'Venta en caja', v_staff);
  end loop;
  perform private.audit(v_business, 'pos.sale_record', 'pos_sale', v_sale::text, 'success',
    jsonb_build_object('branch_id', p_branch_id, 'total_cents', v_total, 'payment_method', p_payment_method));
  return jsonb_build_object('ok', true, 'sale_id', v_sale, 'total_cents', v_total, 'replayed', false);
end $$;

create or replace function public.inventory_overview(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  return jsonb_build_object('ok', true,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit)
      order by i.name), '[]'::jsonb) from public.stock_items i where i.business_id = p_business_id and i.active),
    'balances', (select coalesce(jsonb_agg(jsonb_build_object('branch_id', b.branch_id, 'item_id', b.item_id,
      'quantity', b.quantity, 'minimum', b.minimum)), '[]'::jsonb)
      from public.stock_balances b where b.business_id = p_business_id),
    'recipes', (select coalesce(jsonb_agg(jsonb_build_object('product_id', r.product_id, 'item_id', r.item_id,
      'quantity', r.quantity)), '[]'::jsonb) from public.product_recipes r where r.business_id = p_business_id),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name), '[]'::jsonb)
      from public.products p where p.business_id = p_business_id and p.active)
  );
end $$;

create or replace function public.pos_catalog(p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_business uuid;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.can_operate_branch(p_branch_id, array['owner','admin','manager','barista']::public.staff_role[]) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'products', (
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price_cents', p.price_cents,
      'available', coalesce((select floor(min(coalesce(b.quantity, 0) / r.quantity))::integer
        from public.product_recipes r left join public.stock_balances b on b.branch_id = p_branch_id and b.item_id = r.item_id
        where r.product_id = p.id), 0)) order by p.name), '[]'::jsonb)
    from public.products p where p.business_id = v_business and p.active
  ));
end $$;

create or replace function public.pos_sales_report(p_business_id uuid, p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and business_id = p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  return jsonb_build_object('ok', true,
    'sales', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'branch_id', s.branch_id,
      'staff_id', s.staff_member_id, 'staff_name', sm.display_name, 'total_cents', s.total_cents,
      'payment_method', s.payment_method, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from (select * from public.pos_sales where business_id = p_business_id
        and (p_branch_id is null or branch_id = p_branch_id) order by created_at desc limit 200) s
      join public.staff_members sm on sm.id = s.staff_member_id),
    'by_staff', (select coalesce(jsonb_agg(jsonb_build_object('staff_id', x.staff_member_id,
      'staff_name', x.display_name, 'sales_count', x.sales_count, 'total_cents', x.total_cents)
      order by x.total_cents desc), '[]'::jsonb)
      from (select s.staff_member_id, sm.display_name, count(*)::integer as sales_count, sum(s.total_cents)::bigint as total_cents
        from public.pos_sales s join public.staff_members sm on sm.id = s.staff_member_id
        where s.business_id = p_business_id and (p_branch_id is null or s.branch_id = p_branch_id)
          and s.created_at >= now() - interval '30 days'
        group by s.staff_member_id, sm.display_name) x)
  );
end $$;

revoke execute on function public.upsert_stock_item(uuid,text,text), public.set_product_recipe(uuid,uuid,jsonb),
  public.adjust_stock(uuid,uuid,numeric,numeric,text), public.import_stock_count(uuid,jsonb), public.record_pos_sale(uuid,uuid,text,jsonb),
  public.inventory_overview(uuid), public.pos_catalog(uuid), public.pos_sales_report(uuid,uuid) from public, anon;
grant execute on function public.upsert_stock_item(uuid,text,text), public.set_product_recipe(uuid,uuid,jsonb),
  public.adjust_stock(uuid,uuid,numeric,numeric,text), public.import_stock_count(uuid,jsonb), public.record_pos_sale(uuid,uuid,text,jsonb),
  public.inventory_overview(uuid), public.pos_catalog(uuid), public.pos_sales_report(uuid,uuid) to authenticated;
