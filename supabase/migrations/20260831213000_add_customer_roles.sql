alter table public.siigo_customers
  add column is_customer boolean not null default false,
  add column is_supplier boolean not null default false;

update public.siigo_customers
set
  is_customer = lower(type) = 'customer',
  is_supplier = lower(type) = 'supplier';

-- A sales history is independent evidence that the third party is a customer.
update public.siigo_customers as customer
set is_customer = true
where exists (
  select 1
  from public.sales_orders as sales_order
  where sales_order.customer_id = customer.id
);

-- Confirmed in Siigo Nube as Customer and Supplier on 2026-08-31. The public
-- API exposes only Supplier and cannot preserve the second checkbox.
update public.siigo_customers
set is_customer = true, is_supplier = true
where id = 'cc99f27d-9cc1-4f6a-ba98-ecf964a03654';

create index siigo_customers_is_customer_active_idx
  on public.siigo_customers(is_customer, active);

create index siigo_customers_is_supplier_active_idx
  on public.siigo_customers(is_supplier, active);

create or replace function private.enforce_expense_supplier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.siigo_customers
    where id = new.provider_id
      and is_supplier
  ) then
    raise exception 'Expense provider must have the local Supplier role'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
