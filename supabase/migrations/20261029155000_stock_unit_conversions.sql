-- Los cambios de unidad son auditables. Los movimientos previos siguen en
-- la unidad que regía antes del cambio; nunca se reescriben.
alter table public.stock_items drop constraint stock_items_unit_check;
alter table public.stock_items add constraint stock_items_unit_check
  check (unit in ('pieza','caja','g','kg','ml','l'));

create table public.stock_unit_changes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  item_id uuid not null,
  old_unit text not null,
  new_unit text not null,
  mode text not null check (mode in ('convert','relabel')),
  factor numeric(14,6) not null check (factor > 0),
  actor_staff_id uuid not null,
  changed_at timestamptz not null default clock_timestamp(),
  foreign key (item_id,business_id) references public.stock_items(id,business_id) on delete restrict,
  foreign key (actor_staff_id,business_id) references public.staff_members(id,business_id) on delete restrict
);
create index stock_unit_changes_item_time_idx on public.stock_unit_changes(item_id,changed_at);
create trigger stock_unit_changes_append_only before update or delete on public.stock_unit_changes
  for each row execute function private.forbid_mutation();
alter table public.stock_unit_changes enable row level security;
revoke all on public.stock_unit_changes from public,anon,authenticated;
grant select on public.stock_unit_changes to authenticated;
create policy stock_unit_changes_admin_read on public.stock_unit_changes for select to authenticated
  using (private.has_role(business_id,array['owner','admin']::public.staff_role[]));

create or replace function public.change_stock_item_unit(
  p_business_id uuid,p_item_id uuid,p_unit text,p_mode text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text; v_unit text := lower(btrim(coalesce(p_unit,'')));
  v_factor numeric := 1; v_staff uuid; v_branch record;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  if v_unit not in ('pieza','caja','g','kg','ml','l') or p_mode not in ('convert','relabel') then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  select id into v_staff from public.staff_members
    where business_id = p_business_id and user_id = auth.uid() and active;
  perform 1 from public.businesses where id = p_business_id for update;
  for v_branch in select id from public.branches where business_id = p_business_id order by id loop
    perform 1 from public.branches where id = v_branch.id for update;
  end loop;
  select unit into v_old from public.stock_items where id = p_item_id
    and business_id = p_business_id and active for update;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  if v_old = v_unit then return jsonb_build_object('ok',true,'unchanged',true); end if;
  if p_mode = 'convert' then
    v_factor := case
      when v_old = 'g' and v_unit = 'kg' then 0.001
      when v_old = 'kg' and v_unit = 'g' then 1000
      when v_old = 'ml' and v_unit = 'l' then 0.001
      when v_old = 'l' and v_unit = 'ml' then 1000
      else null end;
    if v_factor is null then return jsonb_build_object('ok',false,'code','incompatible_units'); end if;
    if exists (select 1 from public.stock_balances where item_id = p_item_id
      and (scale(quantity * v_factor) > 3 or scale(minimum * v_factor) > 3
        or quantity * v_factor >= 100000000000 or minimum * v_factor >= 100000000000))
      or exists (select 1 from public.product_recipes where item_id = p_item_id
        and (scale(quantity * v_factor) > 3 or quantity * v_factor >= 1000000000
          or quantity * v_factor < 0.001)) then
      return jsonb_build_object('ok',false,'code','precision_loss');
    end if;
    update public.stock_balances set quantity = quantity * v_factor,
      minimum = minimum * v_factor, updated_at = now() where item_id = p_item_id;
    update public.product_recipes set quantity = quantity * v_factor where item_id = p_item_id;
  end if;
  update public.stock_items set unit = v_unit where id = p_item_id;
  insert into public.stock_unit_changes(business_id,item_id,old_unit,new_unit,mode,factor,actor_staff_id)
    values (p_business_id,p_item_id,v_old,v_unit,p_mode,v_factor,v_staff);
  perform private.audit(p_business_id,'stock.unit_changed','stock_item',p_item_id::text,'success',
    jsonb_build_object('old_unit',v_old,'new_unit',v_unit,'mode',p_mode,'factor',v_factor));
  return jsonb_build_object('ok',true,'factor',v_factor);
end $$;

-- La interfaz usa el RPC de cuatro argumentos; el de tres carece del modo
-- explícito necesario para convertir inventario ya utilizado.
drop function public.correct_stock_item_unit(uuid,uuid,text);

create or replace function public.import_stock_count(p_branch_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_staff uuid; v_row jsonb; v_name text; v_unit text;
  v_item uuid; v_count numeric; v_min numeric; v_old numeric; v_delta numeric; v_imported integer := 0;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.is_admin(v_business) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  select id into v_staff from public.staff_members where business_id = v_business and user_id = auth.uid() and active;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := regexp_replace(btrim(coalesce(v_row->>'name','')),'[[:space:]]+',' ','g');
    v_unit := lower(btrim(coalesce(v_row->>'unit','')));
    begin
      v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    exception when invalid_text_representation then
      return jsonb_build_object('ok',false,'code','invalid_rows');
    end;
    if length(v_name) not between 2 and 100 or v_unit not in ('pieza','caja','g','kg','ml','l')
      or v_count is null or v_min is null or v_count < 0 or v_count > 1000000 or v_min < 0 or v_min > 1000000
      or scale(v_count) > 3 or scale(v_min) > 3 then
      return jsonb_build_object('ok',false,'code','invalid_rows'); end if;
    if exists (select 1 from public.stock_items where business_id = v_business
      and private.catalog_key(name) = private.catalog_key(v_name) and unit <> v_unit) then
      return jsonb_build_object('ok',false,'code','unit_conflict'); end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_rows)) <>
    (select count(distinct private.catalog_key(value->>'name')) from jsonb_array_elements(p_rows)) then
    return jsonb_build_object('ok',false,'code','duplicate_item'); end if;
  perform 1 from public.branches where id = p_branch_id for update;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := regexp_replace(btrim(v_row->>'name'),'[[:space:]]+',' ','g');
    v_unit := lower(btrim(v_row->>'unit'));
    v_count := (v_row->>'quantity')::numeric; v_min := (v_row->>'minimum')::numeric;
    v_item := null;
    insert into public.stock_items(business_id,name,unit) values (v_business,v_name,v_unit)
      on conflict (business_id,private.catalog_key(name)) do update set active = true
      where public.stock_items.unit = excluded.unit returning id into v_item;
    if v_item is null then return jsonb_build_object('ok',false,'code','unit_conflict'); end if;
    select quantity into v_old from public.stock_balances where branch_id = p_branch_id and item_id = v_item for update;
    v_delta := v_count - coalesce(v_old,0);
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
revoke execute on function public.change_stock_item_unit(uuid,uuid,text,text) from public,anon;
grant execute on function public.change_stock_item_unit(uuid,uuid,text,text) to authenticated;

-- Serializar ajustes con caja, importación y conversiones de unidad.
create or replace function public.adjust_stock(p_branch_id uuid,p_item_id uuid,p_delta numeric,p_minimum numeric,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_staff uuid; v_quantity numeric;
begin
  select business_id into v_business from public.branches where id = p_branch_id and active;
  if v_business is null or not private.is_admin(v_business) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000000 or scale(p_delta) > 3
    or p_minimum is null or p_minimum < 0 or p_minimum > 1000000 or scale(p_minimum) > 3
    or length(trim(coalesce(p_reason,''))) not between 3 and 200 then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  perform 1 from public.branches where id = p_branch_id for update;
  if not exists (select 1 from public.stock_items where id = p_item_id and business_id = v_business and active) then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  select id into v_staff from public.staff_members where business_id = v_business and user_id = auth.uid() and active;
  insert into public.stock_balances(business_id,branch_id,item_id)
    values (v_business,p_branch_id,p_item_id) on conflict do nothing;
  update public.stock_balances set quantity = quantity + p_delta, minimum = p_minimum, updated_at = now()
    where branch_id = p_branch_id and item_id = p_item_id and quantity + p_delta >= 0
    returning quantity into v_quantity;
  if v_quantity is null then return jsonb_build_object('ok',false,'code','insufficient_stock'); end if;
  insert into public.stock_movements(business_id,branch_id,item_id,quantity_delta,reason,actor_staff_id)
    values (v_business,p_branch_id,p_item_id,p_delta,trim(p_reason),v_staff);
  perform private.audit(v_business,'stock.adjust','stock_item',p_item_id::text,'success',
    jsonb_build_object('branch_id',p_branch_id,'delta',p_delta,'reason',trim(p_reason)));
  return jsonb_build_object('ok',true,'quantity',v_quantity);
end $$;

create or replace function public.set_product_recipe(p_business_id uuid,p_product_id uuid,p_components jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_item uuid; v_qty numeric; v_count integer := 0;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  perform 1 from public.businesses where id = p_business_id for update;
  if not exists (select 1 from public.products where id = p_product_id and business_id = p_business_id)
    or p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) not between 1 and 30 then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;
  for v_row in select value from jsonb_array_elements(p_components) loop
    v_item := (v_row->>'item_id')::uuid; v_qty := (v_row->>'quantity')::numeric;
    if v_qty <= 0 or v_qty > 100000 or scale(v_qty) > 3 or not exists (
      select 1 from public.stock_items where id = v_item and business_id = p_business_id and active
    ) then return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  end loop;
  delete from public.product_recipes where product_id = p_product_id and business_id = p_business_id;
  for v_row in select value from jsonb_array_elements(p_components) loop
    insert into public.product_recipes(business_id,product_id,item_id,quantity)
      values (p_business_id,p_product_id,(v_row->>'item_id')::uuid,(v_row->>'quantity')::numeric);
    v_count := v_count + 1;
  end loop;
  perform private.audit(p_business_id,'stock.recipe_set','product',p_product_id::text,'success',jsonb_build_object('components',v_count));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.upsert_stock_item(p_business_id uuid,p_name text,p_unit text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text := regexp_replace(btrim(coalesce(p_name,'')),'[[:space:]]+',' ','g');
  v_unit text := lower(btrim(coalesce(p_unit,'')));
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  if length(v_name) not between 2 and 100 or v_unit not in ('pieza','caja','g','kg','ml','l') then
    return jsonb_build_object('ok',false,'code','invalid_request'); end if;
  insert into public.stock_items(business_id,name,unit) values (p_business_id,v_name,v_unit)
    on conflict (business_id,private.catalog_key(name)) do update set active = true
    where public.stock_items.unit = excluded.unit returning id into v_id;
  if v_id is null then return jsonb_build_object('ok',false,'code','unit_conflict'); end if;
  perform private.audit(p_business_id,'stock.item_upsert','stock_item',v_id::text,'success');
  return jsonb_build_object('ok',true,'item_id',v_id);
end $$;
