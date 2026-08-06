begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();
create trigger purchases_set_updated_at before update on public.supplier_purchases
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.save_product(p_product jsonb, p_variants jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_saved_variant_ids uuid[] := '{}';
  v_name text := trim(coalesce(p_product->>'name', ''));
  v_price numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if v_name = '' then raise exception 'product_name_required'; end if;
  if jsonb_typeof(coalesce(p_variants, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_variants, '[]'::jsonb)) = 0 then
    raise exception 'at_least_one_variant_required';
  end if;

  v_price := (p_product->>'sale_price')::numeric;
  if v_price < 0 then raise exception 'invalid_sale_price'; end if;

  if nullif(p_product->>'id', '') is null then
    insert into public.products (
      legacy_sheet_id, category_id, name, description, sale_price, default_cost,
      style, is_active, is_featured, is_new
    ) values (
      nullif(p_product->>'legacy_sheet_id', ''), nullif(p_product->>'category_id', '')::bigint,
      v_name, coalesce(p_product->>'description', ''), v_price,
      nullif(p_product->>'default_cost', '')::numeric, coalesce(p_product->>'style', ''),
      coalesce((p_product->>'is_active')::boolean, true),
      coalesce((p_product->>'is_featured')::boolean, false),
      coalesce((p_product->>'is_new')::boolean, false)
    ) returning id into v_product_id;
  else
    v_product_id := (p_product->>'id')::uuid;
    update public.products set
      legacy_sheet_id = nullif(p_product->>'legacy_sheet_id', ''),
      category_id = nullif(p_product->>'category_id', '')::bigint,
      name = v_name,
      description = coalesce(p_product->>'description', ''),
      sale_price = v_price,
      default_cost = nullif(p_product->>'default_cost', '')::numeric,
      style = coalesce(p_product->>'style', ''),
      is_active = coalesce((p_product->>'is_active')::boolean, true),
      is_featured = coalesce((p_product->>'is_featured')::boolean, false),
      is_new = coalesce((p_product->>'is_new')::boolean, false)
    where id = v_product_id;
    if not found then raise exception 'product_not_found'; end if;
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    if coalesce((v_variant->>'stock_current')::integer, 0) < 0 then raise exception 'negative_stock_not_allowed'; end if;

    if nullif(v_variant->>'id', '') is null then
      insert into public.product_variants (
        product_id, size, color_name, color_hex, sku, stock_current, cost, is_active
      ) values (
        v_product_id, trim(coalesce(v_variant->>'size', '')), trim(coalesce(v_variant->>'color_name', '')),
        trim(coalesce(v_variant->>'color_hex', '')), nullif(trim(coalesce(v_variant->>'sku', '')), ''),
        coalesce((v_variant->>'stock_current')::integer, 0), nullif(v_variant->>'cost', '')::numeric,
        coalesce((v_variant->>'is_active')::boolean, true)
      ) returning id into v_variant_id;
    else
      v_variant_id := (v_variant->>'id')::uuid;
      update public.product_variants set
        size = trim(coalesce(v_variant->>'size', '')),
        color_name = trim(coalesce(v_variant->>'color_name', '')),
        color_hex = trim(coalesce(v_variant->>'color_hex', '')),
        sku = nullif(trim(coalesce(v_variant->>'sku', '')), ''),
        stock_current = coalesce((v_variant->>'stock_current')::integer, 0),
        cost = nullif(v_variant->>'cost', '')::numeric,
        is_active = coalesce((v_variant->>'is_active')::boolean, true)
      where id = v_variant_id and product_id = v_product_id;
      if not found then raise exception 'variant_not_found'; end if;
    end if;

    v_saved_variant_ids := array_append(v_saved_variant_ids, v_variant_id);
  end loop;

  update public.product_variants
  set is_active = false
  where product_id = v_product_id and not (id = any(v_saved_variant_ids));

  return v_product_id;
end;
$$;

revoke all on function public.save_product(jsonb, jsonb) from public;
grant execute on function public.save_product(jsonb, jsonb) to authenticated;

commit;
