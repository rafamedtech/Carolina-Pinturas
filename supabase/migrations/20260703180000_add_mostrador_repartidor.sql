-- Adds a standing "Mostrador" repartidor representing in-store pickup.
-- Mostrador users default to it for walk-in customers, but can still pick a
-- real repartidor when the order is a home delivery.

alter table public.repartidores
  add column es_mostrador boolean not null default false;

-- Only one in-store repartidor may exist.
create unique index repartidores_es_mostrador_key
  on public.repartidores (es_mostrador)
  where es_mostrador;

insert into public.repartidores (nombre, es_mostrador, activo)
select 'Mostrador', true, true
where not exists (
  select 1 from public.repartidores where es_mostrador
);
