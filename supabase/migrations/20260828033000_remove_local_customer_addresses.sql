-- Siigo is the only source of truth for the current customer address.
-- Historical order snapshots remain unchanged.
update public.siigo_customers
set raw_payload = raw_payload - 'address'
where raw_payload ? 'address';

alter table public.siigo_customers
  drop column address_street,
  drop column address_interior_number,
  drop column address_exterior_number,
  drop column address_colony,
  drop column address_locality,
  drop column address_country_code,
  drop column address_state_code,
  drop column address_city_code,
  drop column address_city_name,
  drop column address_state_name,
  drop column address_postal_code;
