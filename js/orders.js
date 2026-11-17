import { renderChrome, $, esc, peso, startAdvisoryToastListener } from './ui.js';
import { getSessionWithStatus, startOrderStatusListener, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getLoginUnavailableMessage } from './auth.js';

const container = $('#orders-history');
const msgEl = $('#orders-message');

let currentSession = null;
let currentOrders = [];
let orderChangesChannel = null;
let pickupCountdownInterval = null;

async function loadOrders() {
  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage(), 'warn');
    return;
  }

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

  currentSession = session;

  renderChrome('/orders/', session, profile);

  // Start advisory toast listener
  startAdvisoryToastListener();
  startOrderStatusListener(session.user.id);
  startOrderRefreshListener(session.user.id);

  await refreshOrders();
  $('#orders-content').style.display = 'block';
}

async function refreshOrders() {
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
    focusOrderFromQuery();
  } catch (err) {
    console.error('Load orders error:', err);
    showMsg('Failed to load orders. Please try again.', 'bad');
  }
}

function startOrderRefreshListener(userId) {
  orderChangesChannel = supabase
    .channel(`customer-orders-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `buyer_id=eq.${userId}`
      },
      () => refreshOrders()
    )
    .subscribe((status, err) => {
      if (err) console.error('Customer order updates subscription error:', err);
      console.log('Customer order subscription:', status);
    });
}

function renderOrders() {
  if (!container) return;

  if (currentOrders.length === 0) {
    clearInterval(pickupCountdownInterval);
    container.innerHTML = '<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="/products/">Start shopping</a></p>';
    return;
  }

  const statusColors = {
    PENDING: 'warn',
    CONFIRMED: 'info',
    READY_FOR_PICKUP: 'ok',
    COMPLETED: 'ok',
    CANCELLED: 'bad',
    EXPIRED: 'bad'
  };
  const statusLabels = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired - not picked up'
  };

  container.innerHTML = currentOrders.map(o => {
    const product = o.products;
    const store = o.stores;
    const color = statusColors[o.status] || 'warn';
    const label = statusLabels[o.status] || o.status;
    const pickupDeadline = o.status === 'READY_FOR_PICKUP' && o.ready_at
      ? Date.parse(o.ready_at) + 72 * 60 * 60 * 1000
      : null;
    const pickupDeadlineDate = Number.isFinite(pickupDeadline)
      ? new Date(pickupDeadline).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
      : null;
    const pickupCountdown = o.status !== 'READY_FOR_PICKUP' ? '' : pickupDeadlineDate
      ? `<div class="pickup-countdown" data-pickup-countdown data-deadline-ms="${pickupDeadline}">
          <span class="pickup-countdown-label">Pickup time remaining</span>
          <strong class="pickup-countdown-value" data-countdown-value></strong>
          <span class="pickup-countdown-deadline">Pick up by ${esc(pickupDeadlineDate)}. The reservation will be automatically cancelled after 72 hours.</span>
        </div>`
      : `<div class="pickup-countdown"><span class="pickup-countdown-label">Pickup time remaining</span><strong class="pickup-countdown-value">Deadline unavailable</strong><span class="pickup-countdown-deadline">Please contact the store to confirm pickup.</span></div>`;

    return `
      <div class="card" data-order-id="${esc(o.id)}" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${esc(product?.name || 'Product')}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${esc(store?.business_name || 'Store')} • ${esc(store?.barangay || '')}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${o.quantity} × ${peso(product?.current_price || 0)} = <strong>${peso(o.total_price)}</strong></p>
          </div>
          <span class="pill ${color}" style="font-size:.75rem;white-space:nowrap">${label}</span>
        </div>
        ${pickupCountdown}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="/chat/?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
          ${o.status === 'PENDING' ? `<button type="button" class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel-order="${esc(o.id)}">Cancel reservation</button>` : ''}
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(o.created_at).toLocaleString('en-PH')}</p>
        ${o.notes ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${esc(o.notes)}</p>` : ''}
        ${o.cancellation_reason ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Cancellation reason: ${esc(o.cancellation_reason)}</p>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-cancel-order]').forEach(button => {
    button.addEventListener('click', () => cancelOrder(button.dataset.cancelOrder));
  });
  updatePickupCountdowns();
  clearInterval(pickupCountdownInterval);
  if (container.querySelector('[data-pickup-countdown]')) {
    pickupCountdownInterval = setInterval(updatePickupCountdowns, 60 * 1000);
  }
}

function updatePickupCountdowns() {
  container?.querySelectorAll('[data-pickup-countdown]').forEach(countdown => {
    const deadline = Number(countdown.dataset.deadlineMs);
    const remaining = deadline - Date.now();
    const value = countdown.querySelector('[data-countdown-value]');

    if (!Number.isFinite(deadline) || !value) return;
    if (remaining <= 0) {
      value.textContent = 'Pickup window passed';
      countdown.classList.remove('is-warning');
      countdown.classList.add('is-expired');
      return;
    }

    const totalMinutes = Math.ceil(remaining / (60 * 1000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    let label;
    if (days > 0) {
      label = `${days} day${days === 1 ? '' : 's'}${hours ? `, ${hours} hour${hours === 1 ? '' : 's'}` : ''} left`;
    } else if (hours > 0) {
      label = `${hours} hour${hours === 1 ? '' : 's'}${minutes ? `, ${minutes} minute${minutes === 1 ? '' : 's'}` : ''} left`;
    } else {
      label = `${minutes} minute${minutes === 1 ? '' : 's'} left`;
    }

    value.textContent = label;
    countdown.classList.toggle('is-warning', remaining <= 12 * 60 * 60 * 1000);
    countdown.classList.remove('is-expired');
  });
}

async function cancelOrder(orderId) {
  if (!confirm('Cancel this reservation?')) return;

  try {
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: 'CANCELLED',
      p_cancellation_reason: null
    });

    if (error) throw error;

    await refreshOrders();
  } catch (err) {
    console.error('Cancel order error:', err);
    showMsg(typeof err?.message === 'string' ? err.message : 'Failed to cancel this reservation.', 'bad');
  }
}

function focusOrderFromQuery() {
  const orderId = new URLSearchParams(window.location.search).get('orderId');
  if (!orderId) return;

  const orderCard = Array.from(container.querySelectorAll('[data-order-id]'))
    .find(card => card.dataset.orderId === orderId);
  if (!orderCard) return;

  orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  orderCard.style.outline = '3px solid var(--amber)';
  setTimeout(() => { orderCard.style.outline = ''; }, 3000);
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
  msgEl.style.display = 'block';
}

loadOrders();
