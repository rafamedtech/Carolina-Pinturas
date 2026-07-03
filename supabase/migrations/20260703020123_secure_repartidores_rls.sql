alter table public.repartidores enable row level security;
revoke all on table public.repartidores from anon, authenticated;
