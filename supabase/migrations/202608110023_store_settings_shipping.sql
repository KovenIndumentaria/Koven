begin;

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'KOVEN',
  whatsapp_number text not null default '5493517557401',
  instagram_url text not null default 'https://www.instagram.com/koven.indumentaria/',
  pickup_enabled boolean not null default true,
  pickup_address text not null default 'Arturo M Bas 389 - Córdoba Capital',
  shipping_enabled boolean not null default true,
  shipping_mode text not null default 'coordinate' check (shipping_mode in ('coordinate','flat')),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  free_shipping_from numeric(12,2) check (free_shipping_from is null or free_shipping_from >= 0),
  checkout_message text not null default 'Coordinamos el pago y la entrega por WhatsApp.',
  sales_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(true);
alter table public.store_settings enable row level security;
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
create policy public_read_store_settings on public.store_settings for select to anon, authenticated using (true);
create policy admin_update_store_settings on public.store_settings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.orders add column shipping_amount numeric(12,2) not null default 0 check (shipping_amount >= 0);

create trigger activity_store_settings after update on public.store_settings for each row execute function private.write_activity_log();

create or replace function public.create_public_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_order_number bigint; v_products_total numeric := 0; v_shipping numeric := 0; v_item jsonb; v_product public.products%rowtype; v_variant public.product_variants%rowtype; v_quantity integer; v_count integer; v_existing_quantity integer; v_settings public.store_settings%rowtype; v_delivery public.delivery_type;
begin
  select * into v_settings from public.store_settings where id=true;
  if not v_settings.sales_enabled then raise exception 'online_sales_disabled'; end if;
  if length(trim(coalesce(p_order->>'customer_name',''))) < 2 then raise exception 'customer_name_required'; end if;
  if length(trim(coalesce(p_order->>'customer_phone',''))) < 6 then raise exception 'customer_phone_required'; end if;
  if coalesce(p_order->>'delivery_type','') not in ('pickup','shipping') then raise exception 'invalid_delivery_type'; end if;
  v_delivery := (p_order->>'delivery_type')::public.delivery_type;
  if v_delivery='pickup' and not v_settings.pickup_enabled then raise exception 'pickup_disabled'; end if;
  if v_delivery='shipping' and not v_settings.shipping_enabled then raise exception 'shipping_disabled'; end if;
  if v_delivery='shipping' and length(trim(coalesce(p_order->>'delivery_address',''))) < 5 then raise exception 'delivery_address_required'; end if;
  v_count := jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  if v_count < 1 or v_count > 20 then raise exception 'invalid_item_count'; end if;
  insert into public.orders(customer_name,customer_phone,delivery_type,delivery_address,subtotal,shipping_amount)
  values(trim(p_order->>'customer_name'),trim(p_order->>'customer_phone'),v_delivery,trim(coalesce(p_order->>'delivery_address','')),0,0)
  returning id,order_number into v_order_id,v_order_number;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    if v_quantity < 1 or v_quantity > 10 then raise exception 'invalid_item_quantity'; end if;
    select * into v_product from public.products where (legacy_sheet_id=v_item->>'product_id' or id::text=v_item->>'product_id') and is_active;
    if not found then raise exception 'product_not_available'; end if;
    select * into v_variant from public.product_variants where product_id=v_product.id and is_active and lower(trim(size))=lower(trim(coalesce(v_item->>'size',''))) and lower(trim(color_name))=lower(trim(coalesce(v_item->>'color','')));
    if not found then raise exception 'variant_not_available'; end if;
    select coalesce(sum(quantity),0) into v_existing_quantity from public.order_items where order_id=v_order_id and variant_id=v_variant.id;
    if v_variant.stock_current < v_existing_quantity+v_quantity then raise exception 'variant_not_available'; end if;
    insert into public.order_items(order_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,unit_cost_snapshot,quantity)
    values(v_order_id,v_variant.id,v_product.name,concat_ws(' · ',nullif(v_variant.color_name,''),nullif(v_variant.size,'')),v_product.sale_price,coalesce(v_variant.average_cost,v_variant.cost,v_product.default_cost),v_quantity);
    v_products_total := v_products_total+v_product.sale_price*v_quantity;
  end loop;
  if v_delivery='shipping' and v_settings.shipping_mode='flat' then
    v_shipping := case when v_settings.free_shipping_from is not null and v_products_total>=v_settings.free_shipping_from then 0 else v_settings.shipping_cost end;
  end if;
  update public.orders set subtotal=v_products_total+v_shipping,shipping_amount=v_shipping where id=v_order_id;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_products_total+v_shipping,'products_total',v_products_total,'shipping_amount',v_shipping);
end; $$;

commit;
