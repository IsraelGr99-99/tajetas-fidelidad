-- Fotografías públicas de catálogo (sin PII) y motivos de falta de stock para caja.
alter table public.products add column image_path text
  check (image_path is null or (length(image_path) <= 180 and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));
grant select (image_path) on public.products to authenticated;

-- En producción Supabase incluye el esquema Storage. PGlite no lo simula.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('product-photos', 'product-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set public = true, file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg','image/png','image/webp']
    $storage$;
    execute $storage$
      create policy product_photos_admin_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.is_admin(p.business_id)))
    $storage$;
    execute $storage$
      create policy product_photos_admin_select on storage.objects for select to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.is_admin(p.business_id)))
    $storage$;
    execute $storage$
      create policy product_photos_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.is_admin(p.business_id)))
    $storage$;
  end if;
end $$;

create or replace function public.set_product_image_path(p_product_id uuid, p_image_path text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_old text;
begin
  select business_id, image_path into v_business, v_old from public.products where id = p_product_id;
  if v_business is null or not private.is_admin(v_business) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_image_path is not null and (
    length(p_image_path) > 180 or p_image_path !~ ('^' || v_business::text || '/' || p_product_id::text ||
      '/[0-9a-f-]{36}\.(jpg|png|webp)$')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  update public.products set image_path = p_image_path where id = p_product_id;
  perform private.audit(v_business, 'product.image_set', 'product', p_product_id::text, 'success');
  return jsonb_build_object('ok', true, 'previous_path', v_old);
end $$;
revoke execute on function public.set_product_image_path(uuid,text) from public, anon;
grant execute on function public.set_product_image_path(uuid,text) to authenticated;

create or replace function public.admin_catalog(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'base_name', coalesce(base_name,name), 'variant_label', variant_label,
      'category', category, 'price_cents', price_cents, 'cost_cents', cost_cents,
      'eligible', eligible_for_stamp, 'active', active, 'image_path', image_path
    ) order by active desc, category, name)
    from public.products where business_id = p_business_id
  ), '[]'::jsonb));
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
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'category', p.category, 'price_cents', p.price_cents,
      'image_path', p.image_path,
      'recipe_configured', exists(select 1 from public.product_recipes r where r.product_id = p.id),
      'missing_ingredients', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', i.name, 'unit', i.unit, 'needed', r.quantity, 'in_stock', coalesce(b.quantity, 0)) order by i.name), '[]'::jsonb)
        from public.product_recipes r join public.stock_items i on i.id = r.item_id
        left join public.stock_balances b on b.branch_id = p_branch_id and b.item_id = r.item_id
        where r.product_id = p.id and coalesce(b.quantity, 0) < r.quantity),
      'available', coalesce((select floor(min(coalesce(b.quantity, 0) / r.quantity))::integer
        from public.product_recipes r left join public.stock_balances b on b.branch_id = p_branch_id and b.item_id = r.item_id
        where r.product_id = p.id), 0)) order by p.name), '[]'::jsonb)
    from public.products p where p.business_id = v_business and p.active
  ));
end $$;
