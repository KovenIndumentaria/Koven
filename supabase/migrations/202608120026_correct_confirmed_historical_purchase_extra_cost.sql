begin;

create or replace function public.guard_purchase_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then raise exception 'processed_purchase_is_immutable'; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft'
    and coalesce(current_setting('koven.allow_purchase_date_correction', true), '') <> 'true'
    and not (
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

create or replace function public.correct_confirmed_historical_purchase_extra_cost(
  p_purchase_id uuid,
  p_extra_cost numeric,
  p_description text default 'Envío'
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_purchase public.supplier_purchases%rowtype;
  v_old_total numeric;
  v_new_total numeric;
  v_merchandise_total numeric;
  v_auto_payment_id uuid;
  v_product_id uuid;
begin
  if not private.is_admin() and session_user not in ('postgres', 'supabase_admin') then raise exception 'not_authorized'; end if;
  if p_extra_cost is null or p_extra_cost < 0 then raise exception 'invalid_extra_cost'; end if;

  select * into v_purchase from public.supplier_purchases where id = p_purchase_id for update;
  if not found then raise exception 'purchase_not_found'; end if;
  if v_purchase.status <> 'confirmed' or v_purchase.affects_stock then raise exception 'confirmed_historical_purchase_required'; end if;
  if v_purchase.extra_cost = p_extra_cost then raise exception 'extra_cost_unchanged'; end if;

  select coalesce(sum(quantity * unit_cost), 0) into v_merchandise_total
  from public.supplier_purchase_items where purchase_id = p_purchase_id;
  v_old_total := v_purchase.total_cost;
  v_new_total := v_merchandise_total + p_extra_cost;

  -- Solo acompaña el cambio un único pago automático que cubría exactamente el total anterior.
  select min(id::text)::uuid into v_auto_payment_id
  from public.supplier_purchase_payments
  where purchase_id = p_purchase_id
    and amount = v_old_total
    and notes in ('Pago total al confirmar', 'Pago inicial migrado')
  having count(*) = 1 and (select count(*) from public.supplier_purchase_payments where purchase_id = p_purchase_id) = 1;

  perform set_config('koven.allow_purchase_date_correction', 'true', true);
  update public.supplier_purchases
  set extra_cost = p_extra_cost,
      extra_cost_description = trim(coalesce(p_description, '')),
      total_cost = v_new_total,
      updated_at = now()
  where id = p_purchase_id;

  if v_auto_payment_id is not null then
    update public.supplier_purchase_payments set amount = v_new_total where id = v_auto_payment_id;
  end if;

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

revoke all on function public.correct_confirmed_historical_purchase_extra_cost(uuid, numeric, text) from public;
grant execute on function public.correct_confirmed_historical_purchase_extra_cost(uuid, numeric, text) to authenticated;

commit;
