create table public.sales_order_siigo_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.sales_orders(id) on delete cascade,
  status varchar(16) not null
    check (status in ('pending', 'created', 'failed', 'uncertain')),
  siigo_invoice_id uuid unique,
  siigo_invoice_name text,
  document_type_id integer not null,
  seller_id integer not null,
  payment_type_id integer not null,
  cost_center_id integer,
  warehouse_id integer,
  invoice_number integer,
  use_cfdi varchar(8) not null,
  payment_method varchar(3) not null
    check (payment_method in ('PUE', 'PPD')),
  invoice_date date not null,
  due_date date not null,
  total numeric(20, 2) not null,
  last_error text,
  raw_payload jsonb,
  created_by_name text not null,
  created_by_email text not null,
  created_by_role varchar(32) not null,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_order_siigo_invoices_status_requested_at_idx
  on public.sales_order_siigo_invoices(status, requested_at);

alter table public.sales_order_siigo_invoices enable row level security;

comment on table public.sales_order_siigo_invoices is
  'Server-only audit and duplicate guard for Siigo invoice draft creation.';
