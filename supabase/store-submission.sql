-- Run in Supabase SQL Editor for projects created before store submission was configured.
alter table public.stores
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists description text,
  add column if not exists storefront_image_url text,
  add column if not exists permits_image_url text;

alter table public.stores drop constraint if exists stores_trade_category_check;
alter table public.stores
  add constraint stores_trade_category_check
  check (trade_category in ('SARI_SARI','CARINDERIA','FRESH_PRODUCE','PHARMACY','SERVICES','PRODUCT','AGRI'));

create or replace function public.is_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end; $$;

alter table public.stores enable row level security;

drop policy if exists "owner read own store" on public.stores;
create policy "owner read own store" on public.stores
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "owner insert own store" on public.stores;
create policy "owner insert own store" on public.stores
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owner update own store" on public.stores;
create policy "owner update own store" on public.stores
  for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "store images public read" on storage.objects;
create policy "store images public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store-images');

drop policy if exists "owner upload store images" on storage.objects;
create policy "owner upload store images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner update store images" on storage.objects;
create policy "owner update store images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
