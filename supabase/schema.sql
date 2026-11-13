-- Run in Supabase: SQL Editor > New query > paste > Run
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer'
    check (role in ('customer', 'business_owner', 'admin')),
  barangay text,
  created_at timestamptz not null default now(),
  avatar_url text
);

alter table profiles enable row level security;
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles
  for select to authenticated
  using (auth.uid() = id);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  trn_code text unique not null,                -- e.g. TRN-2024-089
  business_name text not null,
  trade_category text not null check (trade_category in ('SARI_SARI','CARINDERIA','FRESH_PRODUCE','PHARMACY','SERVICES','AGRI')),
  proprietor_name text,
  description text,
  storefront_image_url text,
  permits_image_url text,
  contact_number text,                          -- E.164, e.g. +639178894210
  barangay text not null,
  purok text,
  landmark_reference text,
  lat double precision,
  lng double precision,
  bmbe_registered boolean not null default false,
  dti_registered boolean not null default false,
  srp_compliant boolean not null default false,
  verification_status text not null default 'PENDING' check (verification_status in ('PENDING','VERIFIED','REJECTED','CLARIFICATION_REQUIRED')),
  open_time time,
  close_time time,
  accepted_payments text[] not null default '{CASH}',
  created_at timestamptz not null default now()
);

alter table stores
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table stores
  add column if not exists description text;
alter table stores
  add column if not exists storefront_image_url text,
  add column if not exists permits_image_url text;
alter table stores drop constraint if exists stores_trade_category_check;
alter table stores add constraint stores_trade_category_check check (trade_category in ('SARI_SARI','CARINDERIA','FRESH_PRODUCE','PHARMACY','SERVICES','PRODUCT','AGRI'));

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  category text,
  unit text not null default 'PC' check (unit in ('KG','PC','POUCH','BOTTLE','SACK_25KG','TIE')),
  current_price numeric(10,2) not null,
  lgu_srp_ceiling numeric(10,2),                -- null = no LGU cap for this item
  in_stock boolean not null default true,
  quantity integer,
  image_url text,
  featured_until timestamptz,
  created_at timestamptz not null default now()
);
alter table products
  add column if not exists quantity integer,
  add column if not exists image_url text,
  add column if not exists featured_until timestamptz;
create index if not exists products_store_idx on products(store_id);
create index if not exists products_featured_until_idx on products(featured_until) where featured_until is not null;
create index if not exists stores_barangay_idx on stores(barangay);

-- Row-level security: the public (anon key) may only READ.
alter table stores enable row level security;
alter table products enable row level security;
create policy "public read stores" on stores for select using (verification_status <> 'REJECTED');
create policy "public read products" on products for select using (true);

-- Store owner & admin policies for stores
create or replace function public.is_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end; $$;

drop policy if exists "owner read own store" on stores;
create policy "owner read own store" on stores
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "owner insert own store" on stores;
create policy "owner insert own store" on stores
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owner update own store" on stores;
create policy "owner update own store" on stores
  for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- Store images storage bucket and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images','store-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "store images public read" on storage.objects;
create policy "store images public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'store-images');

drop policy if exists "owner upload store images" on storage.objects;
create policy "owner upload store images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update store images" on storage.objects;
create policy "owner update store images" on storage.objects for update to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner delete store images" on storage.objects;
create policy "owner delete store images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner manage own products" on products;
create policy "owner manage own products" on products
  for all to authenticated
  using (exists (
    select 1 from stores
    where stores.id = products.store_id and stores.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from stores
    where stores.id = products.store_id and stores.user_id = auth.uid()
  ));
