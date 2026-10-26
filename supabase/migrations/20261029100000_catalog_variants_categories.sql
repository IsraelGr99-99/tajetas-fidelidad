-- Categorías administrables y variantes vendibles. No cambia precios ni saldos.
create or replace function private.catalog_key(p_value text)
returns text language sql immutable strict set search_path = '' as $$
  select lower(regexp_replace(btrim(p_value), '[[:space:]]+', ' ', 'g'))
$$;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (length(name) between 2 and 40),
  name_key text not null check (name_key = private.catalog_key(name)),
  created_at timestamptz not null default now(),
  unique (business_id, name_key)
);
alter table public.product_categories enable row level security;
revoke all on public.product_categories from public, anon, authenticated;
grant select on public.product_categories to authenticated;
create policy product_categories_admin_read on public.product_categories for select to authenticated
  using (private.has_role(business_id, array['owner','admin']::public.staff_role[]));

insert into public.product_categories(business_id, name, name_key)
select business_id, min(regexp_replace(btrim(category), '[[:space:]]+', ' ', 'g')),
       private.catalog_key(category)
from public.products group by business_id, private.catalog_key(category);

create or replace function private.ensure_product_category(p_business_id uuid, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_name text; v_clean text := regexp_replace(btrim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g');
begin
  if length(v_clean) not between 2 and 40 then raise check_violation using message = 'invalid category'; end if;
  insert into public.product_categories(business_id, name, name_key)
  values (p_business_id, v_clean, private.catalog_key(v_clean))
  on conflict (business_id, name_key) do update set name = public.product_categories.name
  returning name into v_name;
  return v_name;
end $$;

create or replace function private.normalize_product_category()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.category := private.ensure_product_category(new.business_id, new.category);
  new.name := regexp_replace(btrim(new.name), '[[:space:]]+', ' ', 'g');
  return new;
end $$;
create trigger products_normalize_category before insert or update of category, name on public.products
  for each row execute function private.normalize_product_category();

-- Unificar únicamente la representación de categorías existentes.
update public.products p set category = c.name
from public.product_categories c
where c.business_id = p.business_id and c.name_key = private.catalog_key(p.category)
  and p.category is distinct from c.name;

create unique index products_business_name_key_uq on public.products(business_id, private.catalog_key(name));
create unique index stock_items_business_name_key_uq on public.stock_items(business_id, private.catalog_key(name));

alter table public.products
  add column base_name text check (base_name is null or length(base_name) between 2 and 60),
  add column variant_label text check (variant_label is null or length(variant_label) between 1 and 30),
  add constraint products_variant_pair check ((base_name is null and variant_label is null) or base_name is not null);
grant select (base_name, variant_label) on public.products to authenticated;

create or replace function public.upsert_product_category(p_business_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  begin
    v_name := private.ensure_product_category(p_business_id, p_name);
  exception when check_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end;
  perform private.audit(p_business_id, 'product.category_upsert', 'product_category', null, 'success');
  return jsonb_build_object('ok', true, 'name', v_name);
end $$;

create or replace function public.upsert_product_variant(
  p_business_id uuid, p_product_id uuid, p_base_name text, p_variant_label text,
  p_category text, p_price_cents integer, p_cost_cents integer, p_eligible boolean, p_active boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_base text := regexp_replace(btrim(coalesce(p_base_name, '')), '[[:space:]]+', ' ', 'g');
  v_variant text := nullif(regexp_replace(btrim(coalesce(p_variant_label, '')), '[[:space:]]+', ' ', 'g'), '');
  v_name text;
  v_category text;
  v_id uuid;
  v_canonical text;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if length(v_base) not between 2 and 60 or (v_variant is not null and length(v_variant) > 30)
     or p_price_cents is null or p_price_cents not between 0 and 1000000
     or (p_cost_cents is not null and p_cost_cents not between 0 and 1000000) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select coalesce(base_name, name) into v_canonical from public.products
    where business_id = p_business_id and private.catalog_key(coalesce(base_name, name)) = private.catalog_key(v_base)
    order by created_at, id limit 1;
  v_base := coalesce(v_canonical, v_base);
  v_name := v_base || case when v_variant is null then '' else ' · ' || v_variant end;
  if length(v_name) > 80 then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  begin
    v_category := private.ensure_product_category(p_business_id, p_category);
    if p_product_id is null then
      insert into public.products(business_id, name, base_name, variant_label, category, price_cents, cost_cents, eligible_for_stamp, active)
      values(p_business_id, v_name, v_base, v_variant, v_category, p_price_cents, p_cost_cents, coalesce(p_eligible,false), coalesce(p_active,true))
      returning id into v_id;
    else
      update public.products set name = v_name, base_name = v_base, variant_label = v_variant,
        category = v_category, price_cents = p_price_cents, cost_cents = p_cost_cents,
        eligible_for_stamp = coalesce(p_eligible,false), active = coalesce(p_active,true)
      where id = p_product_id and business_id = p_business_id returning id into v_id;
      if v_id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_name');
  when check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end;
  perform private.audit(p_business_id, 'product.upsert', 'product', v_id::text, 'success',
    jsonb_build_object('name', v_name, 'category', v_category, 'price_cents', p_price_cents));
  return jsonb_build_object('ok', true, 'product_id', v_id);
end $$;

create or replace function public.bulk_upsert_product_variants(p_business_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row record; v_existing uuid; v_result jsonb; v_inserted integer := 0; v_updated integer := 0; v_name text; v_seen text[] := '{}';
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  begin
    for v_row in select * from jsonb_to_recordset(p_rows) as r(
      name text, variant_label text, category text, price_cents integer, cost_cents integer, eligible boolean, active boolean
    ) loop
      v_name := btrim(coalesce(v_row.name,'')) || case when nullif(btrim(coalesce(v_row.variant_label,'')),'') is null
        then '' else ' · ' || btrim(v_row.variant_label) end;
      if private.catalog_key(v_name) = any(v_seen) then raise exception 'duplicate row'; end if;
      v_seen := array_append(v_seen, private.catalog_key(v_name));
      select id into v_existing from public.products
        where business_id = p_business_id and private.catalog_key(name) = private.catalog_key(v_name);
      v_result := public.upsert_product_variant(p_business_id, v_existing, v_row.name, v_row.variant_label,
        v_row.category, v_row.price_cents, v_row.cost_cents, v_row.eligible, v_row.active);
      if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'invalid row'; end if;
      if v_existing is null then v_inserted := v_inserted + 1; else v_updated := v_updated + 1; end if;
      v_existing := null;
    end loop;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_rows');
  end;
  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'updated', v_updated);
end $$;

create or replace function public.admin_catalog(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'base_name', coalesce(base_name,name), 'variant_label', variant_label,
      'category', category, 'price_cents', price_cents, 'cost_cents', cost_cents,
      'eligible', eligible_for_stamp, 'active', active
    ) order by active desc, category, name)
    from public.products where business_id = p_business_id
  ), '[]'::jsonb));
end $$;

-- La unidad y el nombre de un insumo se comparan sin distinguir mayúsculas.
create or replace function public.upsert_stock_item(p_business_id uuid, p_name text, p_unit text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text := regexp_replace(btrim(coalesce(p_name,'')), '[[:space:]]+', ' ', 'g'); v_unit text := lower(btrim(coalesce(p_unit,'')));
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if length(v_name) not between 2 and 100 or v_unit not in ('pieza','g','kg','ml','l') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  insert into public.stock_items(business_id, name, unit) values (p_business_id, v_name, v_unit)
    on conflict (business_id, private.catalog_key(name)) do update set active = true
    where public.stock_items.unit = excluded.unit returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'code', 'unit_conflict'); end if;
  perform private.audit(p_business_id, 'stock.item_upsert', 'stock_item', v_id::text, 'success');
  return jsonb_build_object('ok', true, 'item_id', v_id);
end $$;

-- El conteo absoluto reutiliza el insumo por clave canónica; no puede generar un duplicado por capitalización.
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
    v_name := regexp_replace(btrim(coalesce(v_row->>'name','')), '[[:space:]]+', ' ', 'g');
    v_unit := lower(btrim(coalesce(v_row->>'unit','')));
    begin
      v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    exception when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid_rows');
    end;
    if length(v_name) not between 2 and 100 or v_unit not in ('pieza','g','kg','ml','l')
      or v_count is null or v_min is null or v_count < 0 or v_count > 1000000 or v_min < 0 or v_min > 1000000
      or scale(v_count) > 3 or scale(v_min) > 3 then
      return jsonb_build_object('ok', false, 'code', 'invalid_rows');
    end if;
    if exists (select 1 from public.stock_items where business_id = v_business
      and private.catalog_key(name) = private.catalog_key(v_name) and unit <> v_unit) then
      return jsonb_build_object('ok', false, 'code', 'unit_conflict');
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_rows)) <>
     (select count(distinct private.catalog_key(value->>'name')) from jsonb_array_elements(p_rows)) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_item');
  end if;
  perform 1 from public.branches where id = p_branch_id for update;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := regexp_replace(btrim(v_row->>'name'), '[[:space:]]+', ' ', 'g');
    v_unit := lower(btrim(v_row->>'unit'));
    v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    v_item := null;
    insert into public.stock_items(business_id,name,unit) values (v_business,v_name,v_unit)
      on conflict (business_id, private.catalog_key(name)) do update set active = true
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

revoke execute on function private.catalog_key(text), private.ensure_product_category(uuid,text),
  private.normalize_product_category() from public, anon, authenticated;
revoke execute on function public.upsert_product_category(uuid,text),
  public.upsert_product_variant(uuid,uuid,text,text,text,integer,integer,boolean,boolean),
  public.bulk_upsert_product_variants(uuid,jsonb) from public, anon;
grant execute on function public.upsert_product_category(uuid,text),
  public.upsert_product_variant(uuid,uuid,text,text,text,integer,integer,boolean,boolean),
  public.bulk_upsert_product_variants(uuid,jsonb) to authenticated;
