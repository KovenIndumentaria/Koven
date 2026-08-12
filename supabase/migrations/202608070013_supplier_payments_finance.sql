begin;

alter table public.supplier_purchases
add column consider_paid_on_confirm boolean not null default true;

create table public.supplier_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.supplier_purchases(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method public.payment_method not null default 'transfer',
  notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index supplier_purchase_payments_purchase_date_idx on public.supplier_purchase_payments(purchase_id,payment_date desc);

alter table public.supplier_purchase_payments enable row level security;
grant select,insert,update,delete on public.supplier_purchase_payments to authenticated;
create policy admin_all_supplier_purchase_payments on public.supplier_purchase_payments for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

-- Las compras confirmadas existentes se toman como pagadas para no crear deuda ficticia.
insert into public.supplier_purchase_payments(purchase_id,amount,payment_date,method,notes)
select purchase.id,purchase.total_cost,purchase.purchase_date,'transfer','Pago inicial migrado'
from public.supplier_purchases purchase
where purchase.status='confirmed' and purchase.total_cost>0
  and not exists(select 1 from public.supplier_purchase_payments payment where payment.purchase_id=purchase.id);

create or replace function public.auto_pay_confirmed_purchase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='draft' and new.status='confirmed' and new.consider_paid_on_confirm and new.total_cost>0 then
    insert into public.supplier_purchase_payments(purchase_id,amount,payment_date,method,notes,created_by)
    values(new.id,new.total_cost,new.purchase_date,'transfer','Pago total al confirmar',auth.uid());
  end if;
  return new;
end;
$$;
create trigger supplier_purchases_auto_payment
after update of status on public.supplier_purchases
for each row execute function public.auto_pay_confirmed_purchase();

create or replace function public.add_supplier_payment(p_purchase_id uuid,p_amount numeric,p_payment_date date,p_method public.payment_method,p_notes text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_payment_id uuid; v_total numeric; v_paid numeric;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select total_cost into v_total from public.supplier_purchases where id=p_purchase_id and status='confirmed' for update;
  if not found then raise exception 'confirmed_purchase_required'; end if;
  select coalesce(sum(amount),0) into v_paid from public.supplier_purchase_payments where purchase_id=p_purchase_id;
  if p_amount<=0 then raise exception 'invalid_payment_amount'; end if;
  if v_paid+p_amount>v_total then raise exception 'payment_exceeds_purchase_balance'; end if;
  insert into public.supplier_purchase_payments(purchase_id,amount,payment_date,method,notes,created_by)
  values(p_purchase_id,p_amount,coalesce(p_payment_date,current_date),p_method,trim(coalesce(p_notes,'')),auth.uid()) returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.add_supplier_payment(uuid,numeric,date,public.payment_method,text) from public;
grant execute on function public.add_supplier_payment(uuid,numeric,date,public.payment_method,text) to authenticated;

commit;
