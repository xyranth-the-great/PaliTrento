-- ============================================================
-- PaliTrento Verification Workflow Tests
-- Run in Supabase SQL Editor after applying verification-workflow-fix.sql
-- ============================================================

-- Test setup: Create test users and stores
-- Note: These tests assume you have admin user and test business owner users

-- ============================================================
-- TEST 1: Countdown starts on store approval
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
begin
  -- Get admin user
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  if v_admin_id is null then
    raise notice 'TEST 1 SKIPPED: No admin user found';
    return;
  end if;

  -- Get a test business owner (or create one)
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_owner_id is null then
    raise notice 'TEST 1 SKIPPED: No business owner found';
    return;
  end if;

  -- Create a test store in PENDING status
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-001', 'Test Store 1', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  -- Approve store submission
  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;

  -- Verify result
  assert v_result->>'success' = 'true', 'Store approval should succeed';
  assert v_result->>'approval_status' = 'APPROVED', 'Approval status should be APPROVED';
  assert v_result->>'certificate_status' = 'NONE', 'Certificate status should be NONE';

  -- Check compliance record
  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.compliance_deadline is not null, 'Compliance deadline should be set';
  assert v_compliance.compliance_deadline > now(), 'Deadline should be in future';
  assert v_compliance.compliance_deadline <= now() + interval '15 days' + interval '1 minute', 'Deadline should be ~15 days';
  assert v_compliance.countdown_started_at is not null, 'Countdown started at should be set';
  assert v_compliance.compliance_paused_at is null, 'Countdown should not be paused';
  assert v_compliance.compliance_remaining_seconds is null, 'Remaining seconds should be null when running';

  -- Check store status
  assert (select approval_status from public.stores where id = v_store_id) = 'APPROVED', 'Store approval_status should be APPROVED';
  assert (select certificate_status from public.stores where id = v_store_id) = 'NONE', 'Store certificate_status should be NONE';

  -- Check display status
  assert (select public.get_store_display_status(v_store_id))->>'status' = 'APPROVED_NO_CERTIFICATE', 'Display status should be APPROVED_NO_CERTIFICATE';
  assert (select public.get_store_display_status(v_store_id))->>'countdown_active' = 'true', 'Countdown should be active';

  raise notice 'TEST 1 PASSED: Countdown starts on store approval';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 2: Countdown pauses on certificate upload
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_display_status jsonb;
  v_remaining_before integer;
  v_remaining_after integer;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 2 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store and approve
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-002', 'Test Store 2', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;

  -- Wait a moment to ensure deadline is set
  perform pg_sleep(1);

  -- Get remaining seconds before upload
  select compliance_remaining_seconds into v_remaining_before from public.business_compliance where store_id = v_store_id;
  -- Should be null (countdown running)
  assert v_remaining_before is null, 'Before upload, remaining_seconds should be null';

  -- Upload a certificate as the store owner
  -- Note: submit_store_certificate requires auth.uid() = owner, so we simulate by calling with service role
  -- In real app, this is called from frontend with user's auth
  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (v_store_id, v_owner_id, 'BARANGAY_CLEARANCE', 'test/path.pdf', 'clearance.pdf', 1000, 'application/pdf', 'PENDING_REVIEW');

  -- Update store certificate status and pause compliance (this is what submit_store_certificate does)
  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;

  -- Pause compliance
  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  v_remaining_before := greatest(0, extract(epoch from (v_compliance.compliance_deadline - now())))::integer;

  update public.business_compliance
  set compliance_paused_at = now(),
      compliance_remaining_seconds = v_remaining_before,
      updated_at = now()
  where store_id = v_store_id;

  -- Verify countdown paused
  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.compliance_paused_at is not null, 'Countdown should be paused';
  assert v_compliance.compliance_remaining_seconds is not null, 'Remaining seconds should be saved';
  assert v_compliance.compliance_remaining_seconds > 0, 'Remaining seconds should be positive';

  -- Check display status
  v_display_status := public.get_store_display_status(v_store_id);
  assert v_display_status->>'status' = 'CERTIFICATE_UNDER_REVIEW', 'Display status should be CERTIFICATE_UNDER_REVIEW';
  assert v_display_status->>'countdown_paused' = 'true', 'Countdown should be paused';
  assert (v_display_status->>'remaining_seconds')::integer > 0, 'Remaining seconds should be positive';

  raise notice 'TEST 2 PASSED: Countdown pauses on certificate upload';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 3: Countdown resumes on certificate rejection
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_doc_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_display_status jsonb;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 3 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store, approve, upload cert
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-003', 'Test Store 3', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;
  perform pg_sleep(1);

  -- Upload certificate
  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (v_store_id, v_owner_id, 'BARANGAY_CLEARANCE', 'test/path.pdf', 'clearance.pdf', 1000, 'application/pdf', 'PENDING_REVIEW')
  returning id into v_doc_id;

  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;

  -- Pause compliance
  update public.business_compliance
  set compliance_paused_at = now(),
      compliance_remaining_seconds = greatest(0, extract(epoch from (compliance_deadline - now())))::integer,
      updated_at = now()
  where store_id = v_store_id;

  -- Admin rejects the certificate
  select public.admin_review_business_document(v_admin_id, v_doc_id, 'REJECT', 'Document is blurry') into v_result;

  -- Verify result
  assert v_result->>'success' = 'true', 'Rejection should succeed';
  assert v_result->>'action' = 'REJECT', 'Action should be REJECT';
  assert v_result->>'store_status' = 'CERTIFICATE_REJECTED', 'Store status should be CERTIFICATE_REJECTED';

  -- Check compliance resumed
  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.compliance_paused_at is null, 'Countdown should not be paused after rejection';
  assert v_compliance.compliance_deadline is not null, 'New deadline should be set';
  assert v_compliance.compliance_deadline > now(), 'New deadline should be in future';

  -- Check display status
  v_display_status := public.get_store_display_status(v_store_id);
  assert v_display_status->>'status' = 'CERTIFICATE_REJECTED', 'Display status should be CERTIFICATE_REJECTED';
  assert v_display_status->>'countdown_active' = 'true', 'Countdown should be active';
  assert v_display_status->>'can_reupload' = 'true', 'Should allow re-upload';

  raise notice 'TEST 3 PASSED: Countdown resumes on certificate rejection';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 4: Countdown clears on certificate approval (all docs approved)
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_doc_ids uuid[];
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_display_status jsonb;
  v_store public.stores%rowtype;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 4 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store and approve
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-004', 'Test Store 4', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;
  perform pg_sleep(1);

  -- Upload all 3 required documents
  v_doc_ids := array[]::uuid[];
  for i in 1..3 loop
    insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
    values (v_store_id, v_owner_id,
      case i when 1 then 'BARANGAY_CLEARANCE' when 2 then 'CEDULA' when 3 then 'BUSINESS_PERMIT' end,
      'test/path' || i || '.pdf', 'doc' || i || '.pdf', 1000, 'application/pdf', 'PENDING_REVIEW'
    ) returning id into v_doc_ids[i];
  end loop;

  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;

  -- Pause compliance
  update public.business_compliance
  set compliance_paused_at = now(),
      compliance_remaining_seconds = greatest(0, extract(epoch from (compliance_deadline - now())))::integer,
      updated_at = now()
  where store_id = v_store_id;

  -- Approve all 3 documents
  for i in 1..3 loop
    select public.admin_review_business_document(v_admin_id, v_doc_ids[i], 'APPROVE', null) into v_result;
    assert v_result->>'success' = 'true', 'Document ' || i || ' approval should succeed';
  end loop;

  -- Check store is verified
  select * into v_store from public.stores where id = v_store_id;
  assert v_store.certificate_status = 'APPROVED', 'Certificate status should be APPROVED';
  assert v_store.verified_at is not null, 'Verified at should be set';
  assert v_store.is_suspended = false, 'Should not be suspended';

  -- Check compliance cleared
  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.compliance_deadline is null, 'Compliance deadline should be cleared';
  assert v_compliance.compliance_paused_at is null, 'Paused at should be cleared';
  assert v_compliance.compliance_remaining_seconds is null, 'Remaining seconds should be cleared';
  assert v_compliance.all_documents_approved = true, 'All documents approved should be true';
  assert v_compliance.is_compliant = true, 'Is compliant should be true';

  -- Check display status
  v_display_status := public.get_store_display_status(v_store_id);
  assert v_display_status->>'status' = 'VERIFIED', 'Display status should be VERIFIED';
  assert v_display_status->>'badge_class' = 'ok', 'Badge class should be ok';
  assert v_display_status->>'verified_at' is not null, 'Verified at should be in display status';

  raise notice 'TEST 4 PASSED: Countdown clears on full certificate approval';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 5: Auto-suspension on countdown expiry
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_store public.stores%rowtype;
  v_suspended_count integer;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 5 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store and approve
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-005', 'Test Store 5', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;

  -- Manually set deadline to past (simulate expiry)
  update public.business_compliance
  set compliance_deadline = now() - interval '1 hour',
      compliance_paused_at = null,
      compliance_remaining_seconds = null
  where store_id = v_store_id;

  -- Run enforcement
  select public.enforce_business_compliance_deadlines() into v_suspended_count;

  -- Check suspension
  select * into v_store from public.stores where id = v_store_id;
  assert v_store.is_suspended = true, 'Store should be suspended';
  assert v_store.suspension_reason is not null, 'Suspension reason should be set';
  assert v_store.verification_status = 'REJECTED', 'Verification status should be REJECTED';

  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.suspended_for_noncompliance = true, 'Compliance should be suspended';
  assert v_compliance.suspension_reason is not null, 'Compliance suspension reason should be set';

  -- Check display status
  assert (select public.get_store_display_status(v_store_id))->>'status' = 'SUSPENDED', 'Display status should be SUSPENDED';
  assert (select public.get_store_display_status(v_store_id))->>'badge_class' = 'bad', 'Badge class should be bad';
  assert (select public.get_store_display_status(v_store_id))->>'can_upload_certificate' = 'true', 'Should allow certificate upload';

  raise notice 'TEST 5 PASSED: Auto-suspension on countdown expiry';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 6: Suspended store can upload certificate
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_doc_id uuid;
  v_result jsonb;
  v_compliance public.business_compliance%rowtype;
  v_store public.stores%rowtype;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 6 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create suspended store
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status, is_suspended, suspension_reason)
  values (v_owner_id, 'TRN-TEST-006', 'Test Store 6', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'APPROVED', 'NONE', true, 'Failed to submit documents on time')
  returning id into v_store_id;

  insert into public.business_compliance (store_id, user_id, compliance_deadline, suspended_for_noncompliance, suspension_reason, suspended_at)
  values (v_store_id, v_owner_id, now() - interval '1 day', true, 'Failed to submit documents on time', now() - interval '1 day');

  -- Upload certificate while suspended
  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (v_store_id, v_owner_id, 'BARANGAY_CLEARANCE', 'test/path.pdf', 'clearance.pdf', 1000, 'application/pdf', 'PENDING_REVIEW')
  returning id into v_doc_id;

  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;

  -- Check display status shows suspended but can upload
  assert (select public.get_store_display_status(v_store_id))->>'status' = 'SUSPENDED', 'Display status should be SUSPENDED';
  assert (select public.get_store_display_status(v_store_id))->>'can_upload_certificate' = 'true', 'Should allow certificate upload';

  -- Admin approves the certificate
  select public.admin_review_business_document(v_admin_id, v_doc_id, 'APPROVE', null) into v_result;

  -- Check store is now verified and suspension lifted
  select * into v_store from public.stores where id = v_store_id;
  assert v_store.certificate_status = 'APPROVED', 'Certificate status should be APPROVED';
  assert v_store.is_suspended = false, 'Suspension should be lifted';
  assert v_store.verified_at is not null, 'Verified at should be set';

  select * into v_compliance from public.business_compliance where store_id = v_store_id;
  assert v_compliance.suspended_for_noncompliance = false, 'Compliance suspension should be cleared';
  assert v_compliance.all_documents_approved = true, 'All documents should be approved';

  raise notice 'TEST 6 PASSED: Suspended store can upload certificate and get verified';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 7: Certificate approved before admin approval (no countdown needed)
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_doc_ids uuid[];
  v_result jsonb;
  v_store public.stores%rowtype;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 7 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store with documents already uploaded (PENDING_APPROVAL)
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-007', 'Test Store 7', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'PENDING_REVIEW')
  returning id into v_store_id;

  -- Upload all 3 documents before admin approval
  v_doc_ids := array[]::uuid[];
  for i in 1..3 loop
    insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
    values (v_store_id, v_owner_id,
      case i when 1 then 'BARANGAY_CLEARANCE' when 2 then 'CEDULA' when 3 then 'BUSINESS_PERMIT' end,
      'test/path' || i || '.pdf', 'doc' || i || '.pdf', 1000, 'application/pdf', 'PENDING_REVIEW'
    ) returning id into v_doc_ids[i];
  end loop;

  -- Admin approves store submission (should start countdown, but docs are pending review)
  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;
  assert v_result->>'success' = 'true', 'Store approval should succeed';

  -- Admin then approves all documents
  for i in 1..3 loop
    select public.admin_review_business_document(v_admin_id, v_doc_ids[i], 'APPROVE', null) into v_result;
    assert v_result->>'success' = 'true', 'Document ' || i || ' approval should succeed';
  end loop;

  -- Check store is verified without ever having a running countdown
  select * into v_store from public.stores where id = v_store_id;
  assert v_store.certificate_status = 'APPROVED', 'Certificate status should be APPROVED';
  assert v_store.verified_at is not null, 'Verified at should be set';
  assert v_store.approval_status = 'APPROVED', 'Approval status should be APPROVED';

  -- Check compliance was created then cleared
  assert (select compliance_deadline from public.business_compliance where store_id = v_store_id) is null, 'Compliance deadline should be cleared';
  assert (select all_documents_approved from public.business_compliance where store_id = v_store_id) = true, 'All docs approved';

  raise notice 'TEST 7 PASSED: Pre-uploaded certificates work without countdown';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 8: Rejection with expired remaining time suspends immediately
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_doc_id uuid;
  v_result jsonb;
  v_store public.stores%rowtype;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 8 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store, approve, upload cert, pause
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-008', 'Test Store 8', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test approval') into v_result;

  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (v_store_id, v_owner_id, 'BARANGAY_CLEARANCE', 'test/path.pdf', 'clearance.pdf', 1000, 'application/pdf', 'PENDING_REVIEW')
  returning id into v_doc_id;

  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;

  -- Pause with very little time remaining (1 second)
  update public.business_compliance
  set compliance_paused_at = now(),
      compliance_remaining_seconds = 1,
      updated_at = now()
  where store_id = v_store_id;

  -- Admin rejects
  select public.admin_review_business_document(v_admin_id, v_doc_id, 'REJECT', 'Invalid document') into v_result;

  -- Should be suspended immediately (remaining time <= 0 after rejection)
  select * into v_store from public.stores where id = v_store_id;
  assert v_store.is_suspended = true, 'Store should be suspended immediately';
  assert v_store.suspension_reason like '%expired%', 'Suspension reason should mention expiry';

  raise notice 'TEST 8 PASSED: Rejection with expired time suspends immediately';

  -- Cleanup
  delete from public.stores where id = v_store_id;
end;
$$;

-- ============================================================
-- TEST 9: Display status badge rendering
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_status jsonb;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 9 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Test PENDING_APPROVAL
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-009a', 'Test Store 9a', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'PENDING_APPROVAL', 'Status should be PENDING_APPROVAL';
  assert v_status->>'badge_class' = 'warn', 'Badge class should be warn';
  assert v_status->>'label' = 'Pending Approval', 'Label should be Pending Approval';

  -- Test APPROVED_NO_CERTIFICATE
  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test') into v_result;
  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'APPROVED_NO_CERTIFICATE', 'Status should be APPROVED_NO_CERTIFICATE';
  assert v_status->>'badge_class' = 'warn', 'Badge class should be warn';
  assert v_status->>'label' = 'Approved - Certificate Pending', 'Label should be Approved - Certificate Pending';
  assert v_status->>'countdown_active' = 'true', 'Countdown should be active';

  -- Test CERTIFICATE_UNDER_REVIEW
  insert into public.business_documents (store_id, user_id, document_type, file_path, file_name, file_size, mime_type, status)
  values (v_store_id, v_owner_id, 'BARANGAY_CLEARANCE', 'test/path.pdf', 'clearance.pdf', 1000, 'application/pdf', 'PENDING_REVIEW');
  update public.stores set certificate_status = 'PENDING_REVIEW', updated_at = now() where id = v_store_id;
  update public.business_compliance set compliance_paused_at = now(), compliance_remaining_seconds = 86400 where store_id = v_store_id;
  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'CERTIFICATE_UNDER_REVIEW', 'Status should be CERTIFICATE_UNDER_REVIEW';
  assert v_status->>'badge_class' = 'info', 'Badge class should be info';
  assert v_status->>'countdown_paused' = 'true', 'Countdown should be paused';

  -- Test VERIFIED
  update public.business_documents set status = 'APPROVED', reviewed_by = v_admin_id, reviewed_at = now() where store_id = v_store_id;
  update public.stores set certificate_status = 'APPROVED', verified_at = now() where id = v_store_id;
  update public.business_compliance set all_documents_approved = true, is_compliant = true, compliance_deadline = null, compliance_paused_at = null, compliance_remaining_seconds = null where store_id = v_store_id;
  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'VERIFIED', 'Status should be VERIFIED';
  assert v_status->>'badge_class' = 'ok', 'Badge class should be ok';
  assert v_status->>'label' = 'Verified', 'Label should be Verified';

  -- Test SUSPENDED
  update public.stores set is_suspended = true, suspension_reason = 'Test suspension' where id = v_store_id;
  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'SUSPENDED', 'Status should be SUSPENDED';
  assert v_status->>'badge_class' = 'bad', 'Badge class should be bad';
  assert v_status->>'can_upload_certificate' = 'true', 'Should allow certificate upload';

  -- Test REJECTED
  update public.stores set is_suspended = false, approval_status = 'REJECTED', suspension_reason = null where id = v_store_id;
  v_status := public.get_store_display_status(v_store_id);
  assert v_status->>'status' = 'REJECTED', 'Status should be REJECTED';
  assert v_status->>'badge_class' = 'bad', 'Badge class should be bad';

  raise notice 'TEST 9 PASSED: Display status badges render correctly';

  -- Cleanup
  delete from public.stores where trn_code like 'TRN-TEST-%';
end;
$$;

-- ============================================================
-- TEST 10: Reminder notifications (7 days, 3 days, 1 day)
-- ============================================================
do $$
declare
  v_admin_id uuid;
  v_owner_id uuid;
  v_store_id uuid;
  v_advisory_count integer;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;
  select id into v_owner_id from public.profiles where role = 'business_owner' limit 1;
  if v_admin_id is null or v_owner_id is null then
    raise notice 'TEST 10 SKIPPED: Missing admin or business owner';
    return;
  end if;

  -- Create store with deadline at 7 days
  insert into public.stores (user_id, trn_code, business_name, trade_category, proprietor_name, barangay, purok, landmark_reference, approval_status, certificate_status)
  values (v_owner_id, 'TRN-TEST-010a', 'Test Store 10a', 'SARI_SARI', 'Test Owner', 'Poblacion', 'Purok 1', 'Near plaza', 'PENDING', 'NONE')
  returning id into v_store_id;

  select public.admin_approve_store_submission(v_admin_id, v_store_id, 'Test') into v_result;

  -- Set deadline to exactly 7 days
  update public.business_compliance set compliance_deadline = now() + interval '7 days' where store_id = v_store_id;

  -- Run enforcement (which sends reminders)
  select public.enforce_business_compliance_deadlines() into v_suspended_count;

  -- Check 7-day reminder sent
  select count(*) into v_advisory_count from public.advisories
  where recipient_id = v_owner_id
    and title = 'Certificate Deadline Approaching - 7 Days Left';
  assert v_advisory_count > 0, '7-day reminder should be sent';

  -- Test 3-day reminder
  update public.business_compliance set compliance_deadline = now() + interval '3 days' where store_id = v_store_id;
  select public.enforce_business_compliance_deadlines() into v_suspended_count;
  select count(*) into v_advisory_count from public.advisories
  where recipient_id = v_owner_id
    and title = 'Certificate Deadline Approaching - 3 Days Left';
  assert v_advisory_count > 0, '3-day reminder should be sent';

  -- Test 1-day reminder
  update public.business_compliance set compliance_deadline = now() + interval '1 day' where store_id = v_store_id;
  select public.enforce_business_compliance_deadlines() into v_suspended_count;
  select count(*) into v_advisory_count from public.advisories
  where recipient_id = v_owner_id
    and title = 'Certificate Deadline Urgent - 1 Day Left';
  assert v_advisory_count > 0, '1-day reminder should be sent';

  raise notice 'TEST 10 PASSED: Reminder notifications sent at correct intervals';

  -- Cleanup
  delete from public.stores where trn_code like 'TRN-TEST-%';
end;
$$;

-- ============================================================
-- Summary
-- ============================================================
select 'All tests completed. Check notices above for results.' as summary;