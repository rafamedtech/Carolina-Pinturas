-- Siigo México has no product image field. Images are app-owned: the file
-- lives in Supabase Storage and this table maps it to the Siigo product id.
create table public.product_images (
  product_id uuid primary key,
  storage_path text not null unique,
  content_type varchar(32) not null,
  size_bytes integer not null,
  uploaded_by_user_id uuid
    references public.app_users(user_id) on delete set null on update cascade,
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null default now(),
  constraint product_images_content_type_valid check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint product_images_size_valid check (size_bytes between 1 and 2097152),
  constraint product_images_storage_path_valid check (storage_path like product_id::text || '/%')
);

create index product_images_uploaded_by_user_id_idx
  on public.product_images(uploaded_by_user_id);

create trigger product_images_set_updated_at
before update on public.product_images
for each row execute function private.set_updated_at();

alter table public.product_images enable row level security;
revoke all on table public.product_images from anon, authenticated;

comment on table public.product_images is
  'Server-managed product photos keyed by Siigo product id; files live in the product-images bucket.';

-- Public read (product photos are not sensitive and are served from the CDN).
-- No storage.objects policies: only the server writes, using a secret key
-- after requireRole authorization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
