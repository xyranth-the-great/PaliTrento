import { renderChrome, $, esc, CATS, PAY, badges, getStoreStatusBadge } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';
import { BARANGAYS } from './ui.js';

const modal = $('#store-modal');
const modalContent = $('#modal-content');
const storesList = $('#stores-list');
const noStores = $('#no-stores');
const statsContainer = $('#verification-stats');

let currentStores = [];
let currentFilter = { status: 'PENDING', barangay: '', search: '' };
const STORE_PERMITS = [
  { type: 'BARANGAY_CLEARANCE', column: 'barangay_clearance_image_url', statusColumn: 'barangay_clearance_status', reviewNoteColumn: 'barangay_clearance_review_note', label: 'Barangay Business Clearance' },
  { type: 'CEDULA', column: 'cedula_image_url', statusColumn: 'cedula_status', reviewNoteColumn: 'cedula_review_note', label: 'Community Tax Certificate (Cedula)' },
  { type: 'BUSINESS_PERMIT', column: 'business_permit_image_url', statusColumn: 'business_permit_status', reviewNoteColumn: 'business_permit_review_note', label: 'Business Permit' }
];

async function init() {
  if (!isSupabaseConfigured()) return;

  // Check for auth error params from Supabase redirect
  const authErrorRedirect = checkAuthErrorParams();
  if (authErrorRedirect) {
    window.location.replace(authErrorRedirect);
    return;
  }

  const { session, profile, redirectUrl } = await getSessionWithStatus();
  if (redirectUrl) {
    window.location.replace(redirectUrl);
    return;
  }
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin-verification/', session, profile);

  // Populate barangay filter
  const brgySelect = $('#filter-barangay');
  brgySelect.innerHTML = '<option value="">All barangays</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

  // Add certificate filter
  const certFilter = $('#filter-certificate');
  if (certFilter) {
    certFilter.innerHTML = '<option value="">All</option><option value="NONE">No Certificate</option><option value="PENDING_REVIEW">Pending Review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>';
    certFilter.addEventListener('change', (e) => { currentFilter.certificate = e.target.value; loadStores(); });
  }

  // Bind events
  $('#filter-status')?.addEventListener('change', (e) => { currentFilter.status = e.target.value; loadStores(); });
  $('#filter-barangay')?.addEventListener('change', (e) => { currentFilter.barangay = e.target.value; loadStores(); });
  $('#filter-search')?.addEventListener('input', debounce((e) => { currentFilter.search = e.target.value.toLowerCase(); loadStores(); }, 300));
  $('#modal-close')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  await loadStores();
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load stores error:', error);
    return;
  }

  const allStores = data || [];
  let filtered = allStores;

  if (currentFilter.status === 'SUSPENDED') {
    filtered = filtered.filter(store => store.is_suspended === true);
  } else if (currentFilter.status !== 'ALL') {
    filtered = filtered.filter(store =>
      store.approval_status === currentFilter.status && store.is_suspended !== true
    );
  }
  if (currentFilter.certificate) {
    filtered = filtered.filter(store => store.certificate_status === currentFilter.certificate);
  }
  if (currentFilter.barangay) {
    filtered = filtered.filter(store => store.barangay === currentFilter.barangay);
  }

  // Search and status filters shape the result list; summary pills stay global.
  if (currentFilter.search) {
    filtered = filtered.filter(s =>
      s.business_name?.toLowerCase().includes(currentFilter.search) ||
      s.proprietor_name?.toLowerCase().includes(currentFilter.search) ||
      s.trn_code?.toLowerCase().includes(currentFilter.search)
    );
  }

  currentStores = filtered;
  renderStats(allStores);
  renderStores(filtered);
}

function renderStats(stores) {
  const approvalCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  let permitsApproved = 0;
  stores.forEach(s => {
    const approvalStatus = s.is_suspended ? 'SUSPENDED' : s.approval_status;
    if (approvalCounts[approvalStatus] !== undefined) approvalCounts[approvalStatus]++;
    if (s.certificate_status === 'APPROVED') permitsApproved++;
  });

  statsContainer.innerHTML = `
    <span class="pill warn" style="font-size:.9rem">Pending: ${approvalCounts.PENDING}</span>
    <span class="pill ok" style="font-size:.9rem">Approved: ${approvalCounts.APPROVED}</span>
    <span class="pill bad" style="font-size:.9rem">Rejected: ${approvalCounts.REJECTED}</span>
    <span class="pill bad" style="font-size:.9rem">Suspended: ${approvalCounts.SUSPENDED}</span>
    <span class="pill info" style="font-size:.9rem">Permits approved: ${permitsApproved}</span>
    <span class="pill" style="font-size:.9rem;background:var(--muted-bg);color:var(--muted)">Total: ${stores.length}</span>
  `;
}

function renderStores(stores) {
  if (stores.length === 0) {
    storesList.style.display = 'none';
    noStores.style.display = 'block';
    return;
  }

  noStores.style.display = 'none';
  storesList.style.display = 'grid';

  storesList.innerHTML = stores.map(store => {
    const isVerified = store.certificate_status === 'APPROVED'
      && store.approval_status === 'APPROVED'
      && !store.is_suspended;
    const displayStatus = {
      status: store.is_suspended ? 'SUSPENDED' : isVerified ? 'VERIFIED' : store.approval_status,
      badge_class: store.is_suspended || store.approval_status === 'REJECTED' ? 'bad' :
                   isVerified ? 'ok' : store.approval_status === 'PENDING' ? 'warn' : 'info',
      label: store.is_suspended ? 'Suspended' : isVerified ? 'Verified' :
             store.approval_status === 'PENDING' ? 'Pending Approval' : store.approval_status
    };
    const statusBadge = getStoreStatusBadge(displayStatus);

    return `
    <div class="card" style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <h3 style="margin:0 0 4px;font-size:1rem">${esc(store.business_name)}</h3>
          <span class="muted" style="font-size:.8rem">${store.trn_code}</span>
        </div>
        ${statusBadge}
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${esc(CATS[store.trade_category] || store.trade_category)} • ${esc(store.barangay)}, ${esc(store.purok || '—')}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${esc(store.proprietor_name)} • ${esc(store.contact_number)}</p>
      <p class="muted" style="margin:0 0 4px;font-size:.75rem">
        <span class="pill ${store.is_suspended || store.approval_status === 'REJECTED' ? 'bad' : store.approval_status === 'APPROVED' ? 'ok' : 'warn'}">${store.is_suspended ? 'SUSPENDED' : store.approval_status}</span>
        <span class="pill ${store.certificate_status === 'APPROVED' ? 'ok' : 'info'}">Permits: ${store.certificate_status === 'APPROVED' ? 'Approved' : 'Awaiting review'}</span>
      </p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(store.created_at).toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'})}</p>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:.85rem;padding:8px 12px" data-review="${store.id}">Review</button>
        <button class="btn alt" style="flex:1;font-size:.85rem;padding:8px 12px" data-view="${store.id}">View</button>
      </div>
    </div>
  `;
}).join('');

  storesList.querySelectorAll('[data-review]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.review, true));
  });
  storesList.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.view, false));
  });
}

async function openModal(storeId, canEdit = false) {
  const store = currentStores.find(s => s.id === storeId);
  if (!store) return;

  const payments = (store.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ') || '—';
  const storeBadges = badges(store);
  const hasRequiredPermits = [
    store.barangay_clearance_image_url,
    store.cedula_image_url,
    store.business_permit_image_url
  ].every(url => typeof url === 'string' && url.trim());
  const allPermitsApproved = STORE_PERMITS.every(permit => store[permit.statusColumn] === 'APPROVED');

  modalContent.innerHTML = `
    <div style="display:grid;gap:20px">
      <!-- Basic Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><strong>Business name:</strong> ${esc(store.business_name)}</div>
        <div><strong>TRN Code:</strong> ${esc(store.trn_code)}</div>
        <div><strong>Category:</strong> ${esc(CATS[store.trade_category] || store.trade_category)}</div>
        <div><strong>Proprietor:</strong> ${esc(store.proprietor_name)}</div>
        <div><strong>Contact:</strong> ${esc(store.contact_number)}</div>
        <div><strong>Barangay:</strong> ${esc(store.barangay)}, ${esc(store.purok || '—')}</div>
        <div><strong>Landmark:</strong> ${esc(store.landmark_reference)}</div>
        <div><strong>Coordinates:</strong> ${store.lat}, ${store.lng}</div>
        <div><strong>Hours:</strong> ${store.open_time} – ${store.close_time}</div>
        <div><strong>Payments:</strong> ${esc(payments)}</div>
      </div>

      ${storeBadges ? `<div>${storeBadges}</div>` : ''}

      <div>
        <strong>Storefront:</strong><br>
        ${store.storefront_image_url ? `<img src="${esc(store.storefront_image_url)}" alt="Storefront" style="max-width:100%;max-height:360px;border-radius:var(--r-lg);margin-top:8px">` : '<span class="muted">Not provided</span>'}
      </div>

      <section aria-labelledby="permit-review-heading" style="border-top:1px solid var(--line);padding-top:20px">
        <h4 id="permit-review-heading" style="margin:0 0 12px">Permit Review</h4>
        <div style="display:grid;gap:12px">
          ${STORE_PERMITS.map(permit => {
            const url = store[permit.column];
            const status = store[permit.statusColumn] || 'PENDING';
            const statusClass = status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'bad' : 'warn';
            return `
              <div class="card" style="padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                  <strong>${permit.label}</strong>
                  <span class="pill ${statusClass}">${url ? status : 'Missing'}</span>
                </div>
                ${url
                  ? `<a class="btn alt" href="${esc(url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px">View submitted permit</a>`
                  : '<p class="muted" style="margin:12px 0 0">No permit was submitted for this requirement.</p>'}
                ${store[permit.reviewNoteColumn]
                  ? `<p class="muted" style="margin:12px 0 0"><strong>Review note:</strong> ${esc(store[permit.reviewNoteColumn])}</p>`
                  : ''}
                ${url && store.approval_status !== 'APPROVED' ? `
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
                    <button class="btn ok" type="button" data-permit-review="APPROVE" data-permit-type="${permit.type}" data-store-id="${store.id}" ${status === 'APPROVED' ? 'disabled' : ''}>Approve permit</button>
                    <button class="btn bad" type="button" data-permit-review="REJECT" data-permit-type="${permit.type}" data-store-id="${store.id}" ${status === 'REJECTED' ? 'disabled' : ''}>Reject permit</button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
        ${hasRequiredPermits && !allPermitsApproved
          ? '<p class="muted" style="margin:12px 0 0">Approve each submitted permit before approving the store.</p>'
          : ''}
      </section>

      <!-- Store Approval Action -->
      ${canEdit ? `
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Store Approval:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">
            ${store.is_suspended ? `
              <span class="pill bad">Store Suspended</span>
              <button class="btn ok" data-action="restore_store" data-id="${store.id}">Restore Store</button>
            ` : store.approval_status === 'PENDING' ? `
              <button class="btn ok" data-action="approve_store" data-id="${store.id}" ${hasRequiredPermits && allPermitsApproved ? '' : 'disabled'}>Approve Store</button>
              ${hasRequiredPermits ? '' : '<span class="pill bad">Missing required permits. The owner must submit all three before approval.</span>'}
              ${hasRequiredPermits && !allPermitsApproved ? '<span class="pill warn">Approve each permit above first.</span>' : ''}
              <button class="btn warn" data-action="clarification" data-id="${store.id}">Needs Clarification</button>
              <button class="btn bad" data-action="reject_store" data-id="${store.id}">Reject Store</button>
            ` : store.approval_status === 'APPROVED' ? `
              <span class="pill ok">Store Approved</span>
              <span class="pill ok">All permits approved</span>
            ` : `
              <span class="pill bad">Store Rejected</span>
              <button class="btn ok" data-action="approve_store" data-id="${store.id}" ${hasRequiredPermits && allPermitsApproved ? '' : 'disabled'}>Approve Store</button>
              ${hasRequiredPermits ? '' : '<span class="pill bad">Missing required permits. The owner must submit all three before approval.</span>'}
              ${hasRequiredPermits && !allPermitsApproved ? '<span class="pill warn">Approve each permit above first.</span>' : ''}
            `}
          </div>
          <div style="margin-top:12px">
            <label for="admin-notes">Notes (sent to owner)</label>
            <textarea id="admin-notes" rows="3" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)"></textarea>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  modal.style.display = 'flex';

  // Bind action buttons
  modalContent.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleStoreAction(btn.dataset.id, btn.dataset.action));
  });
  modalContent.querySelectorAll('[data-permit-review]').forEach(btn => {
    btn.addEventListener('click', () => handlePermitReview(
      btn.dataset.storeId,
      btn.dataset.permitType,
      btn.dataset.permitReview,
      btn
    ));
  });
}

async function handlePermitReview(storeId, permitType, action, btn) {
  const reviewNote = action === 'REJECT'
    ? prompt('Enter a reason for rejecting this permit:')
    : null;
  if (action === 'REJECT' && !reviewNote?.trim()) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('You must be signed in to review permits.');

    const { error } = await supabase.rpc('admin_review_store_permit', {
      p_actor_id: userData.user.id,
      p_store_id: storeId,
      p_permit_type: permitType,
      p_action: action,
      p_review_note: reviewNote
    });
    if (error) throw error;

    const { data: updatedStore, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    if (storeError) throw storeError;

    currentStores = [...currentStores.filter(store => store.id !== storeId), updatedStore];
    await openModal(storeId, true);
    await loadStores();
  } catch (err) {
    console.error('Permit review error:', err);
    alert('Failed to update permit: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleStoreAction(storeId, action) {
  const notes = $('#admin-notes')?.value || '';
  const btn = modalContent.querySelector(`[data-action="${action}"]`);
  const originalText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  try {
    if (action === 'approve_store') {
      const { data, error } = await supabase.rpc('admin_approve_store_submission', {
        p_actor_id: (await supabase.auth.getUser()).data.user.id,
        p_store_id: storeId,
        p_admin_notes: notes
      });
      if (error) throw error;
      alert('Store approved. All required permits are verified.');
    } else if (action === 'clarification') {
      const { error } = await supabase
        .from('stores')
        .update({ approval_status: 'PENDING', admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', storeId);
      if (error) throw error;
      alert('Store marked as needing clarification.');
    } else if (action === 'reject_store') {
      const { error } = await supabase
        .from('stores')
        .update({ approval_status: 'REJECTED', admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', storeId);
      if (error) throw error;
      alert('Store rejected.');
    } else if (action === 'restore_store') {
      const store = currentStores.find(s => s.id === storeId);
      const canRestoreAsVerified = store?.certificate_status === 'APPROVED'
        && [
          store.barangay_clearance_image_url,
          store.cedula_image_url,
          store.business_permit_image_url
        ].every(url => typeof url === 'string' && url.trim());
      const { error } = await supabase
        .from('stores')
        .update({
          approval_status: canRestoreAsVerified ? 'APPROVED' : 'PENDING',
          verification_status: canRestoreAsVerified ? 'VERIFIED' : 'PENDING',
          is_suspended: false,
          suspension_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);
      if (error) throw error;
      alert('Store restored.');
    }

    closeModal();
    await loadStores();
  } catch (err) {
    console.error('Update error:', err);
    alert('Failed to update: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

function closeModal() {
  modal.style.display = 'none';
}

init();
