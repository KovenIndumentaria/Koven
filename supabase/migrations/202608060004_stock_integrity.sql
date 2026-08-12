begin;

insert into public.stock_movements (variant_id, movement_type, quantity_delta, reason, created_by)
select variant.id, 'adjustment', variant.stock_current, 'Stock inicial migrado desde Google Sheets', null
from public.product_variants variant
where variant.stock_current > 0
  and not exists (select 1 from public.stock_movements movement where movement.variant_id = variant.id);

create or replace function public.guard_stock_updates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock_current <> old.stock_current
     and coalesce(current_setting('koven.allow_stock_change', true), 'false') <> 'true' then
    raise exception 'stock_must_change_through_inventory_operation';
  end if;
  return new;
end;
$$;

create trigger product_variants_guard_stock
before update of stock_current on public.product_variants
for each row execute function public.guard_stock_updates();

create or replace function public.record_initial_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_current > 0 then
    insert into public.stock_movements (variant_id, movement_type, quantity_delta, reason, created_by)
    values (new.id, 'adjustment', new.stock_current, 'Stock inicial de variante', auth.uid());
  end if;
  return new;
end;
$$;

create trigger product_variants_record_initial_stock
after insert on public.product_variants
for each row execute function public.record_initial_variant_stock();

create or replace function public.adjust_stock(p_variant_id uuid, p_quantity_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_new_stock integer;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if p_quantity_delta = 0 then raise exception 'quantity_delta_cannot_be_zero'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required'; end if;
  perform set_config('koven.allow_stock_change', 'true', true);

  update public.product_variants
  set stock_current = stock_current + p_quantity_delta, updated_at = now()
  where id = p_variant_id and stock_current + p_quantity_delta >= 0
  returning stock_current into v_new_stock;

  if v_new_stock is null then raise exception 'variant_not_found_or_insufficient_stock'; end if;
  insert into public.stock_movements(variant_id, movement_type, quantity_delta, reason, created_by)
  values (p_variant_id, 'adjustment', p_quantity_delta, trim(p_reason), auth.uid());
  return v_new_stock;
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item record;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  perform 1 from public.supplier_purchases where id = p_purchase_id and status = 'draft' for update;
  if not found then raise exception 'purchase_not_found_or_already_processed'; end if;
  if not exists (select 1 from public.supplier_purchase_items where purchase_id = p_purchase_id) then raise exception 'purchase_has_no_items'; end if;
  perform set_config('koven.allow_stock_change', 'true', true);

  for v_item in select variant_id, quantity, unit_cost from public.supplier_purchase_items where purchase_id = p_purchase_id loop
    update public.product_variants set stock_current = stock_current + v_item.quantity, cost = v_item.unit_cost, updated_at = now() where id = v_item.variant_id;
    insert into public.stock_movements(variant_id, movement_type, quantity_delta, reason, purchase_id, created_by)
    values (v_item.variant_id, 'purchase', v_item.quantity, 'Compra a proveedor confirmada', p_purchase_id, auth.uid());
  end loop;

  update public.supplier_purchases
  set status = 'confirmed', confirmed_at = now(), updated_at = now(),
      total_cost = (select coalesce(sum(quantity * unit_cost), 0) from public.supplier_purchase_items where purchase_id = p_purchase_id)
  where id = p_purchase_id;
end;
$$;

create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item record;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  perform 1 from public.orders where id = p_order_id and status = 'pending_confirmation' for update;
  if not found then raise exception 'order_not_found_or_already_processed'; end if;
  perform set_config('koven.allow_stock_change', 'true', true);

  for v_item in
    select variant_id, sum(quantity)::integer quantity
    from public.order_items where order_id = p_order_id and variant_id is not null group by variant_id order by variant_id
  loop
    update public.product_variants
    set stock_current = stock_current - v_item.quantity, updated_at = now()
    where id = v_item.variant_id and stock_current >= v_item.quantity;
    if not found then raise exception 'insufficient_stock_for_variant_%', v_item.variant_id; end if;
    insert into public.stock_movements(variant_id, movement_type, quantity_delta, reason, order_id, created_by)
    values (v_item.variant_id, 'sale', -v_item.quantity, 'Venta online confirmada', p_order_id, auth.uid());
  end loop;

  update public.orders set status = 'confirmed', confirmed_at = now(), updated_at = now() where id = p_order_id;
end;
$$;

commit;
