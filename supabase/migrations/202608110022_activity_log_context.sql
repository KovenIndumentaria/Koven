begin;

-- Evita ruido cuando una operación solamente renueva marcas de tiempo.
create or replace function private.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_old_business jsonb;
  v_new_business jsonb;
  v_id text;
  v_email text;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  if tg_op = 'UPDATE' then
    v_old_business := v_old - 'updated_at' - 'confirmed_at';
    v_new_business := v_new - 'updated_at' - 'confirmed_at';
    if v_old_business = v_new_business then return new; end if;
  end if;
  v_id := coalesce(v_new->>'id', v_old->>'id');
  v_email := nullif(auth.jwt()->>'email','');
  insert into public.activity_log(actor_id,actor_email,entity,entity_id,action,old_data,new_data)
  values(auth.uid(),v_email,tg_table_name,v_id,lower(tg_op),v_old,v_new);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists activity_product_images on public.product_images;
create trigger activity_product_images after insert or update or delete on public.product_images for each row execute function private.write_activity_log();

commit;
