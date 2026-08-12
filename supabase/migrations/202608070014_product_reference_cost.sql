begin;

-- El costo de referencia pertenece al producto. El costo real de cada operación
-- y el promedio contable permanecen por variante para preservar la trazabilidad.
create or replace function private.refresh_product_reference_cost(p_product_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.products product
  set default_cost = latest.unit_cost,
      updated_at = now()
  from (
    select sum(item.unit_cost * item.quantity) / sum(item.quantity) as unit_cost
    from public.supplier_purchase_items item
    join public.supplier_purchases purchase on purchase.id = item.purchase_id
    join public.product_variants variant on variant.id = item.variant_id
    where variant.product_id = p_product_id
      and purchase.status = 'confirmed'
    group by purchase.id, purchase.purchase_date, purchase.confirmed_at, purchase.created_at
    order by purchase.purchase_date desc, purchase.confirmed_at desc nulls last,
      purchase.created_at desc
    limit 1
  ) latest
  where product.id = p_product_id;
$$;
revoke all on function private.refresh_product_reference_cost(uuid) from public, authenticated;

create or replace function public.sync_purchase_product_reference_costs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_product_id uuid;
begin
  if old.status = 'draft' and new.status = 'confirmed' then
    for v_product_id in
      select distinct variant.product_id
      from public.supplier_purchase_items item
      join public.product_variants variant on variant.id = item.variant_id
      where item.purchase_id = new.id
    loop
      perform private.refresh_product_reference_cost(v_product_id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger supplier_purchases_sync_product_cost
after update of status on public.supplier_purchases
for each row execute function public.sync_purchase_product_reference_costs();

do $$ declare v_product_id uuid;
begin
  for v_product_id in
    select distinct variant.product_id
    from public.supplier_purchase_items item
    join public.supplier_purchases purchase on purchase.id = item.purchase_id
    join public.product_variants variant on variant.id = item.variant_id
    where purchase.status = 'confirmed'
  loop
    perform private.refresh_product_reference_cost(v_product_id);
  end loop;
end $$;

commit;
