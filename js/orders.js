import { renderChrome, $, esc, peso } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getLoginUnavailableMessage } from './auth.js';

const container = $('#orders-history');
const msgEl = $('#orders-message');

let currentSession = null;
let currentOrders = [];

async function loadOrders() {
  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage(), 'warn');
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  currentSession = session;

  const profile = await getCachedProfile(session.user.id);
  renderChrome('/orders/', session, profile);

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        products (name, unit, current_price),
        stores (business_name, trn_code, barangay)
      `)
      .eq('buyer_id', currentSession.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('Customer orders loaded:', orders?.length);
    currentOrders = orders || [];
    renderOrders();
  } catch (err) {
    console.error('Load orders error:', err);
    showMsg('Failed to load orders. Please try again.', 'bad');
  }

  $('#orders-content').style.display = 'block';
}

function renderOrders() {
  if (!container) return;

  if (currentOrders.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="/products/">Start shopping</a></p>';
    return;
  }

  const statusColors = {
    PENDING: 'warn',
    CONFIRMED: 'info',
    READY_FOR_PICKUP: 'ok',
    COMPLETED: 'ok',
    CANCELLED: 'bad'
  };
  const statusLabels = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  };

  container.innerHTML = currentOrders.map(o => {
    const product = o.products;
    const store = o.stores;
    const color = statusColors[o.status] || 'warn';
    const label = statusLabels[o.status] || o.status;

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${esc(product?.name || 'Product')}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${esc(store?.business_name || 'Store')} • ${esc(store?.barangay || '')}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${o.quantity} × ${peso(product?.current_price || 0)} = <strong>${peso(o.total_price)}</strong></p>
          </div>
          <span class="pill ${color}" style="font-size:.75rem;white-space:nowrap">${label}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(o.created_at).toLocaleString('en-PH')}</p>
        ${o.notes ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${esc(o.notes)}</p>` : ''}
      </div>
    `;
  }).join('');
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
  msgEl.style.display = 'block';
}

loadOrders();