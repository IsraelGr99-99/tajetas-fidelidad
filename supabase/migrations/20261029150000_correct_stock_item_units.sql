-- Corregir una unidad mal elegida solo antes de que existan cantidades,
-- recetas o movimientos. Nunca reinterpretar historial en otra unidad.
create or replace function public.correct_stock_item_unit(
  p_business_id uuid, p_item_id uuid, p_unit text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not private.is_admin(p_business_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_unit is null or p_unit not in ('pieza', 'g', 'kg', 'ml', 'l') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select unit into v_old from public.stock_items
    where id = p_item_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_old = p_unit then return jsonb_build_object('ok', true, 'unchanged', true); end if;

  if exists (select 1 from public.product_recipes where item_id = p_item_id)
    or exists (select 1 from public.stock_movements where item_id = p_item_id)
    or exists (select 1 from public.stock_balances where item_id = p_item_id
      and (quantity <> 0 or minimum <> 0)) then
    return jsonb_build_object('ok', false, 'code', 'item_in_use');
  end if;

  update public.stock_items set unit = p_unit where id = p_item_id;
  perform private.audit(p_business_id, 'stock.unit_corrected', 'stock_item', p_item_id::text,
    'success', jsonb_build_object('before', v_old, 'after', p_unit));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.correct_stock_item_unit(uuid,uuid,text) from public, anon;
grant execute on function public.correct_stock_item_unit(uuid,uuid,text) to authenticated;
