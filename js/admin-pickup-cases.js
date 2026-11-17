import { renderChrome, $, esc } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams, isSupabaseConfigured } from './auth.js';
import { supabase } from './supabase.js';

const dateTime = value => value
  ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

async function init() {
  if (!isSupabaseConfigured()) return;

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

  renderChrome('/admin-pickup-cases/', session, profile);
  $('#pickup-cases-refresh').addEventListener('click', loadCases);
  await loadCases();
}

async function loadCases() {
  const message = $('#pickup-cases-message');
  const rows = $('#pickup-cases-rows');
  message.style.display = 'none';
  rows.innerHTML = '<tr><td colspan="7" class="muted">Loading records…</td></tr>';

  const { data, error } = await supabase
    .from('pickup_no_show_cases')
    .select('id,order_id,customer_id,customer_name,store_id,store_name,product_name,quantity,ready_at,expired_at,reason,created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Load pickup no-show records error:', error);
    rows.replaceChildren();
    $('#pickup-cases-count').textContent = 'Records unavailable';
    message.textContent = error.code === '42P01' || error.code === 'PGRST205'
      ? 'Pickup records are not installed yet. Apply supabase/migrations/009_pickup_no_show_cases.sql.'
      : `Could not load records. ${error.message || 'Please retry.'}`;
    message.style.display = 'block';
    return;
  }

  const cases = data || [];
  $('#pickup-cases-count').textContent = `${cases.length} no-show record${cases.length === 1 ? '' : 's'}`;
  if (!cases.length) {
    rows.replaceChildren();
    message.textContent = 'No pickup no-show records yet.';
    message.style.display = 'block';
    return;
  }

  rows.innerHTML = cases.map(item => `
    <tr>
      <td><strong>${esc(item.customer_name || 'Customer')}</strong></td>
      <td>${esc(item.store_name || 'Store')}</td>
      <td>${esc(item.product_name || 'Product')}<div class="muted" style="font-size:.8rem">Quantity: ${esc(item.quantity)}</div></td>
      <td>${esc(dateTime(item.ready_at))}</td>
      <td>${esc(dateTime(item.expired_at))}<div class="muted" style="font-size:.8rem;max-width:260px">${esc(item.reason)}</div></td>
      <td><code>${esc(item.order_id.slice(0, 8))}</code></td>
      <td>${item.customer_id
        ? `<a class="btn alt" style="padding:6px 10px;font-size:.8rem" href="/admin-accounts/?userId=${encodeURIComponent(item.customer_id)}">Review account</a>`
        : '<span class="muted">Account unavailable</span>'}</td>
    </tr>`).join('');
}

init();
