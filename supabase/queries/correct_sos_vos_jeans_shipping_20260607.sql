do $$
declare
  v_purchase_id uuid;
  v_matches integer;
begin
  select count(*), min(purchase.id::text)::uuid
  into v_matches, v_purchase_id
  from public.supplier_purchases purchase
  join public.suppliers supplier on supplier.id = purchase.supplier_id
  where purchase.purchase_date = date '2026-06-07'
    and lower(trim(supplier.name)) = lower('Sos Vos Jeans')
    and purchase.status = 'confirmed'
    and purchase.affects_stock = false
    and purchase.extra_cost = 21579.16;

  if v_matches <> 1 then
    raise exception 'Se esperaba exactamente 1 compra coincidente y se encontraron %; no se modificó nada.', v_matches;
  end if;

  perform public.correct_confirmed_historical_purchase_extra_cost(v_purchase_id, 49579.16, 'Envío');
end $$;
