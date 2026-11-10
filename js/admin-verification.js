import { renderChrome, $, esc, CATS, PAY, badges } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
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
    <span class="pill ok" style="font-size:.9rem">Verified: ${counts.VERIFIED}</span>
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

function verificationBadge(status) {
  const colors = { PENDING: 'warn', VERIFIED: 'ok', REJECTED: 'bad', CLARIFICATION_REQUIRED: 'info' };
  const labels = { PENDING: 'Pending', VERIFIED: 'Verified', REJECTED: 'Rejected', CLARIFICATION_REQUIRED: 'Clarification' };
  return `<span class="pill ${colors[status] || 'warn'}">${labels[status] || status}</span>`;
}

function openModal(storeId, canEdit = false) {
  const store = currentStores.find(s => s.id === storeId);
  if (!store) return;

  const payments = (store.accepted_payments || []).map(p => PAY[p] || p).join(', ') || '—';
  const storeBadges = badges(store);

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

      <!-- Verification Actions -->
      ${canEdit ? `
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Verification Action:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn ok" data-action="VERIFIED" data-id="${store.id}">Approve (Verified)</button>
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