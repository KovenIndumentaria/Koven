begin;

create or replace function public.create_admin_order(p_order jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_quantity integer;
  v_requested_quantity integer;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_affects_stock boolean := coalesce((p_order->>'affects_stock')::boolean, true);
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if length(trim(coalesce(p_order->>'customer_name',''))) < 2 then raise exception 'customer_name_required'; end if;
  if length(public.normalize_customer_phone(p_order->>'customer_phone')) < 6 then raise exception 'customer_phone_required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) < 1 then raise exception 'order_items_required'; end if;

  -- Se valida antes de crear el pedido y nuevamente al confirmarlo.
  if v_affects_stock then
    for v_item in select value from jsonb_array_elements(p_items) loop
      select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid;
      if not found then raise exception 'variant_not_found'; end if;
      select * into v_product from public.products where id=v_variant.product_id;
      if not v_variant.is_active or not v_product.is_active then raise exception 'inactive_variant_for_current_sale'; end if;
      select coalesce(sum((entry.value->>'quantity')::integer),0)::integer into v_requested_quantity
      from jsonb_array_elements(p_items) entry
      where entry.value->>'variant_id' = v_variant.id::text;
      if v_requested_quantity > v_variant.stock_current then raise exception 'insufficient_stock_for_variant_%', v_variant.id; end if;
    end loop;
  end if;

  insert into public.orders(customer_name,customer_phone,delivery_type,delivery_address,subtotal,notes,affects_stock,sale_date)
  values(trim(p_order->>'customer_name'),trim(p_order->>'customer_phone'),coalesce(nullif(p_order->>'delivery_type',''),'pickup')::public.delivery_type,trim(coalesce(p_order->>'delivery_address','')),0,trim(coalesce(p_order->>'notes','')),v_affects_stock,coalesce(nullif(p_order->>'sale_date','')::date,current_date))
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric,-1);
    if v_quantity < 1 or v_quantity > 100000 then raise exception 'invalid_item_quantity'; end if;
    if v_unit_price < 0 then raise exception 'invalid_item_price'; end if;
    select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid;
    if not found then raise exception 'variant_not_found'; end if;
    select * into v_product from public.products where id=v_variant.product_id;
    insert into public.order_items(order_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,unit_cost_snapshot,quantity)
    values(v_order_id,v_variant.id,v_product.name,concat_ws(' · ',nullif(v_variant.color_name,''),nullif(v_variant.size,'')),v_unit_price,coalesce(v_variant.average_cost,v_variant.cost,v_product.default_cost),v_quantity);
    v_subtotal := v_subtotal + v_unit_price*v_quantity;
  end loop;
  update public.orders set subtotal=v_subtotal where id=v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.create_admin_order(jsonb,jsonb) from public;
grant execute on function public.create_admin_order(jsonb,jsonb) to authenticated;

commit;
