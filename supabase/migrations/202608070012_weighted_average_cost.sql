begin;

alter table public.product_variants
add column average_cost numeric(14,4) check (average_cost is null or average_cost >= 0);

create or replace function private.rebuild_inventory_average_costs_internal()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_variant record;
  v_event record;
  v_quantity numeric;
  v_average numeric;
  v_event_cost numeric;
  v_last_cost numeric;
begin
  for v_variant in select id, cost from public.product_variants loop
    v_quantity := 0;
    v_average := null;
    v_last_cost := null;

    for v_event in
      select * from (
        select purchase.purchase_date as event_date, purchase.created_at as event_created, 1 as event_order,
          'purchase'::text as event_type, item.id as item_id, item.quantity,
          item.unit_cost as raw_unit_cost,
          item.unit_cost + case
            when totals.merchandise_total > 0 then purchase.extra_cost * item.unit_cost / totals.merchandise_total
            when totals.units_total > 0 then purchase.extra_cost / totals.units_total
            else 0 end as landed_unit_cost
        from public.supplier_purchase_items item
        join public.supplier_purchases purchase on purchase.id=item.purchase_id
        cross join lateral (
          select coalesce(sum(i.quantity*i.unit_cost),0) merchandise_total, coalesce(sum(i.quantity),0) units_total
          from public.supplier_purchase_items i where i.purchase_id=purchase.id
        ) totals
        where item.variant_id=v_variant.id and purchase.status='confirmed'
        union all
        select orders.sale_date, orders.created_at, 2, 'sale', item.id, item.quantity, null::numeric, null::numeric
        from public.order_items item
        join public.orders orders on orders.id=item.order_id
        where item.variant_id=v_variant.id and orders.status in ('confirmed','preparing','ready','delivered')
      ) events
      order by event_date, event_order, event_created, item_id
    loop
      if v_event.event_type='purchase' then
        v_event_cost := v_event.landed_unit_cost;
        v_last_cost := v_event.raw_unit_cost;
        v_average := case when v_quantity+v_event.quantity > 0
          then (v_quantity*coalesce(v_average,v_event_cost) + v_event.quantity*v_event_cost)/(v_quantity+v_event.quantity)
          else v_event_cost end;
        v_quantity := v_quantity+v_event.quantity;
      else
        v_event_cost := coalesce(v_average,v_variant.cost,0);
        update public.order_items set unit_cost_snapshot=v_event_cost where id=v_event.item_id;
        v_quantity := greatest(v_quantity-v_event.quantity,0);
      end if;
    end loop;

    update public.product_variants
    set average_cost=coalesce(v_average,cost), cost=coalesce(v_last_cost,cost), updated_at=now()
    where id=v_variant.id;
  end loop;
end;
$$;
revoke all on function private.rebuild_inventory_average_costs_internal() from public, authenticated;

create or replace function public.rebuild_inventory_average_costs()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  perform private.rebuild_inventory_average_costs_internal();
end;
$$;
revoke all on function public.rebuild_inventory_average_costs() from public;
grant execute on function public.rebuild_inventory_average_costs() to authenticated;

-- Reconstrucción inicial por fecha. No cambia stock_current.
do $$ begin
  perform private.rebuild_inventory_average_costs_internal();
end $$;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item record; v_affects_stock boolean; v_extra_cost numeric;
  v_merchandise_total numeric; v_units_total numeric; v_landed_cost numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select affects_stock,extra_cost into v_affects_stock,v_extra_cost from public.supplier_purchases where id=p_purchase_id and status='draft' for update;
  if not found then raise exception 'purchase_not_found_or_already_processed'; end if;
  select coalesce(sum(quantity*unit_cost),0),coalesce(sum(quantity),0) into v_merchandise_total,v_units_total from public.supplier_purchase_items where purchase_id=p_purchase_id;
  if v_units_total=0 then raise exception 'purchase_has_no_items'; end if;
  if v_affects_stock then perform set_config('koven.allow_stock_change','true',true); end if;

  for v_item in select variant_id,quantity,unit_cost from public.supplier_purchase_items where purchase_id=p_purchase_id loop
    v_landed_cost := v_item.unit_cost + case
      when v_merchandise_total>0 then v_extra_cost*v_item.unit_cost/v_merchandise_total
      else v_extra_cost/v_units_total end;
    if v_affects_stock then
      update public.product_variants set
        average_cost=((stock_current*coalesce(average_cost,cost,v_landed_cost))+(v_item.quantity*v_landed_cost))/(stock_current+v_item.quantity),
        cost=v_item.unit_cost, stock_current=stock_current+v_item.quantity, updated_at=now()
      where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,purchase_id,created_by)
      values(v_item.variant_id,'purchase',v_item.quantity,'Compra a proveedor confirmada',p_purchase_id,auth.uid());
    else
      update public.product_variants set cost=v_item.unit_cost,updated_at=now() where id=v_item.variant_id;
    end if;
  end loop;

  update public.supplier_purchases set status='confirmed',confirmed_at=now(),updated_at=now(),total_cost=v_merchandise_total+v_extra_cost where id=p_purchase_id;
  if not v_affects_stock then perform private.rebuild_inventory_average_costs_internal(); end if;
end;
$$;

create or replace function public.confirm_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item record; v_affects_stock boolean;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select affects_stock into v_affects_stock from public.orders where id=p_order_id and status='pending_confirmation' for update;
  if not found then raise exception 'order_not_found_or_already_processed'; end if;

  update public.order_items item set unit_cost_snapshot=coalesce(variant.average_cost,variant.cost,product.default_cost)
  from public.product_variants variant join public.products product on product.id=variant.product_id
  where item.order_id=p_order_id and item.variant_id=variant.id;

  if v_affects_stock then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,sum(quantity)::integer quantity from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id order by variant_id loop
      update public.product_variants set stock_current=stock_current-v_item.quantity,updated_at=now() where id=v_item.variant_id and stock_current>=v_item.quantity;
      if not found then raise exception 'insufficient_stock_for_variant_%',v_item.variant_id; end if;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,created_by)
      values(v_item.variant_id,'sale',-v_item.quantity,'Venta confirmada',p_order_id,auth.uid());
    end loop;
  end if;
  update public.orders set status='confirmed',confirmed_at=now(),updated_at=now() where id=p_order_id;
  if not v_affects_stock then perform private.rebuild_inventory_average_costs_internal(); end if;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_status public.order_status; v_item record; v_affects_stock boolean;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select status,affects_stock into v_status,v_affects_stock from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status='delivered' or v_status='cancelled' then raise exception 'order_cannot_be_cancelled'; end if;
  if exists(select 1 from public.order_payments where order_id=p_order_id) then raise exception 'order_has_payments_remove_them_first'; end if;
  if v_affects_stock and v_status in ('confirmed','preparing','ready') then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,sum(quantity)::integer quantity,
      sum(quantity*coalesce(unit_cost_snapshot,0))/sum(quantity) return_cost
      from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id loop
      update public.product_variants set
        average_cost=((stock_current*coalesce(average_cost,cost,v_item.return_cost))+(v_item.quantity*v_item.return_cost))/(stock_current+v_item.quantity),
        stock_current=stock_current+v_item.quantity,updated_at=now()
      where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,created_by)
      values(v_item.variant_id,'reversal',v_item.quantity,'Cancelación de pedido confirmado',p_order_id,auth.uid());
    end loop;
  end if;
  update public.orders set status='cancelled',updated_at=now() where id=p_order_id;
  if not v_affects_stock and v_status in ('confirmed','preparing','ready') then perform private.rebuild_inventory_average_costs_internal(); end if;
end;
$$;

commit;
