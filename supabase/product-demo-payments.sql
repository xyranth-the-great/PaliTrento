-- Demo-only product listing fees and featured-product ads.
-- No real GCash transaction is created by this flow.
alter table public.products
  add column if not exists quantity integer,
  add column if not exists image_url text,
  add column if not exists featured_until timestamptz;

create index if not exists products_featured_until_idx
  on public.products(featured_until)
  where featured_until is not null;

alter table public.products enable row level security;
drop policy if exists "owner manage own products" on public.products;
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated
  using (exists (
    select 1 from public.stores
    where stores.id = products.store_id
      and stores.verification_status = 'VERIFIED'
  ));

drop policy if exists "owner read own products" on public.products;
create policy "owner read own products" on public.products
  for select to authenticated
  using (exists (
    select 1 from public.stores
    where stores.id = products.store_id and stores.user_id = auth.uid()
  ));

drop policy if exists "verified owner insert products" on public.products;
create policy "verified owner insert products" on public.products
  for insert to authenticated
  with check (exists (
    select 1 from public.stores
    where stores.id = products.store_id
      and stores.user_id = auth.uid()
      and stores.verification_status = 'VERIFIED'
  ));

drop policy if exists "verified owner update products" on public.products;
create policy "verified owner update products" on public.products
  for update to authenticated
  using (exists (
    select 1 from public.stores
    where stores.id = products.store_id
      and stores.user_id = auth.uid()
      and stores.verification_status = 'VERIFIED'
  ))
  with check (exists (
    select 1 from public.stores
    where stores.id = products.store_id
      and stores.user_id = auth.uid()
      and stores.verification_status = 'VERIFIED'
  ));

drop policy if exists "verified owner delete products" on public.products;
create policy "verified owner delete products" on public.products
  for delete to authenticated
  using (exists (
    select 1 from public.stores
    where stores.id = products.store_id
      and stores.user_id = auth.uid()
      and stores.verification_status = 'VERIFIED'
  ));

notify pgrst, 'reload schema';
