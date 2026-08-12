begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text not null,
  normalized_phone text not null unique,
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.normalize_customer_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.prepare_customer()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := trim(new.name);
  new.phone := trim(new.phone);
  new.normalized_phone := public.normalize_customer_phone(new.phone);
  if length(new.normalized_phone) < 6 then raise exception 'customer_phone_required'; end if;
  new.email := lower(trim(coalesce(new.email, '')));
  new.address := trim(coalesce(new.address, ''));
  new.notes := trim(coalesce(new.notes, ''));
  new.updated_at := now();
  return new;
end;
$$;

create trigger customers_prepare
before insert or update on public.customers
for each row execute function public.prepare_customer();

alter table public.orders add column customer_id uuid references public.customers(id) on delete restrict;

insert into public.customers (name, phone, normalized_phone, address, created_at)
select distinct on (public.normalize_customer_phone(customer_phone))
  customer_name, customer_phone, public.normalize_customer_phone(customer_phone),
  coalesce(nullif(delivery_address, ''), ''), created_at
from public.orders
where length(public.normalize_customer_phone(customer_phone)) >= 6
order by public.normalize_customer_phone(customer_phone), created_at desc;

update public.orders o set customer_id = c.id
from public.customers c
where c.normalized_phone = public.normalize_customer_phone(o.customer_phone);

create or replace function public.attach_order_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid;
begin
  insert into public.customers (name, phone, normalized_phone, address)
  values (
    trim(new.customer_name), trim(new.customer_phone),
    public.normalize_customer_phone(new.customer_phone),
    case when new.delivery_type = 'shipping' then trim(new.delivery_address) else '' end
  )
  on conflict (normalized_phone) do update set
    name = excluded.name,
    phone = excluded.phone,
    address = case when excluded.address <> '' then excluded.address else public.customers.address end
  returning id into v_customer_id;
  new.customer_id := v_customer_id;
  return new;
end;
$$;

create trigger orders_attach_customer
before insert or update of customer_name, customer_phone, delivery_address on public.orders
for each row execute function public.attach_order_customer();

create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
alter table public.customers enable row level security;
grant select, insert, update, delete on public.customers to authenticated;
create policy admin_all_customers on public.customers for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

commit;
