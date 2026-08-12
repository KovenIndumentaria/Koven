begin;

-- Recupera el último costo confirmado de cada variante, sin modificar existencias.
with latest_cost as (
  select distinct on (item.variant_id)
    item.variant_id,
    item.unit_cost
  from public.supplier_purchase_items item
  join public.supplier_purchases purchase on purchase.id = item.purchase_id
  where purchase.status = 'confirmed'
  order by item.variant_id, purchase.purchase_date desc, purchase.confirmed_at desc nulls last, purchase.created_at desc
)
update public.product_variants variant
set cost = latest_cost.unit_cost,
    updated_at = now()
from latest_cost
where variant.id = latest_cost.variant_id;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
  v_affects_stock boolean;
  v_extra_cost numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;

  select affects_stock, extra_cost
  into v_affects_stock, v_extra_cost
  from public.supplier_purchases
  where id = p_purchase_id and status = 'draft'
  for update;

  if not found then raise exception 'purchase_not_found_or_already_processed'; end if;
  if not exists (select 1 from public.supplier_purchase_items where purchase_id = p_purchase_id) then
    raise exception 'purchase_has_no_items';
  end if;

  if v_affects_stock then
    perform set_config('koven.allow_stock_change', 'true', true);
  end if;

  for v_item in
    select variant_id, quantity, unit_cost
    from public.supplier_purchase_items
    where purchase_id = p_purchase_id
  loop
    -- El costo se actualiza siempre, incluso en compras históricas.
    if v_affects_stock then
      update public.product_variants
      set cost = v_item.unit_cost,
          stock_current = stock_current + v_item.quantity,
          updated_at = now()
      where id = v_item.variant_id;

      insert into public.stock_movements(variant_id, movement_type, quantity_delta, reason, purchase_id, created_by)
      values(v_item.variant_id, 'purchase', v_item.quantity, 'Compra a proveedor confirmada', p_purchase_id, auth.uid());
    else
      update public.product_variants
      set cost = v_item.unit_cost,
          updated_at = now()
      where id = v_item.variant_id;
    end if;
  end loop;

  update public.supplier_purchases
  set status = 'confirmed',
      confirmed_at = now(),
      updated_at = now(),
      total_cost = (select coalesce(sum(quantity * unit_cost), 0) from public.supplier_purchase_items where purchase_id = p_purchase_id) + v_extra_cost
  where id = p_purchase_id;
end;
$$;

commit;
