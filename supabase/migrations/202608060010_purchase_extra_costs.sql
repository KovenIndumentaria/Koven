begin;

alter table public.supplier_purchases add column extra_cost numeric(14,2) not null default 0 check (extra_cost >= 0);
alter table public.supplier_purchases add column extra_cost_description text not null default '';

create or replace function public.save_purchase(p_purchase jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_purchase_id uuid; v_item jsonb; v_extra_cost numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if nullif(p_purchase->>'supplier_id','') is null then raise exception 'supplier_required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'purchase_items_required'; end if;
  v_extra_cost := coalesce(nullif(p_purchase->>'extra_cost','')::numeric,0);
  if v_extra_cost < 0 then raise exception 'invalid_extra_cost'; end if;
  if nullif(p_purchase->>'id','') is null then
    insert into public.supplier_purchases(supplier_id,purchase_date,notes,affects_stock,extra_cost,extra_cost_description,created_by)
    values((p_purchase->>'supplier_id')::uuid,coalesce(nullif(p_purchase->>'purchase_date','')::date,current_date),coalesce(p_purchase->>'notes',''),coalesce((p_purchase->>'affects_stock')::boolean,true),v_extra_cost,trim(coalesce(p_purchase->>'extra_cost_description','')),auth.uid()) returning id into v_purchase_id;
  else
    v_purchase_id := (p_purchase->>'id')::uuid;
    update public.supplier_purchases set supplier_id=(p_purchase->>'supplier_id')::uuid,purchase_date=coalesce(nullif(p_purchase->>'purchase_date','')::date,current_date),notes=coalesce(p_purchase->>'notes',''),affects_stock=coalesce((p_purchase->>'affects_stock')::boolean,true),extra_cost=v_extra_cost,extra_cost_description=trim(coalesce(p_purchase->>'extra_cost_description','')) where id=v_purchase_id and status='draft';
    if not found then raise exception 'draft_purchase_not_found'; end if;
    delete from public.supplier_purchase_items where purchase_id=v_purchase_id;
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::integer,0)<=0 then raise exception 'invalid_purchase_quantity'; end if;
    if coalesce((v_item->>'unit_cost')::numeric,-1)<0 then raise exception 'invalid_purchase_cost'; end if;
    insert into public.supplier_purchase_items(purchase_id,variant_id,quantity,unit_cost) values(v_purchase_id,(v_item->>'variant_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_cost')::numeric);
  end loop;
  update public.supplier_purchases set total_cost=(select coalesce(sum(quantity*unit_cost),0) from public.supplier_purchase_items where purchase_id=v_purchase_id)+v_extra_cost where id=v_purchase_id;
  return v_purchase_id;
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item record; v_affects_stock boolean; v_extra_cost numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select affects_stock,extra_cost into v_affects_stock,v_extra_cost from public.supplier_purchases where id=p_purchase_id and status='draft' for update;
  if not found then raise exception 'purchase_not_found_or_already_processed'; end if;
  if not exists(select 1 from public.supplier_purchase_items where purchase_id=p_purchase_id) then raise exception 'purchase_has_no_items'; end if;
  if v_affects_stock then
    perform set_config('koven.allow_stock_change','true',true);
    for v_item in select variant_id,quantity,unit_cost from public.supplier_purchase_items where purchase_id=p_purchase_id loop
      update public.product_variants set stock_current=stock_current+v_item.quantity,cost=v_item.unit_cost,updated_at=now() where id=v_item.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,reason,purchase_id,created_by) values(v_item.variant_id,'purchase',v_item.quantity,'Compra a proveedor confirmada',p_purchase_id,auth.uid());
    end loop;
  end if;
  update public.supplier_purchases set status='confirmed',confirmed_at=now(),updated_at=now(),total_cost=(select coalesce(sum(quantity*unit_cost),0) from public.supplier_purchase_items where purchase_id=p_purchase_id)+v_extra_cost where id=p_purchase_id;
end;
$$;

commit;
