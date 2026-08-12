begin;

create table public.activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  entity text not null,
  entity_id text,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb
);

create index activity_log_occurred_idx on public.activity_log(occurred_at desc);
create index activity_log_entity_idx on public.activity_log(entity, occurred_at desc);

alter table public.activity_log enable row level security;
grant select on public.activity_log to authenticated;
create policy admin_read_activity_log on public.activity_log for select to authenticated using ((select private.is_admin()));

create or replace function private.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id text;
  v_email text;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  if tg_op = 'UPDATE' and v_old = v_new then return new; end if;
  v_id := coalesce(v_new->>'id', v_old->>'id');
  v_email := nullif(auth.jwt()->>'email','');
  insert into public.activity_log(actor_id,actor_email,entity,entity_id,action,old_data,new_data)
  values(auth.uid(),v_email,tg_table_name,v_id,lower(tg_op),v_old,v_new);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.write_activity_log() from public;

create trigger activity_products after insert or update or delete on public.products for each row execute function private.write_activity_log();
create trigger activity_product_variants after insert or update or delete on public.product_variants for each row execute function private.write_activity_log();
create trigger activity_suppliers after insert or update or delete on public.suppliers for each row execute function private.write_activity_log();
create trigger activity_supplier_purchases after insert or update or delete on public.supplier_purchases for each row execute function private.write_activity_log();
create trigger activity_supplier_payments after insert or update or delete on public.supplier_purchase_payments for each row execute function private.write_activity_log();
create trigger activity_orders after insert or update or delete on public.orders for each row execute function private.write_activity_log();
create trigger activity_order_payments after insert or update or delete on public.order_payments for each row execute function private.write_activity_log();
create trigger activity_expenses after insert or update or delete on public.expenses for each row execute function private.write_activity_log();
create trigger activity_sale_adjustments after insert or update or delete on public.sale_adjustments for each row execute function private.write_activity_log();
create trigger activity_sale_adjustment_payments after insert or update or delete on public.sale_adjustment_payments for each row execute function private.write_activity_log();

commit;
