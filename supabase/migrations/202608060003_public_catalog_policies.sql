begin;

drop policy if exists public_read_categories on public.categories;
drop policy if exists public_read_products on public.products;
drop policy if exists public_read_active_variants on public.product_variants;
drop policy if exists public_read_product_images on public.product_images;

create policy public_read_categories
on public.categories for select to anon, authenticated
using (is_active);

create policy public_read_products
on public.products for select to anon, authenticated
using (is_active);

create policy public_read_active_variants
on public.product_variants for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.products product
    where product.id = product_id and product.is_active
  )
);

create policy public_read_product_images
on public.product_images for select to anon, authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id and product.is_active
  )
);

commit;
