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

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  category text,
  unit text not null default 'PC' check (unit in ('KG','PC','POUCH','BOTTLE','SACK_25KG','TIE')),
  current_price numeric(10,2) not null,
  lgu_srp_ceiling numeric(10,2),                -- null = no LGU cap for this item
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_store_idx on products(store_id);
create index if not exists stores_barangay_idx on stores(barangay);

-- Row-level security: the public (anon key) may only READ.
alter table stores enable row level security;
alter table products enable row level security;
create policy "public read stores" on stores for select using (verification_status <> 'REJECTED');
create policy "public read products" on products for select using (true);
-- No insert/update/delete policies yet: add owner/admin policies when login is built.
