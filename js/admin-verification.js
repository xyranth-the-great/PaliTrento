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
  let query = supabase.from('stores').select('*');

  if (currentFilter.status !== 'ALL') {
    query = query.eq('approval_status', currentFilter.status);
  }
  if (currentFilter.certificate) {
    query = query.eq('certificate_status', currentFilter.certificate);
  }
  if (currentFilter.barangay) {
    query = query.eq('barangay', currentFilter.barangay);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Load stores error:', error);
    return;
  }

  // Client-side search filter
  let filtered = data || [];
  if (currentFilter.search) {
    filtered = filtered.filter(s =>
      s.business_name?.toLowerCase().includes(currentFilter.search) ||
      s.proprietor_name?.toLowerCase().includes(currentFilter.search) ||
      s.trn_code?.toLowerCase().includes(currentFilter.search)
    );
  }

  currentStores = filtered;
  renderStats(filtered);
  renderStores(filtered);
}

function renderStats(stores) {
  const approvalCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  const certCounts = { NONE: 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
  stores.forEach(s => {
    if (approvalCounts[s.approval_status] !== undefined) approvalCounts[s.approval_status]++;
    if (certCounts[s.certificate_status] !== undefined) certCounts[s.certificate_status]++;
  });

  statsContainer.innerHTML = `
    <span class="pill warn" style="font-size:.9rem">Pending: ${approvalCounts.PENDING}</span>
    <span class="pill ok" style="font-size:.9rem">Approved: ${approvalCounts.APPROVED}</span>
    <span class="pill bad" style="font-size:.9rem">Rejected: ${approvalCounts.REJECTED}</span>
    <span class="pill bad" style="font-size:.9rem">Suspended: ${approvalCounts.SUSPENDED}</span>
    <span class="pill info" style="font-size:.9rem">Cert Pending: ${certCounts.PENDING_REVIEW}</span>
    <span class="pill ok" style="font-size:.9rem">Cert Approved: ${certCounts.APPROVED}</span>
    <span class="pill bad" style="font-size:.9rem">Cert Rejected: ${certCounts.REJECTED}</span>
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
    // Get display status for consistent badge
    const displayStatus = {
      status: store.certificate_status === 'APPROVED' ? 'VERIFIED' : store.approval_status,
      badge_class: store.certificate_status === 'APPROVED' ? 'ok' :
                   store.approval_status === 'SUSPENDED' ? 'bad' :
                   store.certificate_status === 'REJECTED' ? 'bad' :
                   store.certificate_status === 'PENDING_REVIEW' ? 'info' :
                   store.approval_status === 'PENDING' ? 'warn' : 'warn',
      label: store.certificate_status === 'APPROVED' ? 'Verified' :
             store.approval_status === 'SUSPENDED' ? 'Suspended' :
             store.certificate_status === 'REJECTED' ? 'Cert Rejected' :
             store.certificate_status === 'PENDING_REVIEW' ? 'Cert Under Review' :
             store.approval_status === 'PENDING' ? 'Pending Approval' :
             store.approval_status === 'APPROVED' ? 'Approved - Cert Pending' :
             store.approval_status
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
        <span class="pill ${store.approval_status === 'PENDING' ? 'warn' : store.approval_status === 'APPROVED' ? 'ok' : store.approval_status === 'SUSPENDED' ? 'bad' : 'bad'}">${store.approval_status}</span>
        <span class="pill ${store.certificate_status === 'NONE' ? 'warn' : store.certificate_status === 'PENDING_REVIEW' ? 'info' : store.certificate_status === 'APPROVED' ? 'ok' : 'bad'}">${store.certificate_status}</span>
      </p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(store.created_at).toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'})}</p>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:.85rem;padding:8px 12px" data-review="${store.id}">Review</button>
        <button class="btn alt" style="flex:1;font-size:.85rem;padding:8px 12px" data-view="${store.id}">View</button>
      </div>
    </div>
  `).join('');

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

  // Load documents for this store
  const { data: documents } = await supabase
    .from('business_documents')
    .select('*')
    .eq('store_id', storeId)
    .order('submitted_at', { ascending: false });

  const requiredDocs = [
    { type: 'BARANGAY_CLEARANCE', label: 'Barangay Business Clearance' },
    { type: 'CEDULA', label: 'Community Tax Certificate (Cedula)' },
    { type: 'BUSINESS_PERMIT', label: 'Business Permit' }
  ];

  const docsHtml = requiredDocs.map(req => {
    const doc = documents?.find(d => d.document_type === req.type);
    let statusHtml = '';
    let actionHtml = '';

    if (!doc) {
      statusHtml = '<span class="pill bad">Not Submitted</span>';
      actionHtml = '<span class="muted">Waiting for upload</span>';
    } else if (doc.status === 'APPROVED') {
      statusHtml = '<span class="pill ok">Approved</span>';
      actionHtml = `<a href="#" class="btn alt" onclick="viewDocument('${doc.file_path}');return false;">View</a>`;
    } else if (doc.status === 'PENDING_REVIEW') {
      statusHtml = '<span class="pill info">Pending Review</span>';
      actionHtml = `<span class="muted">Submitted ${new Date(doc.submitted_at).toLocaleDateString('en-PH')}</span>`;
    } else if (doc.status === 'REJECTED') {
      statusHtml = '<span class="pill bad">Rejected</span>';
      actionHtml = `
        <span class="muted" style="font-size:.75rem">${doc.rejection_reason || 'No reason provided'}</span>
      `;
    }

    return `
      <div class="card" style="padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px">
          <div style="flex:1;min-width:200px">
            <strong>${req.label}</strong>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${statusHtml}
            ${actionHtml}
            ${(doc?.status === 'PENDING_REVIEW' || doc?.status === 'REJECTED') && canEdit ? `
              <button class="btn ok" style="margin-left:8px;padding:4px 8px;font-size:.75rem" data-doc-approve="${doc.id}">Approve</button>
              <button class="btn warn" style="padding:4px 8px;font-size:.75rem" data-doc-reject="${doc.id}">Reject</button>
            ` : ''}
          </div>
        </div>
        ${doc && doc.status !== 'APPROVED' ? `
          <div style="padding-top:8px;border-top:1px solid var(--line);font-size:.75rem;color:var(--muted)">
            ${doc.submitted_at ? `Submitted: ${new Date(doc.submitted_at).toLocaleString('en-PH')}` : ''}
            ${doc.reviewed_at ? ` · Reviewed: ${new Date(doc.reviewed_at).toLocaleString('en-PH')}` : ''}
            ${doc.file_name ? ` · File: ${doc.file_name}` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

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

      <!-- Images -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <strong>Storefront:</strong><br>
          ${store.storefront_image_url ? `<img src="${esc(store.storefront_image_url)}" alt="Storefront" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">` : '<span class="muted">Not provided</span>'}
        </div>
        <div>
          <strong>Permits:</strong><br>
          ${store.permits_image_url ? `<img src="${esc(store.permits_image_url)}" alt="Permits" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">` : '<span class="muted">Not provided</span>'}
        </div>
      </div>

      <!-- Store Approval Action -->
      ${canEdit ? `
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Store Approval:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">
            ${store.approval_status === 'PENDING' ? `
              <button class="btn ok" data-action="approve_store" data-id="${store.id}">Approve Store (Starts 15-day Cert Countdown)</button>
              <button class="btn warn" data-action="clarification" data-id="${store.id}">Needs Clarification</button>
              <button class="btn bad" data-action="reject_store" data-id="${store.id}">Reject Store</button>
            ` : store.approval_status === 'APPROVED' ? `
              <span class="pill ok">Store Approved</span>
              <span class="pill ${store.certificate_status === 'NONE' ? 'warn' : store.certificate_status === 'PENDING_REVIEW' ? 'info' : store.certificate_status === 'APPROVED' ? 'ok' : 'bad'}">
                Certificate: ${store.certificate_status}
              </span>
            ` : store.approval_status === 'SUSPENDED' ? `
              <span class="pill bad">Store Suspended</span>
              <button class="btn ok" data-action="restore_store" data-id="${store.id}">Restore Store</button>
            ` : `
              <span class="pill bad">Store Rejected</span>
              <button class="btn ok" data-action="approve_store" data-id="${store.id}">Approve Store</button>
            `}
          </div>
          <div style="margin-top:12px">
            <label for="admin-notes">Notes (sent to owner)</label>
            <textarea id="admin-notes" rows="3" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)"></textarea>
          </div>
        </div>
      ` : ''}

      <!-- Certificate Review Queue -->
      <div style="border-top:1px solid var(--line);padding-top:20px">
        <strong>Business Documents:</strong>
        <div style="margin-top:12px">${docsHtml}</div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  // Bind action buttons
  modalContent.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleStoreAction(btn.dataset.id, btn.dataset.action));
  });
  modalContent.querySelectorAll('[data-doc-approve]').forEach(btn => {
    btn.addEventListener('click', () => handleDocumentAction(btn.dataset.docApprove, 'APPROVE'));
  });
  modalContent.querySelectorAll('[data-doc-reject]').forEach(btn => {
    btn.addEventListener('click', () => handleDocumentAction(btn.dataset.docReject, 'REJECT'));
  });
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
      alert('Store approved! 15-day certificate compliance countdown started.');
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
      const { error } = await supabase
        .from('stores')
        .update({ approval_status: 'APPROVED', is_suspended: false, suspension_reason: null, updated_at: new Date().toISOString() })
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

async function handleDocumentAction(documentId, action) {
  const btn = modalContent.querySelector(`[data-doc-${action.toLowerCase()}="${documentId}"]`);
  const originalText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  let rejectionReason = null;
  if (action === 'REJECT') {
    rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
      return;
    }
  }

  try {
    const { data, error } = await supabase.rpc('admin_review_business_document', {
      p_actor_id: (await supabase.auth.getUser()).data.user.id,
      p_document_id: documentId,
      p_action: action,
      p_rejection_reason: rejectionReason
    });
    if (error) throw error;

    const result = data;
    alert(`Document ${action.toLowerCase()}d. Store status: ${result.store_status}`);
    closeModal();
    await loadStores();
  } catch (err) {
    console.error('Document action error:', err);
    alert('Failed to update: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

function closeModal() {
  modal.style.display = 'none';
}

init();