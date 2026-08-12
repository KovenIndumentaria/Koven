begin;

create or replace function public.create_public_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_order_number bigint; v_subtotal numeric := 0; v_item jsonb; v_product public.products%rowtype; v_variant public.product_variants%rowtype; v_quantity integer; v_count integer; v_existing_quantity integer;
begin
  if length(trim(coalesce(p_order->>'customer_name',''))) < 2 then raise exception 'customer_name_required'; end if;
  if length(trim(coalesce(p_order->>'customer_phone',''))) < 6 then raise exception 'customer_phone_required'; end if;
  if coalesce(p_order->>'delivery_type','') not in ('pickup','shipping') then raise exception 'invalid_delivery_type'; end if;
  if p_order->>'delivery_type' = 'shipping' and length(trim(coalesce(p_order->>'delivery_address',''))) < 5 then raise exception 'delivery_address_required'; end if;
  v_count := jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  if v_count < 1 or v_count > 20 then raise exception 'invalid_item_count'; end if;

  insert into public.orders(customer_name,customer_phone,delivery_type,delivery_address,subtotal)
  values(trim(p_order->>'customer_name'),trim(p_order->>'customer_phone'),(p_order->>'delivery_type')::public.delivery_type,trim(coalesce(p_order->>'delivery_address','')),0)
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    if v_quantity < 1 or v_quantity > 10 then raise exception 'invalid_item_quantity'; end if;
    select * into v_product from public.products where (legacy_sheet_id = v_item->>'product_id' or id::text = v_item->>'product_id') and is_active;
    if not found then raise exception 'product_not_available'; end if;
    select * into v_variant from public.product_variants
      where product_id=v_product.id and is_active
        and lower(trim(size))=lower(trim(coalesce(v_item->>'size','')))
        and lower(trim(color_name))=lower(trim(coalesce(v_item->>'color','')));
    if not found then raise exception 'variant_not_available'; end if;
    select coalesce(sum(quantity),0) into v_existing_quantity from public.order_items where order_id=v_order_id and variant_id=v_variant.id;
    if v_variant.stock_current < v_existing_quantity + v_quantity then raise exception 'variant_not_available'; end if;
    insert into public.order_items(order_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,unit_cost_snapshot,quantity)
    values(v_order_id,v_variant.id,v_product.name,concat_ws(' · ',nullif(v_variant.color_name,''),nullif(v_variant.size,'')),v_product.sale_price,coalesce(v_variant.cost,v_product.default_cost),v_quantity);
    v_subtotal := v_subtotal + v_product.sale_price*v_quantity;
  end loop;
  update public.orders set subtotal=v_subtotal where id=v_order_id;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal);
end; $$;

create or replace function public.advance_order_status(p_order_id uuid, p_status public.order_status)
returns void language plpgsql security definer set search_path='' as $$
declare v_current public.order_status;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select status into v_current from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if not ((v_current='confirmed' and p_status='preparing') or (v_current='preparing' and p_status='ready') or (v_current='ready' and p_status='delivered')) then raise exception 'invalid_status_transition'; end if;
  update public.orders set status=p_status,updated_at=now() where id=p_order_id;
end; $$;

create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_status public.order_status; v_item record;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status='delivered' or v_status='cancelled' then raise exception 'order_cannot_be_cancelled'; end if;
  if v_status in ('confirmed','preparing','ready') then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,sum(quantity)::integer quantity from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id loop
      update public.product_variants set stock_current=stock_current+v_item.quantity,updated_at=now() where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,created_by)
      values(v_item.variant_id,'reversal',v_item.quantity,'Cancelación de pedido confirmado',p_order_id,auth.uid());
    end loop;
  end if;
  update public.orders set status='cancelled',updated_at=now() where id=p_order_id;
end; $$;

revoke all on function public.create_public_order(jsonb,jsonb) from public;
grant execute on function public.create_public_order(jsonb,jsonb) to anon,authenticated;
revoke all on function public.advance_order_status(uuid,public.order_status) from public;
revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.advance_order_status(uuid,public.order_status),public.cancel_order(uuid) to authenticated;

commit;
