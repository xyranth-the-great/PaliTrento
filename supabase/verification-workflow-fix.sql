-- ============================================================
-- PaliTrento Verification Workflow Fix
-- Run in Supabase SQL Editor
-- Adds approval/certificate status separation, countdown tracking, and auto-suspension
-- ============================================================

-- 1. Add new columns to stores table
alter table public.stores
  add column if not exists approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  add column if not exists certificate_status text not null default 'NONE'
    check (certificate_status in ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  add column if not exists certificate_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspension_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- Add indexes for common queries
create index if not exists stores_approval_status_idx on public.stores(approval_status);
create index if not exists stores_certificate_status_idx on public.stores(certificate_status);
create index if not exists stores_is_suspended_idx on public.stores(is_suspended) where is_suspended = true;

-- 2. Add new columns to business_compliance table
alter table public.business_compliance
  add column if not exists compliance_paused_at timestamptz,
  add column if not exists compliance_remaining_seconds integer,
  add column if not exists countdown_started_at timestamptz;

create index if not exists business_compliance_paused_idx on public.business_compliance(compliance_paused_at) where compliance_paused_at is not null;

-- 3. Create helper function to determine displayed badge status (single source of truth)
create or replace function public.get_store_display_status(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_compliance public.business_compliance%rowtype;
  v_result jsonb;
  v_remaining_days integer;
  v_remaining_seconds integer;
  v_now timestamptz := now();
begin
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND', 'badge_class', 'warn', 'label', 'Not Found');
  end if;

  select * into v_compliance from public.business_compliance where store_id = p_store_id;

  -- Suspended (either by admin or auto-suspension)
  if v_store.is_suspended then
    return jsonb_build_object(
      'status', 'SUSPENDED',
      'badge_class', 'bad',
      'label', 'Suspended',
      'message', v_store.suspension_reason,
      'can_upload_certificate', true
    );
  end if;

  -- Not yet approved by admin
  if v_store.approval_status = 'PENDING' then
    return jsonb_build_object(
      'status', 'PENDING_APPROVAL',
      'badge_class', 'warn',
      'label', 'Pending Approval',
      'message', 'Awaiting LGU review of your business submission.'
    );
  end if;

  -- Approved but no certificate yet - countdown running
  if v_store.approval_status = 'APPROVED' and v_store.certificate_status = 'NONE' then
    v_remaining_seconds := 0;
    if v_compliance.compliance_paused_at is not null and v_compliance.compliance_remaining_seconds is not null then
      -- Countdown is paused (certificate under review)
      return jsonb_build_object(
        'status', 'CERTIFICATE_UNDER_REVIEW',
        'badge_class', 'info',
        'label', 'Certificate Under Review',
        'message', 'Your certificate is being reviewed. Countdown paused.',
        'countdown_paused', true,
        'remaining_seconds', v_compliance.compliance_remaining_seconds
      );
    elsif v_compliance.compliance_deadline is not null then
      v_remaining_seconds := greatest(0, extract(epoch from (v_compliance.compliance_deadline - v_now)))::integer;
      if v_remaining_seconds <= 0 then
        -- Should be suspended by cron, but return expired state
        return jsonb_build_object(
          'status', 'COMPLIANCE_EXPIRED',
          'badge_class', 'bad',
          'label', 'Compliance Expired',
          'message', 'Certificate compliance deadline has passed. Account will be suspended.',
          'countdown_expired', true
        );
      else
        v_remaining_days := (v_remaining_seconds / 86400)::integer + 1;
        return jsonb_build_object(
          'status', 'APPROVED_NO_CERTIFICATE',
          'badge_class', 'warn',
          'label', 'Approved - Certificate Pending',
          'message', v_remaining_days || ' day' || case when v_remaining_days = 1 then '' else 's' end || ' left to upload your business certificate',
          'countdown_active', true,
          'remaining_seconds', v_remaining_seconds,
          'remaining_days', v_remaining_days,
          'deadline', v_compliance.compliance_deadline
        );
      end if;
    else
      -- Fallback: no compliance record, start fresh
      return jsonb_build_object(
        'status', 'APPROVED_NO_CERTIFICATE',
        'badge_class', 'warn',
        'label', 'Approved - Certificate Pending',
        'message', '15 days left to upload your business certificate',
        'countdown_active', true,
        'remaining_seconds', 15 * 86400,
        'remaining_days', 15
      );
    end if;
  end if;

  -- Certificate pending review
  if v_store.certificate_status = 'PENDING_REVIEW' then
    return jsonb_build_object(
      'status', 'CERTIFICATE_UNDER_REVIEW',
      'badge_class', 'info',
      'label', 'Certificate Under Review',
      'message', 'Your certificate is being reviewed. Countdown paused.',
      'countdown_paused', true,
      'remaining_seconds', v_compliance.compliance_remaining_seconds
    );
  end if;

  -- Certificate rejected
  if v_store.certificate_status = 'REJECTED' then
    v_remaining_seconds := 0;
    if v_compliance.compliance_deadline is not null then
      v_remaining_seconds := greatest(0, extract(epoch from (v_compliance.compliance_deadline - v_now)))::integer;
    end if;
    if v_remaining_seconds <= 0 then
      return jsonb_build_object(
        'status', 'CERTIFICATE_REJECTED_EXPIRED',
        'badge_class', 'bad',
        'label', 'Certificate Rejected - Compliance Expired',
        'message', 'Certificate was rejected and compliance deadline has passed. Account will be suspended.',
        'countdown_expired', true,
        'can_reupload', true
      );
    else
      v_remaining_days := (v_remaining_seconds / 86400)::integer + 1;
      return jsonb_build_object(
        'status', 'CERTIFICATE_REJECTED',
        'badge_class', 'bad',
        'label', 'Certificate Rejected',
        'message', 'Certificate rejected. ' || v_remaining_days || ' day' || case when v_remaining_days = 1 then '' else 's' end || ' left to re-upload.',
        'countdown_active', true,
        'remaining_seconds', v_remaining_seconds,
        'remaining_days', v_remaining_days,
        'can_reupload', true,
        'rejection_reason', (select rejection_reason from public.business_documents where store_id = p_store_id and status = 'REJECTED' order by reviewed_at desc limit 1)
      );
    end if;
  end if;

  -- Certificate approved = Verified
  if v_store.certificate_status = 'APPROVED' then
    return jsonb_build_object(
      'status', 'VERIFIED',
      'badge_class', 'ok',
      'label', 'Verified',
      'message', 'All documents approved. Your business is verified.',
      'verified_at', v_store.verified_at
    );
  end if;

  -- Rejected by admin (not certificate-specific)
  if v_store.approval_status = 'REJECTED' then
    return jsonb_build_object(
      'status', 'REJECTED',
      'badge_class', 'bad',
      'label', 'Rejected',
      'message', 'Your business submission was rejected. Please contact LGU administration.'
    );
  end if;

  -- Default fallback
  return jsonb_build_object(
    'status', 'UNKNOWN',
    'badge_class', 'warn',
    'label', 'Unknown Status'
  );
end;
$$;

revoke all on function public.get_store_display_status(uuid) from public, anon;
grant execute on function public.get_store_display_status(uuid) to authenticated, service_role;

-- 4. Admin function to approve store submission (starts 15-day countdown)
create or replace function public.admin_approve_store_submission(
  p_actor_id uuid,
  p_store_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_store public.stores%rowtype;
  v_compliance public.business_compliance%rowtype;
  v_deadline timestamptz := now() + interval '15 days';
begin
  -- Verify actor is admin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role <> 'admin' then
    raise exception 'Only administrators can approve store submissions';
  end if;

  -- Get store
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found';
  end if;

  -- Update store status
  update public.stores
  set approval_status = 'APPROVED',
      certificate_status = 'NONE',
      admin_notes = p_admin_notes,
      updated_at = now()
  where id = p_store_id;

  -- Create or update compliance record with 15-day deadline
  insert into public.business_compliance (store_id, user_id, compliance_deadline, countdown_started_at)
  values (p_store_id, v_store.user_id, v_deadline, now())
  on conflict (store_id) do update set
    compliance_deadline = v_deadline,
    compliance_paused_at = null,
    compliance_remaining_seconds = null,
    countdown_started_at = now(),
    suspended_for_noncompliance = false,
    is_compliant = false,
    all_documents_approved = false,
    updated_at = now();

  -- Notify store owner
  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
  values (
    'Business Approved - Certificate Required',
    'Your business "' || v_store.business_name || '" has been approved! You have 15 days to upload your business certificate (Barangay Clearance, Cedula, and Business Permit) to become fully verified.',
    'ANNOUNCEMENT',
    'normal',
    now(),
    p_actor_id,
    v_store.user_id
  );

  return jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'approval_status', 'APPROVED',
    'certificate_status', 'NONE',
    'compliance_deadline', v_deadline
  );
end;
$$;

revoke all on function public.admin_approve_store_submission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_approve_store_submission(uuid, uuid, text) to service_role;

-- 5. Function to handle certificate upload (pauses countdown)
create or replace function public.submit_store_certificate(
  p_store_id uuid,
  p_document_type text,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores%rowtype;
  v_compliance public.business_compliance%rowtype;
  v_remaining_seconds integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Must be authenticated';
  end if;

  select * into v_store from public.stores where id = p_store_id and user_id = v_user_id;
  if not found then
    raise exception 'Store not found or access denied';
  end if;

  if v_store.approval_status <> 'APPROVED' then
    raise exception 'Store must be approved before uploading certificates';
  end if;

  select * into v_compliance from public.business_compliance where store_id = p_store_id;

  -- Calculate remaining seconds if countdown is running
  if v_compliance.compliance_paused_at is null and v_compliance.compliance_deadline is not null then
    v_remaining_seconds := greatest(0, extract(epoch from (v_compliance.compliance_deadline - v_now)))::integer;
  else
    v_remaining_seconds := v_compliance.compliance_remaining_seconds;
  end if;

  -- Upsert document
  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (p_store_id, v_user_id, p_document_type, p_file_path, p_file_name, p_file_size, p_mime_type, 'PENDING_REVIEW')
  on conflict (store_id, document_type) do update set
    file_path = excluded.file_path,
    file_name = excluded.file_name,
    file_size = excluded.file_size,
    mime_type = excluded.mime_type,
    status = 'PENDING_REVIEW',
    rejection_reason = null,
    reviewed_by = null,
    reviewed_at = null,
    submitted_at = now(),
    updated_at = now();

  -- Update store certificate status
  update public.stores
  set certificate_status = 'PENDING_REVIEW',
      updated_at = now()
  where id = p_store_id;

  -- Pause compliance countdown
  update public.business_compliance
  set compliance_paused_at = v_now,
      compliance_remaining_seconds = v_remaining_seconds,
      updated_at = v_now
  where store_id = p_store_id;

  -- Notify admins
  insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
  select
    'New Certificate Submission',
    'Store "' || v_store.business_name || '" has submitted a ' || p_document_type || ' for review.',
    'ANNOUNCEMENT',
    'normal',
    v_now,
    v_user_id,
    p.id
  from public.profiles p
  where p.role = 'admin';

  return jsonb_build_object('success', true, 'status', 'PENDING_REVIEW', 'remaining_seconds_paused', v_remaining_seconds);
end;
$$;

revoke all on function public.submit_store_certificate(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.submit_store_certificate(uuid, text, text, text, bigint, text) to authenticated;

-- 6. Enhanced admin_review_business_document with countdown resume/clear logic
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
  v_compliance public.business_compliance%rowtype;
  v_all_approved boolean;
  v_remaining_seconds integer;
  v_new_deadline timestamptz;
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

  -- Get compliance
  select * into v_compliance from public.business_compliance where store_id = v_doc.store_id;

  -- Update document
  if p_action = 'APPROVE' then
    update public.business_documents
    set status = 'APPROVED',
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        updated_at = now()
    where id = p_document_id;

    -- Check if all required documents are approved
    select count(distinct document_type) into v_all_approved
    from public.business_documents
    where store_id = v_doc.store_id
      and status = 'APPROVED'
      and document_type = any(array['BARANGAY_CLEARANCE', 'CEDULA', 'BUSINESS_PERMIT']);

    if v_all_approved = 3 then
      -- ALL DOCUMENTS APPROVED -> VERIFIED
      update public.stores
      set certificate_status = 'APPROVED',
          approval_status = 'APPROVED',
          verified_at = now(),
          is_suspended = false,
          suspension_reason = null,
          updated_at = now()
      where id = v_doc.store_id;

      -- Clear compliance countdown entirely
      update public.business_compliance
      set compliance_deadline = null,
          compliance_paused_at = null,
          compliance_remaining_seconds = null,
          is_compliant = true,
          all_documents_approved = true,
          suspended_for_noncompliance = false,
          updated_at = now()
      where store_id = v_doc.store_id;

      -- Notify store owner
      insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
      values (
        'Business Verified',
        'Congratulations! All required documents for ' || v_store.business_name || ' have been approved. Your business is now verified.',
        'ANNOUNCEMENT',
        'normal',
        now(),
        p_actor_id,
        v_store.user_id
      );

      return jsonb_build_object('success', true, 'action', 'APPROVE', 'store_status', 'VERIFIED', 'all_approved', true);
    else
      -- Some documents still pending - keep certificate status as PENDING_REVIEW
      update public.stores
      set certificate_status = 'PENDING_REVIEW',
          updated_at = now()
      where id = v_doc.store_id;

      return jsonb_build_object('success', true, 'action', 'APPROVE', 'store_status', 'CERTIFICATE_UNDER_REVIEW', 'all_approved', false);
    end if;

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

    -- Update store certificate status
    update public.stores
    set certificate_status = 'REJECTED',
        updated_at = now()
    where id = v_doc.store_id;

    -- Resume countdown with remaining time
    if v_compliance.compliance_remaining_seconds is not null then
      v_remaining_seconds := v_compliance.compliance_remaining_seconds;
    elsif v_compliance.compliance_deadline is not null then
      v_remaining_seconds := greatest(0, extract(epoch from (v_compliance.compliance_deadline - now())))::integer;
    else
      v_remaining_seconds := 15 * 86400; -- fallback to 15 days
    end if;

    if v_remaining_seconds <= 0 then
      -- Time already expired - suspend immediately
      v_new_deadline := now();
      update public.stores
      set is_suspended = true,
          suspension_reason = 'Certificate rejected and compliance deadline expired',
          updated_at = now()
      where id = v_doc.store_id;

      update public.business_compliance
      set suspended_for_noncompliance = true,
          suspension_reason = 'Certificate rejected and compliance deadline expired',
          suspended_at = now(),
          compliance_deadline = now(),
          compliance_paused_at = null,
          compliance_remaining_seconds = 0,
          updated_at = now()
      where store_id = v_doc.store_id;

      insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
      values (
        'Business Suspended - Certificate Rejected',
        'Your certificate for "' || v_store.business_name || '" was rejected and the compliance deadline has expired. Your account has been suspended. Please contact LGU administration to resolve.',
        'EMERGENCY',
        'high',
        now(),
        p_actor_id,
        v_store.user_id
      );
    else
      v_new_deadline := now() + (v_remaining_seconds || 'seconds')::interval;
      update public.business_compliance
      set compliance_deadline = v_new_deadline,
          compliance_paused_at = null,
          compliance_remaining_seconds = null,
          updated_at = now()
      where store_id = v_doc.store_id;

      insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
      values (
        'Certificate Rejected - Resubmit Required',
        'Your ' || v_doc.document_type || ' for "' || v_store.business_name || '" was rejected: ' || p_rejection_reason || '. You have ' || (v_remaining_seconds / 86400)::integer + 1 || ' day(s) to re-upload.',
        'ANNOUNCEMENT',
        'high',
        now(),
        p_actor_id,
        v_store.user_id
      );
    end if;

    return jsonb_build_object('success', true, 'action', 'REJECT', 'store_status', 'CERTIFICATE_REJECTED', 'remaining_seconds', v_remaining_seconds);
  else
    raise exception 'Invalid action. Use APPROVE or REJECT';
  end if;
end;
$$;

revoke all on function public.admin_review_business_document(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_business_document(uuid, uuid, text, text) to service_role;

-- 7. Enhanced enforce_business_compliance_deadlines (for pg_cron)
create or replace function public.enforce_business_compliance_deadlines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  suspended_count integer := 0;
  rec record;
  v_store public.stores%rowtype;
begin
  -- Find non-compliant businesses past their deadline (countdown not paused)
  for rec in
    select bc.store_id, bc.user_id, bc.compliance_remaining_seconds, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now()
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
      and bc.compliance_paused_at is null  -- Only suspend if not paused
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
    set verification_status = 'REJECTED',
        is_suspended = true,
        suspension_reason = 'Failed to submit required business documents within 15-day compliance period',
        updated_at = now()
    where id = rec.store_id;

    -- Notify business owner
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Business Account Suspended - Document Compliance',
      'Your business "' || rec.business_name || '" has been suspended for failing to submit all required documents (Barangay Clearance, Cedula, Business Permit) within the 15-day compliance period. Please contact LGU administration to resolve.',
      'EMERGENCY',
      'high',
      now(),
      rec.user_id,
      rec.user_id
    );

    -- Also create moderation action record for the user
    insert into public.account_moderation_actions (target_user_id, actor_user_id, action, reason)
    values (rec.user_id, rec.user_id, 'suspend_temporary', 'Automatic suspension: Failed to comply with business document requirements within 15 days');

    suspended_count := suspended_count + 1;
  end loop;

  -- Also send reminder notifications (7 days, 3 days, 1 day left)
  -- 7 days left
  for rec in
    select bc.store_id, bc.user_id, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now() + interval '7 days'
      and bc.compliance_deadline > now() + interval '6 days'
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
      and bc.compliance_paused_at is null
  loop
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Certificate Deadline Approaching - 7 Days Left',
      'Your business "' || rec.business_name || '" has 7 days left to upload required business documents to avoid suspension.',
      'ANNOUNCEMENT',
      'normal',
      now(),
      rec.user_id,
      rec.user_id
    );
  end loop;

  -- 3 days left
  for rec in
    select bc.store_id, bc.user_id, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now() + interval '3 days'
      and bc.compliance_deadline > now() + interval '2 days'
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
      and bc.compliance_paused_at is null
  loop
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Certificate Deadline Approaching - 3 Days Left',
      'Your business "' || rec.business_name || '" has 3 days left to upload required business documents to avoid suspension.',
      'ANNOUNCEMENT',
      'high',
      now(),
      rec.user_id,
      rec.user_id
    );
  end loop;

  -- 1 day left
  for rec in
    select bc.store_id, bc.user_id, s.business_name
    from public.business_compliance bc
    join public.stores s on s.id = bc.store_id
    where bc.compliance_deadline <= now() + interval '1 day'
      and bc.compliance_deadline > now()
      and bc.all_documents_approved = false
      and bc.suspended_for_noncompliance = false
      and bc.compliance_paused_at is null
  loop
    insert into public.advisories (title, body, category, priority, published_at, created_by, recipient_id)
    values (
      'Certificate Deadline Urgent - 1 Day Left',
      'Your business "' || rec.business_name || '" has 1 day left to upload required business documents to avoid suspension.',
      'ANNOUNCEMENT',
      'critical',
      now(),
      rec.user_id,
      rec.user_id
    );
  end loop;

  return suspended_count;
end;
$$;

revoke all on function public.enforce_business_compliance_deadlines() from public, anon, authenticated;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

-- 8. Backfill existing stores with sensible defaults
-- Stores that are VERIFIED and have approved documents -> VERIFIED (no countdown)
-- Stores that are VERIFIED but no approved documents -> start fresh 15-day countdown
-- Stores that are PENDING -> PENDING_APPROVAL (no countdown)
do $$
declare
  v_store public.stores%rowtype;
  v_approved_count integer;
begin
  for v_store in select * from public.stores where user_id is not null loop
    -- Check if store has all 3 approved documents
    select count(distinct document_type) into v_approved_count
    from public.business_documents
    where store_id = v_store.id
      and status = 'APPROVED'
      and document_type = any(array['BARANGAY_CLEARANCE', 'CEDULA', 'BUSINESS_PERMIT']);

    if v_store.verification_status = 'VERIFIED' and v_approved_count = 3 then
      -- Already verified with all docs - mark as fully verified, no countdown
      update public.stores
      set approval_status = 'APPROVED',
          certificate_status = 'APPROVED',
          verified_at = v_store.created_at,
          updated_at = now()
      where id = v_store.id;

      -- Ensure compliance record exists but is cleared
      insert into public.business_compliance (store_id, user_id, is_compliant, all_documents_approved, compliance_deadline)
      values (v_store.id, v_store.user_id, true, true, null)
      on conflict (store_id) do update set
        is_compliant = true,
        all_documents_approved = true,
        compliance_deadline = null,
        compliance_paused_at = null,
        compliance_remaining_seconds = null,
        suspended_for_noncompliance = false;

    elsif v_store.verification_status = 'VERIFIED' and v_approved_count < 3 then
      -- Was "verified" but missing docs - treat as approved, start 15-day countdown
      update public.stores
      set approval_status = 'APPROVED',
          certificate_status = 'NONE',
          updated_at = now()
      where id = v_store.id;

      insert into public.business_compliance (store_id, user_id, compliance_deadline, countdown_started_at)
      values (v_store.id, v_store.user_id, now() + interval '15 days', now())
      on conflict (store_id) do update set
        compliance_deadline = now() + interval '15 days',
        compliance_paused_at = null,
        compliance_remaining_seconds = null,
        countdown_started_at = now(),
        suspended_for_noncompliance = false,
        is_compliant = false,
        all_documents_approved = false;

    elsif v_store.verification_status = 'PENDING' then
      -- Pending admin review
      update public.stores
      set approval_status = 'PENDING',
          certificate_status = 'NONE',
          updated_at = now()
      where id = v_store.id;

    elsif v_store.verification_status = 'REJECTED' then
      -- Rejected by admin
      update public.stores
      set approval_status = 'REJECTED',
          certificate_status = 'NONE',
          updated_at = now()
      where id = v_store.id;

    elsif v_store.verification_status = 'CLARIFICATION_REQUIRED' then
      -- Needs clarification
      update public.stores
      set approval_status = 'PENDING',
          certificate_status = 'NONE',
          updated_at = now()
      where id = v_store.id;
    end if;
  end loop;
end;
$$;

-- 9. Grant permissions
grant execute on function public.get_store_display_status(uuid) to authenticated, service_role;
grant execute on function public.admin_approve_store_submission(uuid, uuid, text) to service_role;
grant execute on function public.submit_store_certificate(uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.admin_review_business_document(uuid, uuid, text, text) to service_role;
grant execute on function public.enforce_business_compliance_deadlines() to service_role;

-- ============================================================
-- DEPLOYMENT CHECKLIST:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Update frontend to use get_store_display_status() for badge rendering
-- 3. Update admin-verification.js to use new admin functions
-- 4. Update dashboard.js to show countdown/paused states
-- 5. Set up pg_cron for enforce_business_compliance_deadlines():
--    SELECT cron.schedule('enforce-business-compliance', '0 * * * *', 'SELECT public.enforce_business_compliance_deadlines();');
-- ============================================================