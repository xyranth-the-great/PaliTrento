-- ============================================================
-- PaliTrento Business Verification & Document Compliance System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create storage bucket for business verification documents (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-documents', 'business-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage policies for business documents
-- Only business owner and admins can access
drop policy if exists "business owner access own documents" on storage.objects;
create policy "business owner access own documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "business owner upload own documents" on storage.objects;
create policy "business owner upload own documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "business owner update own documents" on storage.objects;
create policy "business owner update own documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "business owner delete own documents" on storage.objects;
create policy "business owner delete own documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can access all business documents
drop policy if exists "admin access all business documents" on storage.objects;
create policy "admin access all business documents" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'business-documents'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Business documents table
create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('BARANGAY_CLEARANCE', 'CEDULA', 'BUSINESS_PERMIT')),
  file_path text not null, -- storage path
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_documents_store_idx on public.business_documents(store_id);
create index if not exists business_documents_user_idx on public.business_documents(user_id);
create index if not exists business_documents_type_idx on public.business_documents(document_type);
create index if not exists business_documents_status_idx on public.business_documents(status);

alter table public.business_documents enable row level security;

-- Business owners can read their own documents
drop policy if exists "business owner read own documents" on public.business_documents;
create policy "business owner read own documents" on public.business_documents
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Business owners can insert their own documents
drop policy if exists "business owner insert own documents" on public.business_documents;
create policy "business owner insert own documents" on public.business_documents
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Business owners can update their own documents (e.g., replace rejected)
drop policy if exists "business owner update own documents" on public.business_documents;
create policy "business owner update own documents" on public.business_documents
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Business compliance tracking table
create table if not exists public.business_compliance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  compliance_deadline timestamptz not null, -- 15 days from store creation
  is_compliant boolean not null default false,
  all_documents_approved boolean not null default false,
  suspended_for_noncompliance boolean not null default false,
  suspension_reason text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_compliance_deadline_idx on public.business_compliance(compliance_deadline);
create index if not exists business_compliance_user_idx on public.business_compliance(user_id);

alter table public.business_compliance enable row level security;

-- Business owners can read their own compliance record
drop policy if exists "business owner read own compliance" on public.business_compliance;
create policy "business owner read own compliance" on public.business_compliance
  for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- System/Service role can insert/update compliance records
drop policy if exists "service role manage compliance" on public.business_compliance;
create policy "service role manage compliance" on public.business_compliance
  for all to service_role
  using (true);

-- 4. Function to check if all required documents are approved
create or replace function public.check_business_documents_approved(p_store_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  required_docs text[] := array['BARANGAY_CLEARANCE', 'CEDULA', 'BUSINESS_PERMIT'];
  approved_count integer;
begin
  select count(distinct document_type) into approved_count
  from public.business_documents
  where store_id = p_store_id
    and status = 'APPROVED'
    and document_type = any(required_docs);

  return approved_count = 3;
end;
$$;

revoke all on function public.check_business_documents_approved(uuid) from public, anon;
grant execute on function public.check_business_documents_approved(uuid) to authenticated, service_role;

-- 5. Function to update business compliance status
create or replace function public.update_business_compliance(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compliant boolean;
  v_all_approved boolean;
begin
  v_all_approved := public.check_business_documents_approved(p_store_id);

  if v_all_approved then
    -- All documents approved - mark as compliant and verified
    update public.business_compliance
    set is_compliant = true,
        all_documents_approved = true,
        updated_at = now()
    where store_id = p_store_id;

    -- Update store verification status
    update public.stores
    set verification_status = 'VERIFIED',
        updated_at = now()
    where id = p_store_id and verification_status != 'VERIFIED';

    -- Notify business owner (create advisory)
    insert into public.advisories (title, body, category, priority, published_at, created_by)
    select
      'Business Verified',
      'Congratulations! All required documents for ' || s.business_name || ' have been approved. Your business is now verified.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      s.user_id
    from public.stores s
    where s.id = p_store_id
      and s.user_id is not null;
  else
    -- Not all approved yet
    update public.business_compliance
    set all_documents_approved = false,
        updated_at = now()
    where store_id = p_store_id;
  end if;
end;
$$;

revoke all on function public.update_business_compliance(uuid) from public, anon;
grant execute on function public.update_business_compliance(uuid) to authenticated, service_role;

-- 6. Function to check and enforce compliance deadlines (run via pg_cron)
create or replace function public.enforce_business_compliance_deadlines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  suspended_count integer := 0;
  rec record;
begin
  -- Find non-compliant businesses past their deadline
  for rec in
    select bc.store_id, bc.user_id, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now()
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
  loop
    -- Suspend the business account
    update public.business_compliance
    set suspended_for_noncompliance = true,
        suspension_reason = 'Failed to submit required business documents within 15-day compliance period',
        suspended_at = now(),
        updated_at = now()
    where store_id = rec.store_id;

    -- Update store verification status
    update public.stores
    set verification_status = 'REJECTED'
    where id = rec.store_id and verification_status != 'REJECTED';

    -- Notify business owner
    insert into public.advisories (title, body, category, priority, published_at, created_by)
    values (
      'Business Account Suspended - Document Compliance',
      'Your business "' || rec.business_name || '" has been suspended for failing to submit all required documents (Barangay Clearance, Cedula, Business Permit) within the 15-day compliance period. Please contact LGU administration to resolve.',
      'EMERGENCY',
      'high',
      now(),
      rec.user_id
    );

    -- Also create moderation action record for the user
    insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason)
    values (rec.user_id, rec.user_id, 'suspend_temporary', 'Automatic suspension: Failed to comply with business document requirements within 15 days');

    suspended_count := suspended_count + 1;
  end loop;

  return suspended_count;
end;
$$;

revoke all on function public.enforce_business_compliance_deadlines() from public, anon, authenticated;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

-- 7. Trigger to create compliance record when store is created
create or replace function public.create_business_compliance_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only create for new stores (not updates)
  if (TG_OP = 'INSERT') then
    insert into public.business_compliance (store_id, user_id, compliance_deadline)
    values (NEW.id, NEW.user_id, now() + interval '15 days')
    on conflict (store_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists create_business_compliance_trigger on public.stores;
create trigger create_business_compliance_trigger
  after insert on public.stores
  for each row execute function public.create_business_compliance_record();

-- 8. Trigger to update compliance when document status changes
create or replace function public.update_compliance_on_document_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP in ('INSERT', 'UPDATE')) then
    perform public.update_business_compliance(NEW.store_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists update_compliance_on_document_trigger on public.business_documents;
create trigger update_compliance_on_document_trigger
  after insert or update on public.business_documents
  for each row execute function public.update_compliance_on_document_change();

-- 9. Admin function to review business document
create or replace function public.admin_review_business_document(
  p_actor_id uuid,
  p_document_id uuid,
  p_action text, -- 'APPROVE' or 'REJECT'
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_doc public.business_documents%rowtype;
  v_store public.stores%rowtype;
begin
  -- Verify actor is admin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role <> 'admin' then
    raise exception 'Only administrators can review business documents';
  end if;

  -- Get document
  select * into v_doc from public.business_documents where id = p_document_id;
  if not found then
    raise exception 'Document not found';
  end if;

  -- Get store
  select * into v_store from public.stores where id = v_doc.store_id;

  -- Update document
  if p_action = 'APPROVE' then
    update public.business_documents
    set status = 'APPROVED',
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        updated_at = now()
    where id = p_document_id;
  elsif p_action = 'REJECT' then
    if p_rejection_reason is null or length(trim(p_rejection_reason)) = 0 then
      raise exception 'Rejection reason is required';
    end if;
    update public.business_documents
    set status = 'REJECTED',
        rejection_reason = trim(p_rejection_reason),
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        updated_at = now()
    where id = p_document_id;
  else
    raise exception 'Invalid action. Use APPROVE or REJECT';
  end if;

  -- Trigger will update compliance automatically

  return jsonb_build_object('success', true, 'document_id', p_document_id, 'action', p_action);
end;
$$;

revoke all on function public.admin_review_business_document(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_business_document(uuid, uuid, text, text) to service_role;

-- 10. Grant for authenticated users
grant select on public.business_documents to authenticated;
grant select on public.business_compliance to authenticated;
grant insert, update on public.business_documents to authenticated;

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Set up pg_cron to run enforce_business_compliance_deadlines() every hour:
--    SELECT cron.schedule('enforce-business-compliance', '0 * * * *', 'SELECT public.enforce_business_compliance_deadlines();');
-- 3. For existing businesses, run a one-time script to create compliance records:
--    INSERT INTO business_compliance (store_id, user_id, compliance_deadline)
--    SELECT id, user_id, created_at + interval '15 days'
--    FROM stores
--    WHERE user_id IS NOT NULL
--    ON CONFLICT (store_id) DO NOTHING;
-- ============================================================