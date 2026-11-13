-- Run in Supabase SQL Editor to enable optional public store descriptions.
alter table stores
  add column if not exists description text;
