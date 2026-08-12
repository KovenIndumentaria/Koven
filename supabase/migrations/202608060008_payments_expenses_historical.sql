begin;

alter table public.orders add column affects_stock boolean not null default true;
alter table public.orders add column sale_date date not null default current_date;
alter table public.supplier_purchases add column affects_stock boolean not null default true;

create type public.payment_method as enum ('cash', 'transfer', 'card', 'other');
create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method public.payment_method not null default 'transfer',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index order_payments_order_date_idx on public.order_payments(order_id, payment_date desc);

create type public.expense_category as enum ('packaging', 'shipping', 'marketing', 'fees', 'transport', 'services', 'other');
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category public.expense_category not null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null check (length(trim(description)) >= 2),
  notes text not null default '',
  order_id uuid references public.orders(id) on delete restrict,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(expense_date desc);

alter table public.order_payments enable row level security;
alter table public.expenses enable row level security;
grant select, insert, update, delete on public.order_payments, public.expenses to authenticated;
create policy admin_all_order_payments on public.order_payments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_all_expenses on public.expenses for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.guard_order_stock_mode()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.affects_stock is distinct from new.affects_stock and old.status <> 'pending_confirmation' then raise exception 'confirmed_order_stock_mode_is_immutable'; end if;
  return new;
end;
$$;
create trigger orders_guard_stock_mode before update of affects_stock on public.orders for each row execute function public.guard_order_stock_mode();

create or replace function public.save_purchase(p_purchase jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_purchase_id uuid; v_item jsonb;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if nullif(p_purchase->>'supplier_id','') is null then raise exception 'supplier_required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'purchase_items_required'; end if;
  if nullif(p_purchase->>'id','') is null then
    insert into public.supplier_purchases(supplier_id,purchase_date,notes,affects_stock,created_by)
    values((p_purchase->>'supplier_id')::uuid,coalesce(nullif(p_purchase->>'purchase_date','')::date,current_date),coalesce(p_purchase->>'notes',''),coalesce((p_purchase->>'affects_stock')::boolean,true),auth.uid()) returning id into v_purchase_id;
  else
    v_purchase_id := (p_purchase->>'id')::uuid;
    update public.supplier_purchases set supplier_id=(p_purchase->>'supplier_id')::uuid,purchase_date=coalesce(nullif(p_purchase->>'purchase_date','')::date,current_date),notes=coalesce(p_purchase->>'notes',''),affects_stock=coalesce((p_purchase->>'affects_stock')::boolean,true) where id=v_purchase_id and status='draft';
    if not found then raise exception 'draft_purchase_not_found'; end if;
    delete from public.supplier_purchase_items where purchase_id=v_purchase_id;
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::integer,0)<=0 then raise exception 'invalid_purchase_quantity'; end if;
    if coalesce((v_item->>'unit_cost')::numeric,-1)<0 then raise exception 'invalid_purchase_cost'; end if;
    insert into public.supplier_purchase_items(purchase_id,variant_id,quantity,unit_cost) values(v_purchase_id,(v_item->>'variant_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_cost')::numeric);
  end loop;
  update public.supplier_purchases set total_cost=(select coalesce(sum(quantity*unit_cost),0) from public.supplier_purchase_items where purchase_id=v_purchase_id) where id=v_purchase_id;
  return v_purchase_id;
end;
$$;

create or replace function public.add_order_payment(p_order_id uuid, p_amount numeric, p_payment_date date, p_method public.payment_method, p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_payment_id uuid; v_subtotal numeric; v_paid numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select subtotal into v_subtotal from public.orders where id = p_order_id and status <> 'cancelled' for update;
  if not found then raise exception 'order_not_available'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.order_payments where order_id = p_order_id;
  if p_amount <= 0 then raise exception 'invalid_payment_amount'; end if;
  if v_paid + p_amount > v_subtotal then raise exception 'payment_exceeds_balance'; end if;
  insert into public.order_payments(order_id, amount, payment_date, method, notes, created_by)
  values(p_order_id, p_amount, coalesce(p_payment_date,current_date), p_method, trim(coalesce(p_notes,'')), auth.uid()) returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.add_order_payment(uuid,numeric,date,public.payment_method,text) from public;
grant execute on function public.add_order_payment(uuid,numeric,date,public.payment_method,text) to authenticated;

create or replace function public.confirm_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item record; v_affects_stock boolean;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select affects_stock into v_affects_stock from public.orders where id=p_order_id and status='pending_confirmation' for update;
  if not found then raise exception 'order_not_found_or_already_processed'; end if;
  if v_affects_stock then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,sum(quantity)::integer quantity from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id order by variant_id loop
      update public.product_variants set stock_current=stock_current-v_item.quantity,updated_at=now() where id=v_item.variant_id and stock_current>=v_item.quantity;
      if not found then raise exception 'insufficient_stock_for_variant_%',v_item.variant_id; end if;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,created_by)
      values(v_item.variant_id,'sale',-v_item.quantity,'Venta confirmada',p_order_id,auth.uid());
    end loop;
  end if;
  update public.orders set status='confirmed',confirmed_at=now(),updated_at=now() where id=p_order_id;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_status public.order_status; v_item record; v_affects_stock boolean;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select status,affects_stock into v_status,v_affects_stock from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status='delivered' or v_status='cancelled' then raise exception 'order_cannot_be_cancelled'; end if;
  if exists(select 1 from public.order_payments where order_id=p_order_id) then raise exception 'order_has_payments_remove_them_first'; end if;
  if v_affects_stock and v_status in ('confirmed','preparing','ready') then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,sum(quantity)::integer quantity from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id loop
      update public.product_variants set stock_current=stock_current+v_item.quantity,updated_at=now() where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,created_by)
      values(v_item.variant_id,'reversal',v_item.quantity,'Cancelación de pedido confirmado',p_order_id,auth.uid());
    end loop;
  end if;
  update public.orders set status='cancelled',updated_at=now() where id=p_order_id;
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item record; v_affects_stock boolean;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select affects_stock into v_affects_stock from public.supplier_purchases where id=p_purchase_id and status='draft' for update;
  if not found then raise exception 'purchase_not_found_or_already_processed'; end if;
  if not exists(select 1 from public.supplier_purchase_items where purchase_id=p_purchase_id) then raise exception 'purchase_has_no_items'; end if;
  if v_affects_stock then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,quantity,unit_cost from public.supplier_purchase_items where purchase_id=p_purchase_id loop
      update public.product_variants set stock_current=stock_current+v_item.quantity,cost=v_item.unit_cost,updated_at=now() where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,purchase_id,created_by)
      values(v_item.variant_id,'purchase',v_item.quantity,'Compra a proveedor confirmada',p_purchase_id,auth.uid());
    end loop;
  end if;
  update public.supplier_purchases set status='confirmed',confirmed_at=now(),updated_at=now(),total_cost=(select coalesce(sum(quantity*unit_cost),0) from public.supplier_purchase_items where purchase_id=p_purchase_id) where id=p_purchase_id;
end;
$$;

commit;
