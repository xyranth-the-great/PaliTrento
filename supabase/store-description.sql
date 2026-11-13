-- Run in Supabase SQL Editor to enable optional public store descriptions.
alter table public.stores
  add column if not exists description text;

notify pgrst, 'reload schema';
