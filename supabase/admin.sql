-- Advisories table (jud Admin price broadcasts)
create table if not exists advisories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null check (category in ('PRICE_CAP','ANNOUNCEMENT','EMERGENCY','GENERAL')),
  barangay text, -- null = all barangays
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  recipient_id uuid references auth.users(id) on delete cascade,
  admin_only boolean not null default false,
  action_url text,
  action_label text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.advisories
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists admin_only boolean not null default false,
  add column if not exists action_url text,
  add column if not exists action_label text;

create index if not exists advisories_published_idx on advisories (published_at desc);
create index if not exists advisories_category_idx on advisories (category);
create index if not exists advisories_recipient_idx on advisories (recipient_id);

-- Global announcements and recipient-owned notifications are separate read scopes.
alter table advisories enable row level security;
drop policy if exists "public read active advisories" on advisories;
drop policy if exists "admin all advisories" on advisories;
drop policy if exists "users read own advisories" on advisories;
drop policy if exists "users read own targeted advisories" on advisories;
drop policy if exists "admins manage global advisories" on advisories;
create policy "public read active advisories" on advisories
  for select to anon, authenticated
  using (
    recipient_id is null
    and admin_only = false
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
create policy "users read own targeted advisories" on advisories
  for select to authenticated
  using (
    recipient_id = auth.uid()
    and (admin_only = false or exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    ))
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
create policy "admins manage global advisories" on advisories
  for all to authenticated
  using (
    recipient_id is null
    and admin_only = false
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    recipient_id is null
    and admin_only = false
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admin RLS for stores (already have user_id policies, add admin override)
-- Admin can read ALL stores (including pending)
drop policy if exists "admin read stores" on stores;
create policy "admin read stores" on stores
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admin can update any store (verification)
drop policy if exists "admin update stores" on stores;
create policy "admin update stores" on stores
  for update to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admin can read ALL products
drop policy if exists "admin read products" on products;
create policy "admin read products" on products
  for select to authenticated
  using (
    store_id in (select id from stores where user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admin can manage all products
drop policy if exists "admin manage products" on products;
create policy "admin manage products" on products
  for all to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Function to check if user is admin
create or replace function is_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end; $$;