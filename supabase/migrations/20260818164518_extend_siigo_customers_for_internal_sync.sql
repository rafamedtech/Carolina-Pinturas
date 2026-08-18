-- Convert the existing Siigo customer snapshot into the local customer master.
-- Siigo remains the source of truth for fiscal/contact fields; internal_* stays local.
alter table public.siigo_customers
  add column commercial_name text,
  add column branch_office integer,
  add column comments text,
  add column seller_id integer,
  add column collector_id integer,
  add column address_country_code varchar(5),
  add column address_state_code varchar(10),
  add column address_city_code varchar(10),
  add column siigo_created_at timestamptz(6),
  add column siigo_updated_at timestamptz(6),
  add column internal_code varchar(64),
  add column internal_notes text,
  add column internal_tags text[] not null default '{}',
  add column sync_status varchar(16) not null default 'synced',
  add column last_sync_error text,
  add column sync_version integer not null default 1,
  add column created_by_email text,
  add column updated_by_email text,
  add constraint siigo_customers_branch_office_check
    check (branch_office is null or branch_office between 0 and 999),
  add constraint siigo_customers_sync_status_check
    check (sync_status in ('pending', 'synced', 'failed', 'unknown')),
  add constraint siigo_customers_sync_version_check
    check (sync_version > 0);

create unique index siigo_customers_internal_code_key
  on public.siigo_customers (internal_code)
  where internal_code is not null;

create index siigo_customers_rfc_branch_office_idx
  on public.siigo_customers (rfc_id, branch_office);

create index siigo_customers_sync_status_idx
  on public.siigo_customers (sync_status, synced_at);

alter table public.siigo_customer_phones
  add column indicative varchar(10),
  add column extension varchar(10);

alter table public.siigo_customer_contacts
  add column phone_indicative varchar(10),
  add column phone_extension varchar(10);

-- These tables were already protected in the initial migration. Keep the
-- server-only access model explicit after extending customer data.
revoke all on table
  public.siigo_customers,
  public.siigo_customer_phones,
  public.siigo_customer_contacts
from anon, authenticated;
