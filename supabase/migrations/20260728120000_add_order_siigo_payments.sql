create table public.sales_order_siigo_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  siigo_voucher_id uuid not null unique,
  siigo_voucher_name text,
  siigo_invoice_id uuid not null,
  siigo_invoice_name text not null,
  document_type_id integer not null,
  payment_type_id integer not null,
  cost_center_id integer,
  cfdi_code varchar(8) not null,
  payment_method varchar(3) not null,
  amount numeric(20, 2) not null check (amount > 0),
  payment_date date not null,
  observations text,
  raw_payload jsonb not null,
  created_by_name text not null,
  created_by_email text not null,
  created_by_role varchar(32) not null,
  created_at timestamptz not null default now()
);

create index sales_order_siigo_payments_order_id_created_at_idx
  on public.sales_order_siigo_payments(order_id, created_at);

create index sales_order_siigo_payments_siigo_invoice_id_idx
  on public.sales_order_siigo_payments(siigo_invoice_id);
