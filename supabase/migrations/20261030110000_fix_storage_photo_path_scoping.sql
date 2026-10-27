-- La subconsulta también tiene una columna `products.name`. Sin calificar el
-- nombre de la tabla externa, foldername(name) leía el nombre del producto,
-- no la ruta del objeto; por eso todas las subidas devolvían 403.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists product_photos_admin_insert on storage.objects';
    execute 'drop policy if exists product_photos_admin_select on storage.objects';
    execute 'drop policy if exists product_photos_admin_delete on storage.objects';

    execute $policy$
      create policy product_photos_admin_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(storage.objects.name))[1]
          and p.id::text = (storage.foldername(storage.objects.name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy product_photos_admin_select on storage.objects for select to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(storage.objects.name))[1]
          and p.id::text = (storage.foldername(storage.objects.name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy product_photos_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(storage.objects.name))[1]
          and p.id::text = (storage.foldername(storage.objects.name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
  end if;
end $$;
