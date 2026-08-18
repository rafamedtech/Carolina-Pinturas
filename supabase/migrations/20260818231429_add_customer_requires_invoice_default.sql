alter table public.siigo_customers
  add column requires_invoice boolean not null default false;

comment on column public.siigo_customers.requires_invoice is
  'Preferencia interna: selecciona Requiere factura al crear un pedido para este cliente.';
