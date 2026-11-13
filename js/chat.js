import { renderChrome, $, esc, peso } from './ui.js';
import { getSession, getCachedProfile, incrementUnreadCount, clearUnreadCount, getCachedUnreadCounts, setCachedUnreadCounts } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const container = $('#chat-container');
const loadingMsg = $('#loading-msg');
const errorMsg = $('#error-msg');
const messagesList = $('#messages-list');
const messageForm = $('#message-form');
const messageInput = $('#message-input');
const chatTitle = $('#chat-title');
const chatSubtitle = $('#chat-subtitle');
const chatStatus = $('#chat-status');
const backLink = $('#chat-back-link');

let currentSession = null;
let currentOrder = null;
let currentUserId = null;
let channel = null;

async function init() {
  if (!isSupabaseConfigured()) {
    showError('Supabase not configured');
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentSession = session;
  currentUserId = session.user.id;

  let profile = await getCachedProfile(session.user.id);
  renderChrome('chat.html', session, profile);

  if (!orderId) {
    showError('No order specified');
    return;
  }

  await loadOrder();
  setupRealtime();
  bindEvents();
}

async function loadOrder() {
  console.log('Loading order:', orderId, 'User:', currentUserId);

  // Load order with products and stores (no profiles join - no FK)
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      products (name, unit, current_price),
      stores (business_name, trn_code, user_id)
    `)
    .eq('id', orderId)
    .single();

  console.log('Order query result:', { error, order: order ? 'found' : 'null' });

  if (error || !order) {
    console.error('Order load error:', error);
    showError('Order not found');
    return;
  }

  // Verify user is participant
  const isBuyer = order.buyer_id === currentUserId;
  const isSeller = order.stores?.user_id === currentUserId;

  console.log('Participant check:', { isBuyer, isSeller, buyer_id: order.buyer_id, store_user_id: order.stores?.user_id, currentUserId });

  if (!isBuyer && !isSeller) {
    showError('You are not part of this conversation');
    return;
  }

  // The RPC only returns the buyer's name to participants in this order.
  let buyerProfile = null;
  if (order.buyer_id) {
    const { data: buyerName, error: profileError } = await supabase.rpc(
      'get_order_customer_name',
      { p_order_id: order.id },
    );
    if (profileError) {
      console.error('Buyer name query error:', profileError.message, profileError.code, profileError.details, profileError.hint);
    } else {
      buyerProfile = buyerName ? { full_name: buyerName } : null;
    }
  }

  currentOrder = { ...order, profiles: buyerProfile };
  console.log('Order loaded:', order.id, 'isBuyer:', isBuyer, 'isSeller:', isSeller);
  container.style.display = 'flex';
  loadingMsg.style.display = 'none';
  renderOrderInfo({ ...order, profiles: buyerProfile }, isBuyer);
  loadMessages();
}

function renderOrderInfo(order, isBuyer) {
  const product = order.products;
  const store = order.stores;
  const buyer = order.profiles;

  if (isBuyer) {
    chatTitle.textContent = `Chat with ${store?.business_name || 'Seller'}`;
    chatSubtitle.textContent = `${product?.name || 'Product'} • ${order.quantity} × ${peso(product?.current_price || 0)} = ${peso(order.total_price)}`;
    backLink.href = 'account.html?tab=orders';
  } else {
    chatTitle.textContent = `Chat with ${buyer?.full_name || 'Customer'}`;
    chatSubtitle.textContent = `${product?.name || 'Product'} • Order ${order.id.slice(0,8)}`;
    backLink.href = 'dashboard.html';
  }
}

async function loadMessages() {
  console.log('Loading messages for order:', orderId);
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Load messages error:', error.message, error.code, error.details, error.hint);
    return;
  }

  console.log('Messages loaded:', data?.length);
  renderMessages(data || []);
  scrollToBottom();

  // Clear unread count for this order since user opened chat
  const counts = clearUnreadCount(orderId);
  updateUnreadBadge(counts);
}

function renderMessages(messages) {
  messagesList.innerHTML = messages.map(msg => renderMessage(msg)).join('');
}

function renderMessage(msg) {
  const isOwn = msg.sender_id === currentUserId;
  const senderName = msg.sender_id === currentOrder?.stores?.user_id
    ? 'Seller'
    : currentOrder?.profiles?.full_name || 'Customer';
  const time = new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const readBadge = msg.read_at ? `<span class="pill ok" style="font-size:.6rem;margin-left:4px">Read</span>` : '';

  return `
    <div class="message ${isOwn ? 'own' : ''}" style="display:flex;flex-direction:column;${isOwn ? 'align-items:flex-end' : 'align-items:flex-start'};max-width:80%">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        ${!isOwn ? `<span class="muted" style="font-size:.7rem;font-weight:600">${esc(senderName)}</span>` : ''}
        <span class="muted" style="font-size:.7rem">${new Date(msg.created_at).toLocaleString('en-PH', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
        ${isOwn ? readBadge : ''}
      </div>
      <div style="background:${isOwn ? 'var(--primary)' : 'var(--muted-bg)'};color:${isOwn ? '#fff' : 'var(--ink)'};padding:10px 14px;border-radius:var(--r-lg);font-size:.9rem;line-height:1.5">${esc(msg.content)}</div>
    </div>
  `;
}

function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

function setupRealtime() {
  console.log('Setting up realtime for order:', orderId);

  channel = supabase
    .channel(`order-chat-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${orderId}`
      },
      (payload) => {
        console.log('Realtime event received:', { eventType: payload.eventType, new: payload.new, old: payload.old });
        const msg = payload.new;
        if (msg && msg.sender_id !== currentUserId) {
          console.log('Appending message from other user:', msg);
          appendMessage(msg);
          scrollToBottom();
          markAsRead(msg.id);
          // Increment unread count and update badge
          const counts = incrementUnreadCount(orderId);
          updateUnreadBadge(counts);
        } else if (msg && msg.sender_id === currentUserId) {
          console.log('Ignoring own message (will appear via optimistic UI or re-fetch)');
        }
      }
    )
    .subscribe((status, err) => {
      console.log('Realtime subscription status:', status, err);
    });
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.innerHTML = renderMessage(msg);
  messagesList.appendChild(div.firstElementChild);
}

async function markAsRead(messageId) {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
}

function bindEvents() {
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    messageInput.disabled = true;
    messageInput.value = '';

    try {
      console.log('Sending message:', { orderId, senderId: currentUserId, content });
      const { data, error } = await supabase
        .from('messages')
        .insert({
          order_id: orderId,
          sender_id: currentUserId,
          content,
        })
        .select();

      console.log('Insert result:', { data, error });
      if (error) throw error;
      if (data && data[0]) {
        console.log('Message inserted:', data[0]);
        // Optimistically add to UI
        appendMessage(data[0]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Send message error:', err);
      alert('Failed to send. Please try again.');
    } finally {
      messageInput.disabled = false;
      messageInput.focus();
    }
  });

  // Mark messages as read when window focused
  window.addEventListener('focus', () => {
    markUnreadAsRead();
  });
}

async function markUnreadAsRead() {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('read_at', null)
    .neq('sender_id', currentUserId);
}

function showError(text) {
  loadingMsg.style.display = 'none';
  errorMsg.style.display = 'block';
  errorMsg.textContent = text;
}

function updateUnreadBadge(counts) {
  const badge = $('#avatar-unread-badge');
  if (!badge) return;
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  if (total > 0) {
    badge.textContent = total > 9 ? '9+' : total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

init();