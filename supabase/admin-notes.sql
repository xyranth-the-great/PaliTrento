-- Add admin_notes column to stores for verification feedback
alter table stores add column if not exists admin_notes text;

-- Add verified_at and verified_by for audit trail
alter table stores add column if not exists verified_at timestamptz;
alter table stores add column if not exists verified_by uuid references auth.users(id);