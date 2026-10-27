-- Identidad visual de la tarjeta. Una sola configuración por empresa: afecta
-- también las tarjetas existentes sin tocar saldos ni eventos históricos.
alter table public.businesses
  add column card_background_color text not null default '#172b4d' check (card_background_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column card_secondary_color text not null default '#f6bb54' check (card_secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column card_text_color text not null default '#ffffff' check (card_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column card_logo_path text check (card_logo_path is null or card_logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

-- La tabla businesses ya tiene RLS y lectura pública; no se concede UPDATE.
create or replace function private.card_color_luminance(p_color text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v_bytes bytea; v_r numeric; v_g numeric; v_b numeric;
begin
  v_bytes := decode(substr(p_color, 2), 'hex');
  v_r := get_byte(v_bytes, 0) / 255.0;
  v_g := get_byte(v_bytes, 1) / 255.0;
  v_b := get_byte(v_bytes, 2) / 255.0;
  v_r := case when v_r <= 0.04045 then v_r / 12.92 else power((v_r + 0.055) / 1.055, 2.4) end;
  v_g := case when v_g <= 0.04045 then v_g / 12.92 else power((v_g + 0.055) / 1.055, 2.4) end;
  v_b := case when v_b <= 0.04045 then v_b / 12.92 else power((v_b + 0.055) / 1.055, 2.4) end;
  return v_r * 0.2126 + v_g * 0.7152 + v_b * 0.0722;
end $$;
revoke execute on function private.card_color_luminance(text) from public, anon, authenticated;

create or replace function public.set_business_card_theme(
  p_business_id uuid, p_background text, p_secondary text, p_text text, p_logo_path text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_previous_logo text;
begin
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_background is null or p_secondary is null or p_text is null or
    p_background !~ '^#[0-9A-Fa-f]{6}$' or p_secondary !~ '^#[0-9A-Fa-f]{6}$'
    or p_text !~ '^#[0-9A-Fa-f]{6}$' or p_logo_path is not null and
    p_logo_path !~ ('^' || p_business_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if (greatest(private.card_color_luminance(p_background), private.card_color_luminance(p_text)) + 0.05) /
     (least(private.card_color_luminance(p_background), private.card_color_luminance(p_text)) + 0.05) < 4.5 then
    return jsonb_build_object('ok', false, 'code', 'poor_contrast');
  end if;
  if (greatest(private.card_color_luminance(p_background), private.card_color_luminance(p_secondary)) + 0.05) /
     (least(private.card_color_luminance(p_background), private.card_color_luminance(p_secondary)) + 0.05) < 3 then
    return jsonb_build_object('ok', false, 'code', 'poor_contrast');
  end if;
  select card_logo_path into v_previous_logo from public.businesses where id = p_business_id for update;
  update public.businesses set card_background_color = lower(p_background),
    card_secondary_color = lower(p_secondary), card_text_color = lower(p_text),
    card_logo_path = p_logo_path where id = p_business_id;
  perform private.audit(p_business_id, 'business.card_theme_set', 'business', p_business_id::text, 'success');
  return jsonb_build_object('ok', true, 'previous_logo', v_previous_logo);
end $$;
revoke execute on function public.set_business_card_theme(uuid,text,text,text,text) from public, anon;
grant execute on function public.set_business_card_theme(uuid,text,text,text,text) to authenticated;

do $$ begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('business-logos', 'business-logos', true, 2097152, array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set public = true, file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg','image/png','image/webp']
    $storage$;
    execute $policy$
      create policy business_logos_admin_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'business-logos' and exists (
        select 1 from public.businesses b where b.id::text = (storage.foldername(storage.objects.name))[1]
          and private.has_role(b.id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy business_logos_admin_select on storage.objects for select to authenticated
      using (bucket_id = 'business-logos' and exists (
        select 1 from public.businesses b where b.id::text = (storage.foldername(storage.objects.name))[1]
          and private.has_role(b.id, array['owner','admin']::public.staff_role[])))
    $policy$;
    execute $policy$
      create policy business_logos_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'business-logos' and exists (
        select 1 from public.businesses b where b.id::text = (storage.foldername(storage.objects.name))[1]
          and private.has_role(b.id, array['owner','admin']::public.staff_role[])))
    $policy$;
  end if;
end $$;
