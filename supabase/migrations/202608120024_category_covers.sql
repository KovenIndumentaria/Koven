begin;

alter table public.store_settings
  add column if not exists category_cover_remeras text not null default 'https://i.ibb.co/TB1J9gsH/BEBAS-NEUE-5.png',
  add column if not exists category_cover_abrigos text not null default 'https://i.ibb.co/v6PCvd4Q/YOU-HAD-4.png',
  add column if not exists category_cover_pantalones text not null default 'https://i.ibb.co/DfrY3W9z/BAGGY-725-1.png',
  add column if not exists category_cover_gorras text not null default 'https://i.ibb.co/d4H9wcgn/IMG-7438.jpg',
  add column if not exists category_cover_medias text not null default 'https://i.ibb.co/5hqDWNxw/IMG-7355.jpg',
  add column if not exists category_cover_accesorios text not null default 'https://i.ibb.co/ppR1bfy/Reloj-negro-mate.jpg';

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] in ('products', 'categories')
  and lower(storage.extension(name)) = 'webp'
  and (select private.is_admin())
);

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()))
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] in ('products', 'categories')
  and lower(storage.extension(name)) = 'webp'
  and (select private.is_admin())
);

commit;
