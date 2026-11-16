import {
  renderChrome,
  $,
  esc,
  startAdvisoryToastListener,
  openNotificationModal,
  getMessageNotificationOrders,
  messageNotificationsEnabled
} from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';

// Check for auth error params from Supabase redirect
const authErrorRedirect = checkAuthErrorParams();
if (authErrorRedirect) {
  window.location.replace(authErrorRedirect);
}

const { session, profile, redirectUrl } = await getSessionWithStatus();
if (redirectUrl) {
  window.location.replace(redirectUrl);
}
renderChrome('/advisories/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

if (!session) {
  $('#list').innerHTML = `
    <div class="empty" style="grid-column:1/-1;text-align:center;padding:48px 24px">
      <h3>Please log in to view notifications</h3>
      <p class="muted" style="margin-top:8px">You need to be logged in to see your notifications.</p>
      <a href="/login/" class="btn" style="margin-top:16px;display:inline-block">Log in</a>
    </div>
  `;
  $('#count').textContent = '';
  $('#pagination').innerHTML = '';
} else {
  // Initialize the page
  initAdvisoriesPage();
}

const PAGE_SIZE = 20;
let currentPage = 1;
let totalPages = 1;
let allNotifications = [];
let filteredNotifications = [];

async function initAdvisoriesPage() {
  await loadAllNotifications();
  setupFilters();
  renderPage();
}

async function loadAllNotifications() {
  if (!supabase || !session) return;
  const userId = session.user.id;
  const now = new Date().toISOString();

  $('#list').innerHTML = '<div class="muted" style="padding:16px;text-align:center;grid-column:1/-1">Loading...</div>';

  try {
    // Load active advisories
    const { data: advisories, error } = await supabase
      .from('advisories')
      .select('id, title, body, category, priority, published_at, barangay, recipient_id, action_url, action_label')
      .lte('published_at', now)
      .or(`and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`)
      .order('published_at', { ascending: false });

    if (error) throw error;

    // Get read status for all advisories
    const advisoryIds = (advisories || []).map(advisory => advisory.id);
    let reads = [];
    if (advisoryIds.length) {
      const { data, error: readsError } = await supabase
        .from('notification_reads')
        .select('advisory_id')
        .eq('user_id', userId)
        .in('advisory_id', advisoryIds);
      if (readsError) throw readsError;
      reads = data || [];
    }

    const readIds = new Set((reads || []).map(r => r.advisory_id));

    const advisoryNotifications = (advisories || []).map(a => ({
      ...a,
      type: 'advisory',
      isMessage: false,
      isRead: readIds.has(a.id)
    }));

    let messageNotifications = [];
    if (await messageNotificationsEnabled(userId)) {
      const orders = await getMessageNotificationOrders(supabase, userId);
      if (orders === null) {
        console.error('Load all message notifications error: unable to load user orders.');
      } else if (orders.length) {
        const orderMap = new Map(orders.map(order => [order.id, order]));
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, order_id, sender_id, content, created_at, read_at')
          .in('order_id', orders.map(order => order.id))
          .neq('sender_id', userId)
          .order('created_at', { ascending: false });

        if (messagesError) {
          console.error('Load all message notifications error:', messagesError);
        } else {
          const senderNames = new Map();
          for (const orderId of new Set((messages || []).map(message => message.order_id))) {
            const order = orderMap.get(orderId);
            if (order?.buyer_id !== userId) {
              const { data, error: nameError } = await supabase.rpc(
                'get_order_customer_name',
                { p_order_id: orderId }
              );
              if (nameError) console.error('Load message sender name error:', nameError);
              senderNames.set(orderId, data || 'Customer');
            }
          }

          messageNotifications = (messages || []).map(message => {
            const order = orderMap.get(message.order_id);
            const senderName = order?.buyer_id === userId
              ? order?.stores?.business_name || 'Business owner'
              : senderNames.get(message.order_id) || 'Customer';
            return {
              id: message.id,
              order_id: message.order_id,
              type: 'message',
              isMessage: true,
              category: 'MESSAGE',
              title: `New message from ${senderName}`,
              body: message.content,
              published_at: message.created_at,
              isRead: !!message.read_at
            };
          });
        }
      }
    }

    allNotifications = [...advisoryNotifications, ...messageNotifications]
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    filteredNotifications = [...allNotifications];
  } catch (err) {
    console.error('Load all notifications error:', err);
    $('#list').innerHTML = '<div class="pill bad" style="padding:16px;text-align:center;grid-column:1/-1">Failed to load notifications</div>';
    $('#count').textContent = '';
    $('#pagination').innerHTML = '';
  }
}

function setupFilters() {
  const qInput = $('#q');
  const catSelect = $('#cat');
  const statusSelect = $('#status');

  function applyFilters() {
    const q = qInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const status = statusSelect.value;

    filteredNotifications = allNotifications.filter(a => {
      const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
      const matchesCategory = !cat || a.category === cat;
      const matchesStatus = !status || (status === 'unread' ? !a.isRead : a.isRead);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    currentPage = 1;
    renderPage();
  }

  // Debounce search input
  let searchTimeout = null;
  qInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 200);
  });

  catSelect.addEventListener('change', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
}

function renderPage() {
  totalPages = Math.ceil(filteredNotifications.length / PAGE_SIZE) || 1;
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = filteredNotifications.slice(start, end);

  // Update count
  const unreadCount = filteredNotifications.filter(a => !a.isRead).length;
  $('#count').textContent = `${filteredNotifications.length} notification${filteredNotifications.length !== 1 ? 's' : ''} ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`;

  if (pageItems.length === 0) {
    $('#list').innerHTML = '';
    $('#empty').hidden = false;
    $('#pagination').innerHTML = '';
    return;
  }

  $('#empty').hidden = true;

  // Render items
  $('#list').innerHTML = pageItems.map(a => {
    const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn', MESSAGE: 'info' }[a.category] || 'warn';
    const categoryLabel = a.isMessage ? 'Message' : a.category.replace('_', ' ');
    return `
      <button class="notification-item ${a.isRead ? 'read' : 'unread'}" data-id="${esc(a.id)}" data-type="${a.type}" role="option" tabindex="0">
        <span class="notification-cat pill ${catColor}">${categoryLabel}</span>
        <div class="notification-content">
          <strong>${esc(a.title)}</strong>
          <p class="muted">${esc(a.body)}</p>
          <span class="muted">${new Date(a.published_at).toLocaleString('en-PH')}${a.barangay ? ` • ${esc(a.barangay)}` : ''}</span>
        </div>
        ${!a.isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
      </button>
    `;
  }).join('');

  // Add click handlers
  $('#list').querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      const notification = allNotifications.find(a => a.id === id && a.type === item.dataset.type);
      if (notification?.isMessage) {
        window.location.href = `/chat/?orderId=${encodeURIComponent(notification.order_id)}&messageId=${encodeURIComponent(notification.id)}`;
      } else if (notification) {
        await openNotificationModal(notification);
        // Update local state and UI
        notification.isRead = true;
        item.classList.remove('unread');
        item.classList.add('read');
        item.querySelector('.notification-dot')?.remove();
        updateCountDisplay();
      }
    });
  });

  renderPagination();
}

function updateCountDisplay() {
  const unreadCount = filteredNotifications.filter(a => !a.isRead).length;
  $('#count').textContent = `${filteredNotifications.length} notification${filteredNotifications.length !== 1 ? 's' : ''} ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`;
}

function renderPagination() {
  const pagination = $('#pagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  html += `
    <button class="btn alt" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="padding:8px 16px;font-size:.9rem">
      Previous
    </button>
  `;

  // Page numbers (show max 5 pages centered on current)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="${i === currentPage ? 'btn' : 'btn alt'}" data-page="${i}" style="padding:8px 16px;font-size:.9rem;min-width:44px">
        ${i}
      </button>
    `;
  }

  // Next button
  html += `
    <button class="btn alt" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" style="padding:8px 16px;font-size:.9rem">
      Next
    </button>
  `;

  pagination.innerHTML = html;

  // Add click handlers
  pagination.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        renderPage();
        // Scroll to top of list
        $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}