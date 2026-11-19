-- Store the admin's explanation for hiding a store or product from the public marketplace.
-- Reasons remain visible to the owner while the listing is removed and clear on restore.

alter table public.stores
  add column if not exists marketplace_removal_reason text;

alter table public.products
  add column if not exists marketplace_removal_reason text;

notify pgrst, 'reload schema';
