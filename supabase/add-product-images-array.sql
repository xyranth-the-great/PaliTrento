-- Add image_urls array column to products table for multiple product images
-- Run in Supabase SQL Editor

-- Add image_urls array column (stores up to 3 image URLs)
alter table if exists products add column if not exists image_urls text[];

-- Create index for products with images
create index if not exists products_image_urls_idx on products using gin (image_urls) where image_urls is not null;

-- Optional: Migrate existing single image_url to image_urls array for backwards compatibility
-- This can be run once after adding the column
-- update products set image_urls = array[image_url] where image_url is not null and (image_urls is null or array_length(image_urls, 1) is null);

-- Note: The application code maintains both columns:
-- - image_urls: array of up to 3 image URLs (new, primary)
-- - image_url: single image URL (backwards compatibility, set to first element of image_urls)