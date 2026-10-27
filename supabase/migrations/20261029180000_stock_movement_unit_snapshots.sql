-- Snapshot para movimientos nuevos; las filas históricas siguen inmutables.
-- Las previas al primer cambio se interpretan con old_unit del primer evento.
alter table public.stock_movements add column unit_at_event text;

create function private.snapshot_stock_movement_unit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select unit into new.unit_at_event from public.stock_items
    where id = new.item_id and business_id = new.business_id;
  if new.unit_at_event is null then raise exception 'invalid_stock_item'; end if;
  return new;
end $$;
revoke execute on function private.snapshot_stock_movement_unit() from public,anon,authenticated;
create trigger stock_movements_snapshot_unit before insert on public.stock_movements
  for each row execute function private.snapshot_stock_movement_unit();

create view public.stock_movements_with_unit with (security_invoker = true) as
select m.id,m.business_id,m.branch_id,m.item_id,m.sale_id,m.quantity_delta,
  m.reason,m.actor_staff_id,m.created_at,
  coalesce(m.unit_at_event,(
    select c.old_unit from public.stock_unit_changes c where c.item_id = m.item_id
      order by c.changed_at,c.id limit 1
  ),i.unit) as event_unit
from public.stock_movements m join public.stock_items i on i.id = m.item_id;
revoke all on public.stock_movements_with_unit from public,anon,authenticated;
grant select on public.stock_movements_with_unit to authenticated;
