-- Storage ejecuta estas políticas con el rol authenticated. private.is_admin
-- no es invocable por ese rol; private.has_role sí y conserva el control MFA.
-- No se amplían privilegios de funciones privadas ni acceso a otros buckets.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists product_photos_admin_insert on storage.objects';
    execute 'drop policy if exists product_photos_admin_select on storage.objects';
    execute 'drop policy if exists product_photos_admin_delete on storage.objects';

    execute $policy$
      create policy product_photos_admin_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy product_photos_admin_select on storage.objects for select to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy product_photos_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'product-photos' and exists (
        select 1 from public.products p
        where p.business_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])))
    $policy$;
  end if;
end $$;
