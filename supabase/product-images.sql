-- Product Images Migration
-- Run in Supabase SQL Editor

-- Add image_url column to products table
alter table if exists products add column if not exists image_url text;

-- Create storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- RLS policies for product images bucket
create policy "product images public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "owner upload product images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner update product images" on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete product images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add index for product images
create index if not exists products_image_url_idx on products(image_url) where image_url is not null;