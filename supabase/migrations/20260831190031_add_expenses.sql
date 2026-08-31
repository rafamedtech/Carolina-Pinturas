create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category varchar(64) not null,
  description varchar(250) not null,
  provider_id uuid not null
    references public.siigo_customers(id) on delete restrict on update cascade,
  provider_name_snapshot text not null,
  provider_rfc_snapshot text,
  provider_payload jsonb not null,
  currency_code varchar(3) not null,
  exchange_rate numeric(20, 6) not null,
  amount numeric(20, 2) not null,
  payment_method varchar(32) not null,
  notes text,
  created_by_user_id uuid
    references public.app_users(user_id) on delete set null on update cascade,
  created_by_name text not null,
  created_by_email text not null,
  created_by_role varchar(32) not null,
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null default now(),
  constraint expenses_category_valid check (category in (
    'Compra de materiales',
    'Renta y servicios',
    'Transporte y combustible',
    'Mantenimiento',
    'Nómina y honorarios',
    'Publicidad',
    'Impuestos',
    'Otros'
  )),
  constraint expenses_description_not_blank check (btrim(description) <> ''),
  constraint expenses_currency_code_valid check (currency_code in ('MXN', 'USD')),
  constraint expenses_exchange_rate_positive check (exchange_rate > 0),
  constraint expenses_mxn_exchange_rate_valid check (currency_code <> 'MXN' or exchange_rate = 1),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_payment_method_valid check (payment_method in (
    'efectivo',
    'transferencia',
    'tarjeta',
    'cheque',
    'otro'
  )),
  constraint expenses_notes_length check (notes is null or char_length(notes) <= 1000)
);

create index expenses_expense_date_created_at_idx
  on public.expenses(expense_date, created_at);

create index expenses_category_expense_date_idx
  on public.expenses(category, expense_date);

create index expenses_provider_id_expense_date_idx
  on public.expenses(provider_id, expense_date);

create index expenses_created_by_user_id_idx
  on public.expenses(created_by_user_id);

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
      and lower(type) = 'supplier'
  ) then
    raise exception 'Expense provider must be a Supplier in siigo_customers'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_expense_supplier() from public;

create trigger expenses_enforce_supplier
before insert or update of provider_id on public.expenses
for each row execute function private.enforce_expense_supplier();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function private.set_updated_at();

alter table public.expenses enable row level security;
revoke all on table public.expenses from anon, authenticated;

comment on table public.expenses is
  'Server-managed operating expenses with immutable supplier and creator snapshots.';
