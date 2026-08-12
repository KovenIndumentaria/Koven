do $$
declare
  v_purchase_id uuid;
  v_matches integer;
begin
  select count(*), min(purchase.id::text)::uuid
  into v_matches, v_purchase_id
  from public.supplier_purchases purchase
  join public.suppliers supplier on supplier.id = purchase.supplier_id
  where purchase.purchase_date = date '2026-08-06'
    and lower(trim(supplier.name)) = 'bertens'
    and purchase.total_cost = 21372.52
    and purchase.status = 'confirmed';

  if v_matches <> 1 then
    raise exception 'Se esperaba exactamente 1 compra coincidente y se encontraron %; no se modificó nada.', v_matches;
  end if;

  perform public.cancel_confirmed_purchase(v_purchase_id, 'Anulación de compra de prueba solicitada por el administrador');
end $$;
