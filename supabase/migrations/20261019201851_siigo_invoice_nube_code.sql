alter table public.sales_order_siigo_invoices
  add column nube_invoice_code integer
  constraint sales_order_siigo_invoices_nube_code_positive check (nube_invoice_code > 0);

comment on column public.sales_order_siigo_invoices.nube_invoice_code is
  'Código interno de Siigo Nube, obtenido del enlace de la factura confirmado por el usuario. Distinto del UUID de la API y del tipo de comprobante.';
