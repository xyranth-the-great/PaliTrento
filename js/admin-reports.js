import { renderChrome, $, esc, CATS, BARANGAYS } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

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

  renderChrome('admin-reports.html', session, profile);

  await loadReports();
}

async function loadReports() {
  // Load stores
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('verification_status, trade_category, barangay');

  if (storesError) {
    console.error('Stores error:', storesError);
    return;
  }

  // Load products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('lgu_srp_ceiling, current_price');

  if (productsError) {
    console.error('Products error:', productsError);
  }

  // Load orders count (if orders table exists)
  let ordersCount = 0;
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    if (!error) ordersCount = count || 0;
  } catch {
    // orders table might not exist yet
  }

  renderOverview(stores || [], products || [], ordersCount);
  renderCategoryBreakdown(stores || []);
  renderBarangayBreakdown(stores || []);
  renderCompliance(products || []);
}

function renderOverview(stores, products, ordersCount) {
  const verified = stores.filter(s => s.verification_status === 'VERIFIED').length;
  $('#r-total-stores').textContent = stores.length;
  $('#r-verified-stores').textContent = verified;
  $('#r-total-products').textContent = products.length;
  $('#r-total-orders').textContent = ordersCount;
}

function renderCategoryBreakdown(stores) {
  const container = $('#category-breakdown');
  const counts = {};
  stores.forEach(s => { counts[s.trade_category] = (counts[s.trade_category] || 0) + 1; });

  container.innerHTML = Object.entries(counts).map(([cat, count]) => `
    <div class="card" style="padding:16px;text-align:center">
      <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${count}</div>
      <div class="muted" style="font-size:.8rem">${esc(CATS[cat] || cat)}</div>
    </div>
  `).join('');
}

function renderBarangayBreakdown(stores) {
  const container = $('#barangay-breakdown');
  const counts = {};
  stores.forEach(s => { counts[s.barangay] = (counts[s.barangay] || 0) + 1; });

  container.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([brgy, count]) => `
      <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center">
        <span class="muted" style="font-size:.85rem">${esc(brgy)}</span>
        <span style="font-weight:700;color:var(--primary)">${count}</span>
      </div>
    `).join('');
}

function renderCompliance(products) {
  let within = 0, over = 0, noCap = 0;
  products.forEach(p => {
    if (p.lgu_srp_ceiling == null) noCap++;
    else if (p.current_price <= p.lgu_srp_ceiling) within++;
    else over++;
  });
  $('#r-within-cap').textContent = within;
  $('#r-over-cap').textContent = over;
  $('#r-no-cap').textContent = noCap;
}

init();