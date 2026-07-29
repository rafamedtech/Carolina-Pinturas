alter table public.sales_order_siigo_payments
  rename to sales_order_payments;

alter index public.sales_order_siigo_payments_order_id_created_at_idx
  rename to sales_order_payments_order_id_created_at_idx;

alter index public.sales_order_siigo_payments_siigo_invoice_id_idx
  rename to sales_order_payments_siigo_invoice_id_idx;

alter table public.sales_order_payments
  rename column document_type_id to siigo_document_type_id;

alter table public.sales_order_payments
  rename column payment_type_id to siigo_payment_type_id;

alter table public.sales_order_payments
  rename column cost_center_id to siigo_cost_center_id;

alter table public.sales_order_payments
  rename column cfdi_code to siigo_cfdi_code;

alter table public.sales_order_payments
  rename column payment_method to siigo_payment_method;

alter table public.sales_order_payments
  rename column raw_payload to external_payload;

alter table public.sales_order_payments
  add column provider varchar(32) not null default 'siigo',
  add column external_status varchar(24) not null default 'synced',
  add column external_error text,
  add column request_id uuid not null default gen_random_uuid(),
  add column payment_method varchar(32),
  add column currency_code varchar(3) not null default 'MXN',
  add column reference text,
  add column siigo_quote integer;

update public.sales_order_payments
set payment_method = case
  when siigo_cfdi_code = '01' then 'efectivo'
  when siigo_cfdi_code = '02' then 'cheque'
  when siigo_cfdi_code = '03' then 'transferencia'
  when siigo_cfdi_code in ('04', '28') then 'tarjeta'
  else 'otro'
end;

alter table public.sales_order_payments
  alter column payment_method set not null,
  alter column siigo_voucher_id drop not null,
  alter column siigo_invoice_id drop not null,
  alter column siigo_invoice_name drop not null,
  alter column siigo_document_type_id drop not null,
  alter column siigo_payment_type_id drop not null,
  alter column siigo_cfdi_code drop not null,
  alter column siigo_payment_method drop not null,
  alter column external_payload drop not null;

alter table public.sales_order_payments
  add constraint sales_order_payments_amount_positive
    check (amount > 0),
  add constraint sales_order_payments_external_status_valid
    check (external_status in ('not_applicable', 'pending', 'synced', 'failed', 'unknown')),
  add constraint sales_order_payments_siigo_method_valid
    check (siigo_payment_method is null or siigo_payment_method in ('PUE', 'PPD')),
  add constraint sales_order_payments_siigo_quote_positive
    check (siigo_quote is null or siigo_quote > 0),
  add constraint sales_order_payments_siigo_fields
    check (
      provider <> 'siigo'
      or (
        siigo_invoice_id is not null
        and siigo_invoice_name is not null
        and siigo_document_type_id is not null
        and siigo_payment_type_id is not null
        and siigo_cfdi_code is not null
        and siigo_payment_method is not null
        and siigo_quote is not null
      )
    );

create unique index sales_order_payments_request_id_key
  on public.sales_order_payments(request_id);

create index sales_order_payments_provider_external_status_idx
  on public.sales_order_payments(provider, external_status);

alter table public.sales_order_payments enable row level security;

comment on table public.sales_order_payments is
  'Registro unificado de pagos de pedidos. Los campos siigo_* son una extensión fiscal opcional compatible con /v1/vouchers.';
