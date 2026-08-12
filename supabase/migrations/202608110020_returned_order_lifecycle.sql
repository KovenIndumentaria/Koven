begin;

create or replace function public.guard_adjusted_order_cancellation()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' and exists(select 1 from public.sale_adjustments where order_id=old.id) then
    raise exception 'adjusted_order_cannot_be_cancelled';
  end if;
  return new;
end;
$$;
create trigger orders_guard_adjusted_cancellation before update of status on public.orders for each row execute function public.guard_adjusted_order_cancellation();

create or replace function public.add_order_account_refund(p_order_id uuid,p_amount numeric,p_payment_date date,p_method public.payment_method,p_notes text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_total numeric; v_net_paid numeric; v_remaining numeric; v_piece numeric; v_adjustment record;
begin
  if not private.is_admin() then raise exception 'not_authorized'; end if;
  select * into v_order from public.orders where id=p_order_id and status<>'cancelled' for update;
  if not found then raise exception 'order_not_available'; end if;
  if p_amount<=0 then raise exception 'invalid_refund_amount'; end if;
  select v_order.subtotal+coalesce(sum(difference),0) into v_total from public.sale_adjustments where order_id=p_order_id;
  select coalesce((select sum(amount) from public.order_payments where order_id=p_order_id),0)+coalesce((select sum(case when payment.direction='collection' then payment.amount else -payment.amount end) from public.sale_adjustment_payments payment join public.sale_adjustments adjustment on adjustment.id=payment.adjustment_id where adjustment.order_id=p_order_id),0) into v_net_paid;
  if p_amount>greatest(0,v_net_paid-v_total) then raise exception 'refund_exceeds_account_credit'; end if;
  v_remaining:=p_amount;
  for v_adjustment in
    select adjustment.id,abs(adjustment.difference)-coalesce(sum(case when payment.direction='refund' then payment.amount else 0 end),0) available
    from public.sale_adjustments adjustment left join public.sale_adjustment_payments payment on payment.adjustment_id=adjustment.id
    where adjustment.order_id=p_order_id and adjustment.difference<0
    group by adjustment.id,adjustment.difference,adjustment.operation_date,adjustment.created_at
    order by adjustment.operation_date,adjustment.created_at
  loop
    exit when v_remaining<=0;
    v_piece:=least(v_remaining,greatest(0,v_adjustment.available));
    if v_piece>0 then
      insert into public.sale_adjustment_payments(adjustment_id,direction,amount,payment_date,method,notes,created_by) values(v_adjustment.id,'refund',v_piece,coalesce(p_payment_date,current_date),p_method,trim(coalesce(p_notes,'')),auth.uid());
      v_remaining:=v_remaining-v_piece;
    end if;
  end loop;
  if v_remaining>0.001 then raise exception 'refund_allocation_failed'; end if;
end;
$$;
revoke all on function public.add_order_account_refund(uuid,numeric,date,public.payment_method,text) from public;
grant execute on function public.add_order_account_refund(uuid,numeric,date,public.payment_method,text) to authenticated;

commit;
