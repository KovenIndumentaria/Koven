begin;

create or replace function public.guard_purchase_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then raise exception 'processed_purchase_is_immutable'; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then raise exception 'processed_purchase_is_immutable'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger supplier_purchases_guard_changes
before update or delete on public.supplier_purchases
for each row execute function public.guard_purchase_changes();

create or replace function public.guard_purchase_item_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_purchase_id uuid;
begin
  v_purchase_id := case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end;
  if not exists (select 1 from public.supplier_purchases where id = v_purchase_id and status = 'draft') then
    raise exception 'processed_purchase_items_are_immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger supplier_purchase_items_guard_changes
before insert or update or delete on public.supplier_purchase_items
for each row execute function public.guard_purchase_item_changes();

create or replace function public.save_purchase(p_purchase jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  if nullif(p_purchase->>'supplier_id', '') is null then raise exception 'supplier_required'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'purchase_items_required'; end if;

  if nullif(p_purchase->>'id', '') is null then
    insert into public.supplier_purchases (supplier_id, purchase_date, notes, created_by)
    values ((p_purchase->>'supplier_id')::uuid, coalesce(nullif(p_purchase->>'purchase_date', '')::date, current_date), coalesce(p_purchase->>'notes', ''), auth.uid())
    returning id into v_purchase_id;
  else
    v_purchase_id := (p_purchase->>'id')::uuid;
    update public.supplier_purchases set supplier_id = (p_purchase->>'supplier_id')::uuid,
      purchase_date = coalesce(nullif(p_purchase->>'purchase_date', '')::date, current_date), notes = coalesce(p_purchase->>'notes', '')
    where id = v_purchase_id and status = 'draft';
    if not found then raise exception 'draft_purchase_not_found'; end if;
    delete from public.supplier_purchase_items where purchase_id = v_purchase_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce((v_item->>'quantity')::integer, 0) <= 0 then raise exception 'invalid_purchase_quantity'; end if;
    if coalesce((v_item->>'unit_cost')::numeric, -1) < 0 then raise exception 'invalid_purchase_cost'; end if;
    insert into public.supplier_purchase_items (purchase_id, variant_id, quantity, unit_cost)
    values (v_purchase_id, (v_item->>'variant_id')::uuid, (v_item->>'quantity')::integer, (v_item->>'unit_cost')::numeric);
  end loop;

  update public.supplier_purchases set total_cost = (
    select coalesce(sum(quantity * unit_cost), 0) from public.supplier_purchase_items where purchase_id = v_purchase_id
  ) where id = v_purchase_id;
  return v_purchase_id;
end;
$$;

revoke all on function public.save_purchase(jsonb, jsonb) from public;
grant execute on function public.save_purchase(jsonb, jsonb) to authenticated;

commit;
