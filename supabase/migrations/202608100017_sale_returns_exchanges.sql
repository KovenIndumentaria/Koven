begin;

create table public.sale_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  operation_type text not null check (operation_type in ('return','exchange')),
  operation_date date not null default current_date,
  returned_total numeric(14,2) not null check (returned_total >= 0),
  replacement_total numeric(14,2) not null default 0 check (replacement_total >= 0),
  difference numeric(14,2) not null,
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.sale_adjustment_return_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  restock boolean not null default true,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(14,4),
  unique(adjustment_id, order_item_id)
);
create table public.sale_adjustment_replacement_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(14,4),
  unique(adjustment_id, variant_id)
);
create table public.sale_adjustment_payments (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id) on delete restrict,
  direction text not null check (direction in ('collection','refund')),
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method public.payment_method not null default 'transfer',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.stock_movements add column sale_adjustment_id uuid references public.sale_adjustments(id) on delete restrict;

create index sale_adjustments_order_date_idx on public.sale_adjustments(order_id,operation_date desc);
create index sale_adjustment_payments_date_idx on public.sale_adjustment_payments(payment_date desc);

alter table public.sale_adjustments enable row level security;
alter table public.sale_adjustment_return_items enable row level security;
alter table public.sale_adjustment_replacement_items enable row level security;
alter table public.sale_adjustment_payments enable row level security;
grant select,insert on public.sale_adjustments,public.sale_adjustment_return_items,public.sale_adjustment_replacement_items,public.sale_adjustment_payments to authenticated;
create policy admin_sale_adjustments on public.sale_adjustments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_sale_adjustment_returns on public.sale_adjustment_return_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_sale_adjustment_replacements on public.sale_adjustment_replacement_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_sale_adjustment_payments on public.sale_adjustment_payments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.create_sale_adjustment(p_order_id uuid,p_operation jsonb,p_returns jsonb,p_replacements jsonb,p_settlement jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_adjustment_id uuid; v_order public.orders%rowtype; v_item jsonb; v_original public.order_items%rowtype;
  v_variant public.product_variants%rowtype; v_product public.products%rowtype;
  v_quantity integer; v_previous integer; v_requested integer; v_price numeric; v_cost numeric;
  v_returned_total numeric:=0; v_replacement_total numeric:=0; v_difference numeric;
  v_type text:=p_operation->>'operation_type'; v_restock boolean; v_amount numeric; v_direction text;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select * into v_order from public.orders where id=p_order_id and status in ('confirmed','preparing','ready','delivered') for update;
  if not found then raise exception 'confirmed_order_required'; end if;
  if v_type not in ('return','exchange') then raise exception 'invalid_adjustment_type'; end if;
  if jsonb_array_length(coalesce(p_returns,'[]'::jsonb))<1 then raise exception 'returned_items_required'; end if;
  if v_type='return' and jsonb_array_length(coalesce(p_replacements,'[]'::jsonb))>0 then raise exception 'return_cannot_have_replacements'; end if;

  for v_item in select value from jsonb_array_elements(p_returns) loop
    v_quantity:=coalesce((v_item->>'quantity')::integer,0);
    select * into v_original from public.order_items where id=(v_item->>'order_item_id')::uuid and order_id=p_order_id;
    if not found or v_quantity<1 then raise exception 'invalid_return_item'; end if;
    select coalesce(sum(returned.quantity),0) into v_previous from public.sale_adjustment_return_items returned join public.sale_adjustments adjustment on adjustment.id=returned.adjustment_id where adjustment.order_id=p_order_id and returned.order_item_id=v_original.id;
    if v_previous+v_quantity>v_original.quantity then raise exception 'return_quantity_exceeds_sale'; end if;
    v_returned_total:=v_returned_total+v_quantity*v_original.unit_price;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_replacements,'[]'::jsonb)) loop
    v_quantity:=coalesce((v_item->>'quantity')::integer,0); v_price:=coalesce((v_item->>'unit_price')::numeric,-1);
    select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid;
    if not found or v_quantity<1 or v_price<0 then raise exception 'invalid_replacement_item'; end if;
    select * into v_product from public.products where id=v_variant.product_id;
    if v_order.affects_stock and (not v_variant.is_active or not v_product.is_active) then raise exception 'inactive_replacement_variant'; end if;
    if v_order.affects_stock then
      select coalesce(sum((entry.value->>'quantity')::integer),0)::integer into v_requested from jsonb_array_elements(p_replacements) entry where entry.value->>'variant_id'=v_variant.id::text;
      if v_requested>v_variant.stock_current then raise exception 'insufficient_replacement_stock'; end if;
    end if;
    v_replacement_total:=v_replacement_total+v_quantity*v_price;
  end loop;
  if v_type='exchange' and jsonb_array_length(coalesce(p_replacements,'[]'::jsonb))<1 then raise exception 'replacement_items_required'; end if;
  v_difference:=v_replacement_total-v_returned_total;

  insert into public.sale_adjustments(order_id,operation_type,operation_date,returned_total,replacement_total,difference,notes,created_by)
  values(p_order_id,v_type,coalesce(nullif(p_operation->>'operation_date','')::date,current_date),v_returned_total,v_replacement_total,v_difference,trim(coalesce(p_operation->>'notes','')),auth.uid()) returning id into v_adjustment_id;
  if v_order.affects_stock then perform set_config('koven.allow_stock_change','true',true); end if;

  for v_item in select value from jsonb_array_elements(p_returns) loop
    v_quantity:=(v_item->>'quantity')::integer; v_restock:=v_order.affects_stock and coalesce((v_item->>'restock')::boolean,true);
    select * into v_original from public.order_items where id=(v_item->>'order_item_id')::uuid;
    insert into public.sale_adjustment_return_items(adjustment_id,order_item_id,variant_id,quantity,restock,unit_price,unit_cost)
    values(v_adjustment_id,v_original.id,v_original.variant_id,v_quantity,v_restock,v_original.unit_price,v_original.unit_cost_snapshot);
    if v_restock and v_original.variant_id is not null then
      update public.product_variants set average_cost=((stock_current*coalesce(average_cost,cost,v_original.unit_cost_snapshot,0))+(v_quantity*coalesce(v_original.unit_cost_snapshot,average_cost,cost,0)))/(stock_current+v_quantity),stock_current=stock_current+v_quantity,updated_at=now() where id=v_original.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,sale_adjustment_id,created_by) values(v_original.variant_id,'reversal',v_quantity,'Devolución de cliente',p_order_id,v_adjustment_id,auth.uid());
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_replacements,'[]'::jsonb)) loop
    v_quantity:=(v_item->>'quantity')::integer; v_price:=(v_item->>'unit_price')::numeric;
    select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid;
    v_cost:=coalesce(v_variant.average_cost,v_variant.cost,0);
    insert into public.sale_adjustment_replacement_items(adjustment_id,variant_id,quantity,unit_price,unit_cost) values(v_adjustment_id,v_variant.id,v_quantity,v_price,v_cost);
    if v_order.affects_stock then
      update public.product_variants set stock_current=stock_current-v_quantity,updated_at=now() where id=v_variant.id and stock_current>=v_quantity;
      if not found then raise exception 'insufficient_replacement_stock'; end if;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,order_id,sale_adjustment_id,created_by) values(v_variant.id,'sale',-v_quantity,'Salida por cambio',p_order_id,v_adjustment_id,auth.uid());
    end if;
  end loop;

  if p_settlement is not null and coalesce((p_settlement->>'amount')::numeric,0)>0 then
    v_amount:=(p_settlement->>'amount')::numeric; v_direction:=p_settlement->>'direction';
    if (v_difference>0 and v_direction<>'collection') or (v_difference<0 and v_direction<>'refund') or v_difference=0 or v_amount>abs(v_difference) then raise exception 'invalid_adjustment_settlement'; end if;
    insert into public.sale_adjustment_payments(adjustment_id,direction,amount,payment_date,method,notes,created_by) values(v_adjustment_id,v_direction,v_amount,coalesce(nullif(p_settlement->>'payment_date','')::date,current_date),coalesce(nullif(p_settlement->>'method',''),'transfer')::public.payment_method,trim(coalesce(p_settlement->>'notes','')),auth.uid());
  end if;
  return v_adjustment_id;
end;
$$;

revoke all on function public.create_sale_adjustment(uuid,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.create_sale_adjustment(uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;

commit;
