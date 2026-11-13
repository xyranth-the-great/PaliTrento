-- Run in Supabase SQL Editor after schema.sql and store-submission.sql.

alter table public.stores
  add column if not exists compliance_deadline_at timestamptz,
  add column if not exists compliance_notified_at timestamptz,
  add column if not exists compliance_approved_at timestamptz,
  add column if not exists compliance_suspended_at timestamptz;

alter table public.stores
  alter column compliance_deadline_at
  set default (now() + interval '15 days');

create index if not exists stores_compliance_deadline_idx
  on public.stores (compliance_deadline_at)
  where compliance_approved_at is null and compliance_suspended_at is null;

create table if not exists public.store_certifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  certificate_type text not null check (certificate_type in (
    'locational_clearance',
    'cedula',
    'fire_safety',
    'sanitary_permit',
    'building_occupancy'
  )),
  storage_path text,
  required boolean not null default true,
  review_status text not null default 'PENDING'
    check (review_status in ('REQUESTED', 'PENDING', 'APPROVED', 'REJECTED')),
  admin_notes text,
  submitted_at timestamptz,
  submission_notified_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (store_id, certificate_type),
  check (review_status = 'REQUESTED' or storage_path is not null)
);

create index if not exists store_certifications_store_idx
  on public.store_certifications (store_id, required, review_status);

alter table public.store_certifications enable row level security;

drop policy if exists "owners read own certifications" on public.store_certifications;
create policy "owners read own certifications" on public.store_certifications
  for select to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = store_certifications.store_id
        and stores.user_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "owners submit certifications" on public.store_certifications;
create policy "owners submit certifications" on public.store_certifications
  for insert to authenticated
  with check (
    required
    and review_status = 'PENDING'
    and storage_path is not null
    and admin_notes is null
    and submission_notified_at is null
    and reviewed_at is null
    and reviewed_by is null
    and exists (
      select 1 from public.stores
      where stores.id = store_certifications.store_id
        and stores.user_id = auth.uid()
    )
  );

drop policy if exists "owners replace unapproved certifications" on public.store_certifications;
create policy "owners replace unapproved certifications" on public.store_certifications
  for update to authenticated
  using (
    review_status in ('REQUESTED', 'PENDING', 'REJECTED')
    and exists (
      select 1 from public.stores
      where stores.id = store_certifications.store_id
        and stores.user_id = auth.uid()
    )
  )
  with check (
    required
    and review_status = 'PENDING'
    and storage_path is not null
    and admin_notes is null
    and submission_notified_at is null
    and reviewed_at is null
    and reviewed_by is null
    and exists (
      select 1 from public.stores
      where stores.id = store_certifications.store_id
        and stores.user_id = auth.uid()
    )
  );

create or replace function public.protect_store_compliance_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.compliance_deadline_at := now() + interval '15 days';
    new.compliance_notified_at := null;
    new.compliance_approved_at := null;
    new.compliance_suspended_at := null;
  elsif auth.role() = 'authenticated' and not public.is_admin() then
    new.compliance_deadline_at := old.compliance_deadline_at;
    new.compliance_notified_at := old.compliance_notified_at;
    new.compliance_approved_at := old.compliance_approved_at;
    new.compliance_suspended_at := old.compliance_suspended_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_store_compliance_fields on public.stores;
create trigger protect_store_compliance_fields
  before insert or update on public.stores
  for each row execute function public.protect_store_compliance_fields();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-certifications',
  'seller-certifications',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "owners upload own certifications" on storage.objects;
create policy "owners upload own certifications" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'seller-certifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owners read own certifications" on storage.objects;
create policy "owners read own certifications" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'seller-certifications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores
  for select
  using (
    verification_status <> 'REJECTED'
    and compliance_suspended_at is null
  );

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.verification_status = 'VERIFIED'
        and stores.compliance_suspended_at is null
    )
  );

drop policy if exists "verified owner insert products" on public.products;
create policy "verified owner insert products" on public.products
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and stores.verification_status = 'VERIFIED'
        and stores.compliance_suspended_at is null
    )
  );

drop policy if exists "verified owner update products" on public.products;
create policy "verified owner update products" on public.products
  for update to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and stores.verification_status = 'VERIFIED'
        and stores.compliance_suspended_at is null
    )
  )
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and stores.verification_status = 'VERIFIED'
        and stores.compliance_suspended_at is null
    )
  );

drop policy if exists "verified owner delete products" on public.products;
create policy "verified owner delete products" on public.products
  for delete to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id
        and stores.user_id = auth.uid()
        and stores.verification_status = 'VERIFIED'
        and stores.compliance_suspended_at is null
    )
  );

notify pgrst, 'reload schema';
