-- ============================================================
-- Fix Public Visibility for Approved Stores
-- Run in Supabase SQL Editor
-- ============================================================

-- Current RLS only shows VERIFIED stores to public.
-- We need to also show APPROVED stores (they can operate, just have 15-day cert deadline).

-- 1. Update stores public read policy
drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores
  for select to anon, authenticated
  using (
    verification_status = 'VERIFIED'
    or approval_status = 'APPROVED'
  );

-- 2. Update products public read policy
-- Products should be visible if store is VERIFIED OR APPROVED
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and (stores.verification_status = 'VERIFIED' or stores.approval_status = 'APPROVED')
    )
  );

-- 3. Update owner insert/update policies to allow APPROVED stores (not just VERIFIED)
drop policy if exists "verified owner insert products" on public.products;
create policy "approved owner insert products" on public.products
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and (stores.verification_status = 'VERIFIED' or stores.approval_status = 'APPROVED')
    )
  );

drop policy if exists "verified owner update products" on public.products;
create policy "approved owner update products" on public.products
  for update to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and (stores.verification_status = 'VERIFIED' or stores.approval_status = 'APPROVED')
    )
  )
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and (stores.verification_status = 'VERIFIED' or stores.approval_status = 'APPROVED')
    )
  );

drop policy if exists "verified owner delete products" on public.products;
create policy "approved owner delete products" on public.products
  for delete to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and (stores.verification_status = 'VERIFIED' or stores.approval_status = 'APPROVED')
    )
  );

-- ============================================================
-- After running this:
-- - Approved stores (with certificate deadline) will appear in explore/products
-- - Approved store owners can add/edit/delete products
-- - Only VERIFIED stores show "Verified" badge; APPROVED shows "Approved - Certificate Pending"
-- ============================================================