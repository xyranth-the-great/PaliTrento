import { renderChrome, $, esc, CATS, PAY, peso, badges } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

async function init() {
  if (!isSupabaseConfigured()) return;

  const session = await getSession();
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  const profile = await getCachedProfile(session.user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin/', session, profile);

  await loadStats();
  await loadRecentPending();
}

async function loadStats() {
  const { data: stores, error } = await supabase
    .from('stores')
    .select('verification_status');

  if (error || !stores) return;

  const counts = {
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    CLARIFICATION_REQUIRED: 0,
  };

  stores.forEach(s => {
    if (counts[s.verification_status] !== undefined) counts[s.verification_status]++;
  });

  $('#stat-pending').textContent = counts.PENDING;
  $('#stat-verified').textContent = counts.VERIFIED;
  $('#stat-rejected').textContent = counts.REJECTED + counts.CLARIFICATION_REQUIRED;
  $('#stat-total-stores').textContent = stores.length;
}

async function loadRecentPending() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('verification_status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error || !data || data.length === 0) {
    $('#no-pending').style.display = 'block';
    return;
  }

  const container = $('#recent-pending');
  container.style.display = 'grid';
  container.innerHTML = data.map(store => `
    <div class="card" style="display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h3 style="margin:0;font-size:1rem">${esc(store.business_name)}</h3>
        <span class="pill warn">Pending</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${esc(CATS[store.trade_category] || store.trade_category)} • ${esc(store.barangay)}, ${esc(store.purok || '—')}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${esc(store.proprietor_name)} • ${esc(store.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(store.created_at).toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'})}</p>
      <a href="/admin-verification/?trn=${encodeURIComponent(store.trn_code)}" class="btn" style="width:100%;text-align:center;font-size:.85rem;padding:8px 12px">Review</a>
    </div>
  `).join('');
}

init();