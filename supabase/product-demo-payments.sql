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
create policy "owner manage own products" on public.products
  for all to authenticated
  using (exists (
    select 1 from public.stores
    where stores.id = products.store_id and stores.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores
    where stores.id = products.store_id and stores.user_id = auth.uid()
  ));

notify pgrst, 'reload schema';
