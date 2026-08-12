begin;

create or replace function public.guard_purchase_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then raise exception 'processed_purchase_is_immutable'; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' and not (
    old.status = 'confirmed' and new.status = 'cancelled'
    and not exists (select 1 from public.supplier_purchase_payments payment where payment.purchase_id = old.id)
    and not exists (
      select 1 from public.supplier_purchase_items item
      where item.purchase_id = old.id and coalesce((
        select -sum(movement.quantity_delta) from public.stock_movements movement
        where movement.purchase_id = old.id and movement.variant_id = item.variant_id and movement.movement_type = 'reversal'
      ), 0) < item.quantity
    )
  ) then raise exception 'processed_purchase_is_immutable'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.cancel_confirmed_purchase(p_purchase_id uuid, p_reason text default 'Compra anulada')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_purchase public.supplier_purchases%rowtype;
  v_item record;
  v_product_id uuid;
begin
  if not private.is_admin() and session_user not in ('postgres', 'supabase_admin') then raise exception 'not_authorized'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'cancellation_reason_required'; end if;

  select * into v_purchase from public.supplier_purchases where id = p_purchase_id for update;
  if not found then raise exception 'purchase_not_found'; end if;
  if v_purchase.status <> 'confirmed' then raise exception 'purchase_is_not_confirmed'; end if;
  if not v_purchase.affects_stock then raise exception 'purchase_did_not_affect_stock'; end if;

  for v_item in
    select item.variant_id, item.quantity, variant.stock_current
    from public.supplier_purchase_items item
    join public.product_variants variant on variant.id = item.variant_id
    where item.purchase_id = p_purchase_id
    for update of variant
  loop
    if v_item.stock_current < v_item.quantity then
      raise exception 'insufficient_stock_to_reverse_purchase: variant %, available %, required %', v_item.variant_id, v_item.stock_current, v_item.quantity;
    end if;
  end loop;

  perform set_config('koven.allow_stock_change', 'true', true);
  for v_item in select variant_id, quantity from public.supplier_purchase_items where purchase_id = p_purchase_id loop
    update public.product_variants set stock_current = stock_current - v_item.quantity, updated_at = now() where id = v_item.variant_id;
    insert into public.stock_movements(variant_id, movement_type, quantity_delta, reason, purchase_id, created_by)
    values(v_item.variant_id, 'reversal', -v_item.quantity, trim(p_reason), p_purchase_id, auth.uid());
  end loop;

  delete from public.supplier_purchase_payments where purchase_id = p_purchase_id;
  update public.supplier_purchases
  set status = 'cancelled', notes = concat_ws(E'\n', nullif(notes, ''), 'ANULADA: ' || trim(p_reason)), updated_at = now()
  where id = p_purchase_id;

  update public.product_variants variant set cost = null, average_cost = null
  where variant.id in (select item.variant_id from public.supplier_purchase_items item where item.purchase_id = p_purchase_id);
  perform private.rebuild_inventory_average_costs_internal();

  for v_product_id in
    select distinct variant.product_id from public.supplier_purchase_items item
    join public.product_variants variant on variant.id = item.variant_id
    where item.purchase_id = p_purchase_id
  loop
    update public.products product set default_cost = (
      select sum(item.unit_cost * item.quantity) / sum(item.quantity)
      from public.supplier_purchase_items item
      join public.supplier_purchases purchase on purchase.id = item.purchase_id
      join public.product_variants variant on variant.id = item.variant_id
      where variant.product_id = v_product_id and purchase.status = 'confirmed'
      group by purchase.id, purchase.purchase_date, purchase.confirmed_at, purchase.created_at
      order by purchase.purchase_date desc, purchase.confirmed_at desc nulls last, purchase.created_at desc
      limit 1
    ), updated_at = now() where product.id = v_product_id;
  end loop;
end;
$$;

revoke all on function public.cancel_confirmed_purchase(uuid, text) from public;
grant execute on function public.cancel_confirmed_purchase(uuid, text) to authenticated;

commit;
