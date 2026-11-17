import { renderChrome, $, esc, CATS, PAY, peso, badges, startAdvisoryToastListener } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

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

  renderChrome('/admin/', session, profile);

  // Start advisory toast listener
  startAdvisoryToastListener();

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

  const emptyState = $('#no-pending');
  if (error) {
    console.error('Load recent pending stores error:', error);
    emptyState.textContent = 'Could not load submitted stores. Open the verification queue to retry.';
    emptyState.style.display = 'block';
    return;
  }

  if (!data || data.length === 0) {
    emptyState.textContent = 'No stores are waiting for verification.';
    emptyState.style.display = 'block';
    return;
  }

  const container = $('#recent-pending');
  emptyState.style.display = 'none';
  container.innerHTML = data.map(store => `
    <article class="pending-store">
      <div class="pending-store-heading">
        <h3 style="margin:0;font-size:1rem">${esc(store.business_name)}</h3>
        <span class="pill warn">Pending</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${esc(CATS[store.trade_category] || store.trade_category)} • ${esc(store.barangay)}, ${esc(store.purok || '—')}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${esc(store.proprietor_name)} • ${esc(store.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(store.created_at).toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'})}</p>
      <a href="/admin-verification/?trn=${encodeURIComponent(store.trn_code)}" class="btn">Review store</a>
    </article>
  `).join('');
}

init();
