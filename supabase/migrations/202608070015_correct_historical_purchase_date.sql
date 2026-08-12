begin;

-- Mantiene inmutables las compras procesadas salvo durante esta corrección acotada.
create or replace function public.guard_purchase_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'processed_purchase_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft'
    and coalesce(current_setting('koven.allow_purchase_date_correction', true), '') <> 'true' then
    raise exception 'processed_purchase_is_immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.correct_historical_purchase_date(p_purchase_id uuid, p_purchase_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old_date date;
  v_product_id uuid;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if p_purchase_date is null or p_purchase_date > current_date then raise exception 'invalid_purchase_date'; end if;

  select purchase_date into v_old_date
  from public.supplier_purchases
  where id = p_purchase_id and status = 'confirmed' and affects_stock = false
  for update;

  if not found then raise exception 'confirmed_historical_purchase_required'; end if;
  if v_old_date = p_purchase_date then raise exception 'purchase_date_unchanged'; end if;

  perform set_config('koven.allow_purchase_date_correction', 'true', true);
  update public.supplier_purchases
  set purchase_date = p_purchase_date, updated_at = now()
  where id = p_purchase_id;

  -- Solo acompaña la corrección el pago creado automáticamente al confirmar.
  update public.supplier_purchase_payments
  set payment_date = p_purchase_date
  where purchase_id = p_purchase_id and notes = 'Pago total al confirmar' and payment_date = v_old_date;

  perform private.rebuild_inventory_average_costs_internal();
  for v_product_id in
    select distinct variant.product_id
    from public.supplier_purchase_items item
    join public.product_variants variant on variant.id = item.variant_id
    where item.purchase_id = p_purchase_id
  loop
    perform private.refresh_product_reference_cost(v_product_id);
  end loop;
end;
$$;

revoke all on function public.correct_historical_purchase_date(uuid, date) from public;
grant execute on function public.correct_historical_purchase_date(uuid, date) to authenticated;

commit;
