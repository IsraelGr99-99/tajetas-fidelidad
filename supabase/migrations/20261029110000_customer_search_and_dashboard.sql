-- Búsqueda administrada: correo exacto, serial o nombre parcial. Nunca se audita el dato buscado.
create or replace function public.admin_find_customers(p_business_id uuid, p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_phone text := '+52' || right(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), 10);
  v_kind text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if not private.is_admin(p_business_id) then return private.reject(p_business_id, 'customer.search', 'forbidden'); end if;
  if not private.rate_limit_allow('customer_search:' || auth.uid(), 60, 600) then
    return private.reject(p_business_id, 'customer.search', 'rate_limited');
  end if;
  if length(v_q) < 3 then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  v_kind := case when v_q like '%@%' then 'email'
    when v_q ~ '^[0-9a-f]{8,32}$' then 'serial'
    when v_q ~ '^[+0-9 ()-]+$' and length(v_digits) >= 10 then 'phone'
    else 'name' end;

  perform private.audit(p_business_id, 'customer.search', null, null, 'success', jsonb_build_object('kind', v_kind));
  return jsonb_build_object('ok', true, 'customers', coalesce((
    select jsonb_agg(m.row_data order by m.created_at desc) from (
      select jsonb_build_object(
        'card_id', c.id, 'card_serial', c.public_serial, 'display_name', cu.display_name,
        'contact_masked', private.mask_contact(cu), 'contact_channel', cu.contact_channel,
        'stamps_balance', c.stamps_balance, 'rewards_balance', c.rewards_balance,
        'enrolled_at', cu.created_at, 'last_earn_at', c.last_earn_at
      ) row_data, cu.created_at
      from public.customers cu join public.loyalty_cards c on c.customer_id = cu.id
      where cu.business_id = p_business_id and cu.status = 'active'
        and case v_kind
          when 'email' then cu.contact_email = v_q
          when 'serial' then left(c.public_serial, length(v_q)) = v_q
          when 'phone' then cu.contact_phone = v_phone
          else cu.display_name is not null and position(v_q in lower(cu.display_name)) > 0
        end
      order by cu.created_at desc limit 10
    ) m
  ), '[]'::jsonb));
end $$;

-- Resumen operativo de la semana actual, independiente de las ventas importadas.
create or replace function public.operations_dashboard(p_business_id uuid, p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tz text; v_week_start timestamptz;
begin
  if not private.is_admin(p_business_id) then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and business_id = p_business_id and active
  ) then return jsonb_build_object('ok', false, 'code', 'invalid_request'); end if;
  select timezone into v_tz from public.businesses where id = p_business_id;
  v_week_start := date_trunc('week', now() at time zone v_tz) at time zone v_tz;
  return jsonb_build_object(
    'ok', true,
    'week_start', (v_week_start at time zone v_tz)::date,
    'weekly_sales_cents', (select coalesce(sum(total_cents),0) from public.pos_sales
      where business_id = p_business_id and (p_branch_id is null or branch_id = p_branch_id)
        and created_at >= v_week_start),
    'weekly_sales_count', (select count(*) from public.pos_sales
      where business_id = p_business_id and (p_branch_id is null or branch_id = p_branch_id)
        and created_at >= v_week_start),
    'low_stock_count', (select count(*) from public.stock_balances sb
      join public.branches b on b.id = sb.branch_id and b.active
      where sb.business_id = p_business_id and (p_branch_id is null or sb.branch_id = p_branch_id)
        and sb.quantity <= sb.minimum),
    'missing_stock_count', (select count(*) from public.stock_items i
      join public.branches b on b.business_id = i.business_id and b.active
      left join public.stock_balances sb on sb.branch_id = b.id and sb.item_id = i.id
      where i.business_id = p_business_id and i.active and (p_branch_id is null or b.id = p_branch_id)
        and sb.item_id is null),
    'products_without_recipe', (select count(*) from public.products p
      where p.business_id = p_business_id and p.active
        and not exists (select 1 from public.product_recipes r where r.product_id = p.id)),
    'recent_events', coalesce((select jsonb_agg(jsonb_build_object(
      'kind', e.kind, 'label', e.label, 'created_at', e.created_at,
      'amount_cents', e.amount_cents, 'quantity_delta', e.quantity_delta
    ) order by e.created_at desc) from (
      select 'sale'::text kind, b.name label, s.created_at, s.total_cents amount_cents, null::numeric quantity_delta
      from public.pos_sales s join public.branches b on b.id = s.branch_id
      where s.business_id = p_business_id and (p_branch_id is null or s.branch_id = p_branch_id)
      union all
      select 'stock'::text kind, i.name label, m.created_at, null::integer amount_cents, m.quantity_delta
      from public.stock_movements m join public.stock_items i on i.id = m.item_id
      where m.business_id = p_business_id and (p_branch_id is null or m.branch_id = p_branch_id)
      order by created_at desc limit 8
    ) e), '[]'::jsonb)
  );
end $$;

revoke execute on function public.operations_dashboard(uuid,uuid) from public, anon;
grant execute on function public.operations_dashboard(uuid,uuid) to authenticated;
