alter table public.sales_order_payments
  alter column provider set default 'local',
  alter column external_status set default 'not_applicable';

alter table public.sales_order_payments
  rename constraint sales_order_siigo_payments_pkey to sales_order_payments_pkey;

alter table public.sales_order_payments
  rename constraint sales_order_siigo_payments_siigo_voucher_id_key
    to sales_order_payments_siigo_voucher_id_key;

alter table public.sales_order_payments
  drop constraint sales_order_siigo_payments_order_id_fkey,
  add constraint sales_order_payments_order_id_fkey
    foreign key (order_id)
    references public.sales_orders(id)
    on update cascade
    on delete cascade;

alter table public.sales_order_siigo_invoices
  alter column updated_at drop default,
  drop constraint sales_order_siigo_invoices_order_id_fkey,
  add constraint sales_order_siigo_invoices_order_id_fkey
    foreign key (order_id)
    references public.sales_orders(id)
    on update cascade
    on delete cascade;
