-- Orders table for pickup reservations
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

alter table stores
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  total_price numeric(10,2) not null,
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','READY_FOR_PICKUP','COMPLETED','CANCELLED')),
  payment_method text not null check (payment_method in ('CASH','GCASH','TRIKE_COD')),
  notes text,
  confirmed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_idx on orders (buyer_id);
create index if not exists orders_store_idx on orders (store_id);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_created_idx on orders (created_at desc);

-- RLS
alter table orders enable row level security;

-- Buyers can read their own orders
drop policy if exists "buyer read orders" on orders;
create policy "buyer read orders" on orders
  for select to authenticated
  using (auth.uid() = buyer_id);

-- Buyers can create orders
drop policy if exists "buyer create orders" on orders;
create policy "buyer create orders" on orders
  for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and not exists (
      select 1 from stores
      where stores.id = orders.store_id
        and stores.user_id = auth.uid()
    )
  );

-- Store owners can read orders for their store
drop policy if exists "owner read orders" on orders;
create policy "owner read orders" on orders
  for select to authenticated
  using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- Store owners can update their store's orders (confirm, ready, complete)
drop policy if exists "owner update orders" on orders;
create policy "owner update orders" on orders
  for update to authenticated
  using (
    store_id in (select id from stores where user_id = auth.uid())
  )
  with check (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- Admin can read all orders
drop policy if exists "admin read orders" on orders;
create policy "admin read orders" on orders
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Admin can update all orders
drop policy if exists "admin update orders" on orders;
create policy "admin update orders" on orders
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));