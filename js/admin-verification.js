import { renderChrome, $, esc, CATS, PAY, badges } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';
import { BARANGAYS } from './ui.js';

const CERTIFICATE_TYPES = [
  { id: 'locational_clearance', label: 'Locational / Zoning Clearance' },
  { id: 'cedula', label: 'Community Tax Certificate (Cedula)' },
  { id: 'fire_safety', label: 'Fire Safety Inspection Certificate' },
  { id: 'sanitary_permit', label: 'Sanitary Permit' },
  { id: 'building_occupancy', label: 'Building Permit and Certificate of Occupancy' },
];

const modal = $('#store-modal');
const modalContent = $('#modal-content');
const storesList = $('#stores-list');
const noStores = $('#no-stores');
const statsContainer = $('#verification-stats');

let currentStores = [];
let currentFilter = { status: 'PENDING', barangay: '', search: '' };

async function init() {
  if (!isSupabaseConfigured()) return;

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const profile = await getCachedProfile(session.user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }

  renderChrome('admin-verification.html', session, profile);

  // Populate barangay filter
  const brgySelect = $('#filter-barangay');
  brgySelect.innerHTML = '<option value="">All barangays</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

  // Bind events
  $('#filter-status')?.addEventListener('change', (e) => { currentFilter.status = e.target.value; loadStores(); });
  $('#filter-barangay')?.addEventListener('change', (e) => { currentFilter.barangay = e.target.value; loadStores(); });
  $('#filter-search')?.addEventListener('input', debounce((e) => { currentFilter.search = e.target.value.toLowerCase(); loadStores(); }, 300));
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#notify-existing-sellers')?.addEventListener('click', notifyExistingSellers);
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
    query = query.eq('verification_status', currentFilter.status);
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
  const counts = { PENDING: 0, VERIFIED: 0, REJECTED: 0, CLARIFICATION_REQUIRED: 0 };
  stores.forEach(s => { if (counts[s.verification_status] !== undefined) counts[s.verification_status]++; });

  statsContainer.innerHTML = `
    <span class="pill warn" style="font-size:.9rem">Pending: ${counts.PENDING}</span>
    <span class="pill ok" style="font-size:.9rem">Store approved: ${counts.VERIFIED}</span>
    <span class="pill bad" style="font-size:.9rem">Rejected: ${counts.REJECTED}</span>
    <span class="pill info" style="font-size:.9rem">Clarification: ${counts.CLARIFICATION_REQUIRED}</span>
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

  storesList.innerHTML = stores.map(store => `
    <div class="card" style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <h3 style="margin:0 0 4px;font-size:1rem">${esc(store.business_name)}</h3>
          <span class="muted" style="font-size:.8rem">${store.trn_code}</span>
        </div>
        ${verificationBadge(store.verification_status)}
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${esc(CATS[store.trade_category] || store.trade_category)} • ${esc(store.barangay)}, ${esc(store.purok || '—')}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${esc(store.proprietor_name)} • ${esc(store.contact_number)}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${complianceSummary(store)}</p>
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

function complianceSummary(store) {
  if (store.compliance_suspended_at) return 'Account disabled: certificate deadline passed';
  if (store.compliance_approved_at) return 'Required certificates approved';
  if (!store.compliance_deadline_at) return '15-day notice not sent';
  const deadline = new Date(store.compliance_deadline_at).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Certificate deadline: ${deadline}`;
}

function verificationBadge(status) {
  const colors = { PENDING: 'warn', VERIFIED: 'ok', REJECTED: 'bad', CLARIFICATION_REQUIRED: 'info' };
  const labels = { PENDING: 'Pending', VERIFIED: 'Store approved', REJECTED: 'Rejected', CLARIFICATION_REQUIRED: 'Clarification' };
  return `<span class="pill ${colors[status] || 'warn'}">${labels[status] || status}</span>`;
}

async function openModal(storeId, canEdit = false) {
  const store = currentStores.find(s => s.id === storeId);
  if (!store) return;

  const { data: certifications, error: certificationError } = await supabase
    .from('store_certifications')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at');
  if (certificationError) {
    console.error('Load certification records error:', certificationError);
    alert(`Could not load certificates: ${certificationError.message}`);
    return;
  }

  for (const certification of certifications ?? []) {
    if (!certification.storage_path) continue;
    const { data, error } = await supabase.storage
      .from('seller-certifications')
      .createSignedUrl(certification.storage_path, 300);
    if (error) {
      console.error('Create certificate link error:', error);
      certification.fileError = 'Could not open this file';
    } else {
      certification.signedUrl = data.signedUrl;
    }
  }

  const payments = (store.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ') || '—';
  const storeBadges = badges(store);
  const statusLabels = {
    REQUESTED: 'Requested',
    PENDING: 'Under review',
    APPROVED: 'Approved',
    REJECTED: 'Replacement needed',
  };
  const statusClasses = { REQUESTED: 'warn', PENDING: 'info', APPROVED: 'ok', REJECTED: 'bad' };
  const existingTypes = new Set((certifications ?? []).map((certification) => certification.certificate_type));
  const missingCertificates = CERTIFICATE_TYPES.filter((certificate) => !existingTypes.has(certificate.id));
  const requiredCertifications = (certifications ?? []).filter((certification) => certification.required);
  const allRequiredApproved = requiredCertifications.length > 0
    && requiredCertifications.every((certification) => certification.review_status === 'APPROVED');
  const firstApprovedCertificationId = requiredCertifications.find(
    (certification) => certification.review_status === 'APPROVED',
  )?.id;
  const certificateReview = `
    <section style="border-top:1px solid var(--line);padding-top:20px">
      <h3 style="margin:0 0 12px">Business certificates</h3>
      ${(certifications ?? []).length ? certifications.map((certification) => {
        const label = CERTIFICATE_TYPES.find((item) => item.id === certification.certificate_type)?.label
          || certification.certificate_type;
        const fileLink = certification.signedUrl
          ? `<a href="${esc(certification.signedUrl)}" target="_blank" rel="noopener noreferrer">Open certificate</a>`
          : certification.storage_path
            ? `<span class="muted">${esc(certification.fileError || 'File unavailable')}</span>`
            : '<span class="muted">No file uploaded</span>';
        const finalizeApproval = canEdit
          && store.verification_status === 'VERIFIED'
          && !store.compliance_approved_at
          && allRequiredApproved
          && certification.id === firstApprovedCertificationId;
        const reviewButtons = canEdit && certification.storage_path
          && (certification.review_status !== 'APPROVED' || finalizeApproval)
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
               <button class="btn ok" type="button" data-cert-review="APPROVED" data-cert-id="${certification.id}">${finalizeApproval ? 'Finalize certificate approval' : 'Approve certificate'}</button>
               ${certification.review_status !== 'APPROVED' ? `<button class="btn bad" type="button" data-cert-review="REJECTED" data-cert-id="${certification.id}">Request replacement</button>` : ''}
             </div>`
          : '';
        const resendRequest = canEdit && certification.review_status === 'REQUESTED'
          ? `<button class="btn alt" type="button" data-cert-request="${certification.certificate_type}" data-cert-request-id="${certification.id}">Resend request</button>`
          : '';
        return `
          <div style="border:1px solid var(--line);border-radius:var(--r-lg);padding:16px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <strong>${esc(label)}${certification.required ? ' · Required' : ''}</strong>
              <span class="pill ${statusClasses[certification.review_status] || 'warn'}">${statusLabels[certification.review_status] || esc(certification.review_status)}</span>
            </div>
            <p style="margin:8px 0">${fileLink}</p>
            <label for="cert-notes-${certification.id}">Admin note</label>
            <textarea id="cert-notes-${certification.id}" data-cert-notes="${certification.id}" rows="2" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)">${esc(certification.admin_notes || '')}</textarea>
            ${reviewButtons}
            ${resendRequest}
          </div>
        `;
      }).join('') : '<p class="muted">No certificates have been submitted.</p>'}
      ${canEdit && missingCertificates.length ? `
        <div style="margin-top:16px">
          <label for="request-cert-type">Request a missing certificate</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <select id="request-cert-type" style="flex:1;min-width:220px">
              ${missingCertificates.map((certificate) => `<option value="${certificate.id}">${esc(certificate.label)}</option>`).join('')}
            </select>
            <button type="button" class="btn alt" id="request-cert-button">Send request</button>
          </div>
          <label for="request-cert-note" style="display:block;margin-top:8px">Note to seller (optional)</label>
          <textarea id="request-cert-note" rows="2" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)"></textarea>
        </div>
      ` : ''}
    </section>
  `;

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
      ${certificateReview}

      <!-- Images -->
      <div style="display:grid;grid-template-columns:1fr;gap:16px">
        <div>
          <strong>Storefront:</strong><br>
          ${store.storefront_image_url ? `<img src="${esc(store.storefront_image_url)}" alt="Storefront" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">` : '<span class="muted">Not provided</span>'}
        </div>
      </div>

      <!-- Verification Actions -->
      ${canEdit ? `
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Verification Action:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn ok" data-action="VERIFIED" data-id="${store.id}">Approve store</button>
            <button class="btn warn" data-action="CLARIFICATION_REQUIRED" data-id="${store.id}">Needs Clarification</button>
            <button class="btn bad" data-action="REJECTED" data-id="${store.id}">Reject</button>
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
    btn.addEventListener('click', () => updateVerification(btn.dataset.id, btn.dataset.action));
  });
  modalContent.querySelectorAll('[data-cert-review]').forEach((btn) => {
    btn.addEventListener('click', () => reviewCertificate(
      store.id,
      btn.dataset.certId,
      btn.dataset.certReview,
    ));
  });
  modalContent.querySelectorAll('[data-cert-request]').forEach((btn) => {
    btn.addEventListener('click', () => requestCertificate(
      store.id,
      btn.dataset.certRequest,
      $(`[data-cert-notes="${btn.dataset.certRequestId}"]`)?.value.trim() || '',
      btn,
    ));
  });
  $('#request-cert-button')?.addEventListener('click', () => requestCertificate(store.id));
}

async function getFunctionError(error) {
  if (error?.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === 'string') return body.error;
    } catch (responseError) {
      console.warn('Could not read certification function error:', responseError);
    }
  }
  return error?.message || 'Request failed';
}

async function reviewCertificate(storeId, certificationId, decision) {
  const notes = $(`[data-cert-notes="${certificationId}"]`)?.value.trim() || '';
  try {
    const { data, error } = await supabase.functions.invoke('manage-certifications', {
      body: { action: 'review', certificationId, decision, notes },
    });
    if (error) throw new Error(await getFunctionError(error));
    if (data?.success !== true) throw new Error(data?.error || 'Certificate review failed');

    await loadStores();
    await openModal(storeId, true);
  } catch (error) {
    console.error('Certificate review error:', error);
    alert(`Could not update certificate: ${error.message}`);
  }
}

async function requestCertificate(
  storeId,
  certificateType = $('#request-cert-type')?.value,
  notes = $('#request-cert-note')?.value.trim() || '',
  button = $('#request-cert-button'),
) {
  if (!certificateType) return;

  if (button) button.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke('manage-certifications', {
      body: { action: 'request', storeId, certificateType, notes },
    });
    if (error) throw new Error(await getFunctionError(error));
    if (data?.success !== true) throw new Error(data?.error || 'Certificate request failed');

    await loadStores();
    await openModal(storeId, true);
  } catch (error) {
    console.error('Request certificate error:', error);
    alert(`Could not request certificate: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function notifyExistingSellers(event) {
  const button = event.currentTarget;
  if (!confirm('Email current sellers who have not received a certificate deadline. Their 15-day period will start after their email is sent. Continue?')) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Sending...';
  try {
    const { data, error } = await supabase.functions.invoke('manage-certifications', {
      body: { action: 'notify_existing' },
    });
    if (error) throw new Error(await getFunctionError(error));
    if (data?.success !== true) throw new Error(data?.error || 'Seller notices could not be sent');
    alert(`Notified ${data.notified} seller(s). ${data.failed} notice(s) could not be sent.`);
    await loadStores();
  } catch (error) {
    console.error('Existing seller notification error:', error);
    alert(`Could not notify current sellers: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function updateVerification(storeId, newStatus) {
  const notes = $('#admin-notes')?.value || '';
  const btn = modalContent.querySelector(`[data-action="${newStatus}"]`);
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    const { error } = await supabase
      .from('stores')
      .update({ verification_status: newStatus, admin_notes: notes })
      .eq('id', storeId);

    if (error) throw error;

    closeModal();
    await loadStores();
  } catch (err) {
    console.error('Update error:', err);
    alert('Failed to update. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function closeModal() {
  modal.style.display = 'none';
}

init();