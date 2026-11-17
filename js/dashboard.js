import { renderChrome, $, esc, CATS, UNITS, PAY, peso, srp, getStoreStatusBadge, getStoreStatusMessage, startAdvisoryToastListener } from './ui.js';
import { getSessionWithStatus, clearProfileCache, startOrderStatusListener, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { uploadStoreImage, deleteStoreImage, uploadProductImages, deleteProductImages } from './storage.js';
import { isSupabaseConfigured } from './auth.js';

const modal = $('#product-modal');
const productForm = $('#product-form');
const demoPaymentModal = $('#demo-payment-modal');
const CUSTOM_UNIT_VALUE = 'OTHER';
let currentStore = null;
let currentProducts = [];
let currentOrders = [];
let editingProductId = null;
let currentSession = null;
let demoPaymentAction = null;
let demoPaymentCancelAction = null;
let paymentCountdownInterval = null;
let orderChangesChannel = null;

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
  currentSession = session;

  renderChrome('/dashboard/', session, profile);

  // Start advisory toast listener
  startAdvisoryToastListener();
  startOrderStatusListener(session.user.id);

  // Load store
  await loadStore(session.user.id);

  // Bind events
  bindEvents();
}

async function loadStore(userId) {
  const { data: store, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !store) {
    $('#store-card').style.display = 'none';
    $('#store-status').textContent = 'No store found. Complete setup first.';
    $('#add-product-btn').disabled = true;
    return;
  }

  currentStore = store;
  renderStoreCard(store);

  // Get display status from database function (single source of truth)
  try {
    const { data: status, error: statusError } = await supabase
      .rpc('get_store_display_status', { p_store_id: store.id });
    if (!statusError && status) {
      updateStoreStatusDisplay(status);
    }
  } catch (err) {
    console.warn('Could not load store display status:', err);
  }

  // Load products
  await loadProducts(store.id);
  // Load orders
  await loadOrders(store.id);
  startOrderRefreshListener(store.id);
  // Load analytics
  await loadAnalytics(store.id);
  // Load verification
  await loadVerification(store.id);
}

function updateStoreStatusDisplay(status) {
  const displayStatus = normalizePermitReviewStatus(status);
  const badgeContainer = $('#dash-badges');
  const statusBadge = getStoreStatusBadge(displayStatus);
  // Append status badge to existing DTI/BMBE/SRP badges
  badgeContainer.insertAdjacentHTML('beforeend', statusBadge);

  // Show the current review status and one-time approval notice.
  const approvalNoticeUnacknowledged = displayStatus.status === 'VERIFIED' && displayStatus.approval_notice_acknowledged !== true;
  const messageHtml = displayStatus.status === 'VERIFIED' && !approvalNoticeUnacknowledged
    ? ''
    : getStoreStatusMessage(displayStatus);
  const noticeEl = $('#product-approval-notice');
  if (messageHtml) {
    noticeEl.innerHTML = `${messageHtml}${approvalNoticeUnacknowledged
      ? '<button type="button" class="btn alt" data-acknowledge-approval style="margin:8px 0 0;padding:10px 14px;font-size:.9rem;min-height:40px">Acknowledge</button>'
      : ''}`;
    noticeEl.style.display = 'block';
  }

  // Update product management access
  const canManageProducts = displayStatus.status === 'VERIFIED';
  const addProductButton = $('#add-product-btn');
  addProductButton.disabled = !canManageProducts;
  addProductButton.title = canManageProducts ? '' : 'Available after store approval';
  const approvalNotice = $('#product-approval-notice');
  if (!messageHtml) {
    approvalNotice.style.display = canManageProducts ? 'none' : 'block';
    if (!canManageProducts) {
      approvalNotice.textContent = 'Your store is awaiting Admin approval. Product management available after approval.';
      approvalNotice.className = 'pill warn';
    }
  }
}

function normalizePermitReviewStatus(status) {
  if (!status || ![
    'APPROVED_NO_CERTIFICATE',
    'COMPLIANCE_EXPIRED',
    'CERTIFICATE_UNDER_REVIEW',
    'CERTIFICATE_REJECTED',
    'CERTIFICATE_REJECTED_EXPIRED'
  ].includes(status.status)) {
    return status;
  }

  return {
    status: 'PENDING_APPROVAL',
    badge_class: 'warn',
    label: 'Pending Approval',
    message: 'Your store and required permits are awaiting Admin review.'
  };
}

function renderStoreCard(store) {
  $('#store-card').style.display = 'block';
  $('#store-status').textContent = '';

  $('#dash-business-name').textContent = store.business_name;
  $('#dash-category').textContent = `${CATS[store.trade_category] || store.trade_category} • ${store.barangay}, ${store.purok || '—'}`;
  $('#dash-location').textContent = `${store.landmark_reference} • ${store.lat}, ${store.lng}`;
  $('#dash-hours').textContent = `${store.open_time} – ${store.close_time}`;
  const description = $('#dash-description');
  description.textContent = store.description || '';
  description.style.display = store.description?.trim() ? 'block' : 'none';

  const badgeContainer = $('#dash-badges');
  // DTI/BMBE/SRP badges only (no verification status here)
  badgeContainer.innerHTML = [
    store.dti_registered ? '<span class="pill info">DTI registered</span>' : '',
    store.bmbe_registered ? '<span class="pill info">BMBE</span>' : '',
    store.srp_compliant ? '<span class="pill ok">Follows price caps</span>' : ''
  ].join('');

  if (store.storefront_image_url) {
    const img = $('#dash-storefront');
    img.src = store.storefront_image_url;
    img.style.display = 'block';
  }

  // Get display status from database function (single source of truth)
  // We'll call this after loading store, but for now show basic status
  // Allow product management for APPROVED stores (not just VERIFIED)
  const canManageProducts = store.approval_status === 'APPROVED' || store.verification_status === 'VERIFIED';
  const addProductButton = $('#add-product-btn');
  addProductButton.disabled = !canManageProducts;
  addProductButton.title = canManageProducts ? '' : 'Available after store approval';
  const approvalNotice = $('#product-approval-notice');
  approvalNotice.style.display = canManageProducts ? 'none' : 'block';

  // Show standee button for verified stores
  const standeeBtn = $('#standee-btn');
  if (standeeBtn) {
    standeeBtn.style.display = canManageProducts ? 'inline-flex' : 'none';
    standeeBtn.href = `/standee/?storeId=${store.id}`;
  }
}

async function loadProducts(storeId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load products error:', error);
    return;
  }

  currentProducts = data || [];
  renderProducts();
}

async function loadOrders(storeId) {
  // First load orders with products
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      products (name, unit, current_price)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load orders error:', error.message, error.code, error.details, error.hint);
    return;
  }

  console.log('Orders loaded:', orders?.length);

  // Fetch buyer profiles separately
  const buyerIds = [...new Set((orders || []).map(o => o.buyer_id).filter(Boolean))];
  let profilesMap = {};

  if (buyerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', buyerIds);

    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
    }
  }

  // Merge profiles into orders
  currentOrders = (orders || []).map(o => ({
    ...o,
    profiles: profilesMap[o.buyer_id] || null
  }));

  renderOrders();
}

async function loadAnalytics(storeId) {
  try {
    // Total products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);

    // Total orders
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);

    // Revenue (completed orders only)
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_price')
      .eq('store_id', storeId)
      .eq('status', 'COMPLETED');

    const revenue = (revenueData || []).reduce((sum, o) => sum + Number(o.total_price), 0);

    $('#stat-products').textContent = productCount || 0;
    $('#stat-orders').textContent = orderCount || 0;
    $('#stat-revenue').textContent = '₱' + revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 });
  } catch (err) {
    console.error('Load analytics error:', err);
  }
}

function renderOrders() {
  const list = $('#orders-list');
  const empty = $('#no-orders');

  if (currentOrders.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'block';

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

  list.innerHTML = currentOrders.map(o => {
    const product = o.products;
    const buyer = o.profiles;
    const color = statusColors[o.status] || 'warn';
    const label = statusLabels[o.status] || o.status;

    let actions = '';
    if (o.status === 'PENDING') {
      actions = `
        <button class="btn ok" style="padding:6px 12px;font-size:.8rem" data-confirm="${o.id}">Confirm</button>
        <button class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel="${o.id}">Cancel reservation</button>
        <a href="/chat/?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'CONFIRMED') {
      actions = `
        <button class="btn ok" style="padding:6px 12px;font-size:.8rem" data-ready="${o.id}">Mark Ready</button>
        <button class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel="${o.id}">Cancel reservation</button>
        <a href="/chat/?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'READY_FOR_PICKUP') {
      actions = `
        <button class="btn ok" style="padding:6px 12px;font-size:.8rem" data-complete="${o.id}">Complete</button>
        <button class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel="${o.id}">Cancel reservation</button>
        <a href="/chat/?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'COMPLETED') {
      actions = `
        <span class="pill ok">Completed</span>
        <a href="/chat/?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'CANCELLED') {
      actions = '<span class="pill bad">Cancelled</span>';
    } else if (o.status === 'EXPIRED') {
      actions = '<span class="pill bad">Expired - not picked up</span>';
    }

    return `
      <div class="card" data-order-id="${esc(o.id)}" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${esc(product?.name || 'Product')}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${o.quantity} × ${peso(product?.current_price || 0)} = <strong>${peso(o.total_price)}</strong></p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">Buyer: ${esc(buyer?.full_name || 'Customer')}</p>
          </div>
          <span class="pill ${color}" style="font-size:.75rem;white-space:nowrap">${label}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">${actions}</div>
        ${o.notes ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${esc(o.notes)}</p>` : ''}
        ${o.cancellation_reason ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Cancellation reason: ${esc(o.cancellation_reason)}</p>` : ''}
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(o.created_at).toLocaleString('en-PH')}</p>
      </div>
    `;
  }).join('');

  // Bind order actions
  list.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.confirm, 'CONFIRMED'));
  });
  list.querySelectorAll('[data-ready]').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.ready, 'READY_FOR_PICKUP'));
  });
  list.querySelectorAll('[data-complete]').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.complete, 'COMPLETED'));
  });
  list.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', () => cancelOrder(btn.dataset.cancel));
  });
}

function startOrderRefreshListener(storeId) {
  if (orderChangesChannel) orderChangesChannel.unsubscribe();

  orderChangesChannel = supabase
    .channel(`dashboard-orders-${storeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${storeId}`
      },
      async () => {
        await Promise.all([loadOrders(storeId), loadProducts(storeId)]);
      }
    )
    .subscribe((status, err) => {
      if (err) console.error('Order updates subscription error:', err);
      console.log('Dashboard order subscription:', status);
    });
}

function renderProducts() {
  const list = $('#products-list');
  const empty = $('#no-products');

  if (currentProducts.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'grid';

  list.innerHTML = currentProducts.map(p => {
    const s = srp(p);
    // Use first image from image_urls array, fallback to image_url
    const imageUrl = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0)
      ? p.image_urls[0]
      : p.image_url;
    const hasImage = imageUrl && imageUrl.trim() !== '';
    const featuredUntil = Date.parse(p.featured_until);
    const isFeatured = featuredUntil > Date.now();
    const imageHtml = hasImage
      ? `<img src="${esc(imageUrl)}" alt="${esc(p.name)}" style="width:100%;height:140px;object-fit:cover;border-radius:var(--r-md) var(--r-md) 0 0;margin-bottom:8px">`
      : `<div style="width:100%;height:140px;background:var(--muted-bg);border-radius:var(--r-md) var(--r-md) 0 0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem">No image</div>`;

    return `
      <div class="card" style="position:relative;display:flex;flex-direction:column">
        ${imageHtml}
        <div style="padding:12px;display:flex;flex-direction:column;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h3 style="margin:0;font-size:1rem">${esc(p.name)}</h3>
            <div style="display:flex;gap:4px">
              ${currentStore?.verification_status === 'VERIFIED' ? `
                <button class="btn alt" style="padding:4px 8px;font-size:.75rem" data-edit="${p.id}">Edit</button>
                <button class="btn alt" style="padding:4px 8px;font-size:.75rem;color:var(--bad)" data-delete="${p.id}">Delete</button>
              ` : ''}
            </div>
          </div>
          <div class="product-ad-action">
            ${isFeatured ? `<span class="pill info">Featured until ${new Date(featuredUntil).toLocaleDateString('en-PH')}</span>` : '<span class="muted">Not featured on home</span>'}
            ${currentStore?.verification_status === 'VERIFIED' ? `<button type="button" class="btn alt" data-advertise="${p.id}">${isFeatured ? 'Extend ad' : 'Advertise'} · ₱20 / 7 days</button>` : ''}
          </div>
          <p class="price">${peso(p.current_price)} <span class="muted">per ${esc(UNITS[p.unit] || p.unit || 'pc')}</span></p>
          ${s ? `<span class="pill ${s.cls}">${s.text}</span><span class="muted">Cap ${peso(p.lgu_srp_ceiling)}</span>` : ''}
          <p class="muted" style="margin-top:8px;font-size:.8rem">
            ${p.in_stock ? '<span class="pill ok" style="font-size:.7rem">In stock</span>' : '<span class="pill bad" style="font-size:.7rem">Out of stock</span>'}
            ${p.quantity != null ? ` • Available: ${p.quantity}` : ''}
          </p>
          <p class="muted" style="font-size:.7rem;margin-top:8px">Category: ${esc(p.category)}</p>
        </div>
      </div>
    `;
  }).join('');

  // Bind edit/delete
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.edit));
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(btn.dataset.delete));
  });
  list.querySelectorAll('[data-advertise]').forEach(btn => {
    btn.addEventListener('click', () => advertiseProduct(btn.dataset.advertise));
  });
}

function bindEvents() {
  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  if (params.get('tab') === 'orders' || orderId) {
    switchTab('orders');
  }
  if (orderId) {
    const orderCard = Array.from($('#orders-list').querySelectorAll('[data-order-id]'))
      .find(card => card.dataset.orderId === orderId);
    if (orderCard) {
      orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      orderCard.style.outline = '3px solid var(--amber)';
      setTimeout(() => { orderCard.style.outline = ''; }, 3000);
    }
  }

  // Add product
  $('#add-product-btn')?.addEventListener('click', () => openProductModal());
  $('#p-category')?.addEventListener('change', updateOtherCategoryField);
  $('#p-unit')?.addEventListener('change', updateOtherUnitField);

  // Edit store
  $('#edit-store-btn')?.addEventListener('click', () => {
    window.location.href = '/store-setup/';
  });

  // Modal
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-cancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Image upload
  $('#p-image')?.addEventListener('change', handleImageSelect);
  // Delegate click for remove buttons on dynamic previews
  $('#p-image-previews')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-index]');
    if (removeBtn) handleImageRemove(parseInt(removeBtn.dataset.removeIndex));
  });

  // Product form
  productForm?.addEventListener('submit', saveProduct);

  $('#demo-payment-cancel')?.addEventListener('click', () => closeDemoPayment(true));
  $('#demo-payment-error-cancel')?.addEventListener('click', () => closeDemoPayment(true));
  $('#demo-payment-retry')?.addEventListener('click', () => showDemoPaymentStep('demo-payment-qr'));
  $('#demo-payment-simulate')?.addEventListener('click', completeDemoPayment);
  $('#documents-approved [data-acknowledge-approval]')?.addEventListener('click', (e) => {
    acknowledgeApprovalNotice(e.currentTarget);
  });
  $('#product-approval-notice')?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-acknowledge-approval]');
    if (button) acknowledgeApprovalNotice(button);
  });

}

async function acknowledgeApprovalNotice(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Saving...';

  try {
    const { error } = await supabase.rpc('acknowledge_business_approval', {
      p_store_id: currentStore.id,
    });
    if (error) throw error;
    $('#documents-approved').style.display = 'none';
    $('#product-approval-notice').style.display = 'none';
  } catch (error) {
    console.error('Acknowledge approval notice error:', error);
    alert(`Could not save your acknowledgement: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loadVerification(storeId) {
  if (!supabase) return;

  try {
    // Get display status from database function
    const { data: rpcStatus, error: statusError } = await supabase
      .rpc('get_store_display_status', { p_store_id: storeId });

    // Load compliance record
    const { data: compliance, error: compError } = await supabase
      .from('business_compliance')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (compError && compError.code !== 'PGRST116') throw compError;

    renderVerification(compliance, normalizePermitReviewStatus(rpcStatus));
  } catch (err) {
    console.error('Load verification error:', err);
    $('#verification-not-available').style.display = 'block';
  }
}

function renderVerification(compliance, status) {
  const verificationCard = $('#verification-card');
  const documentsCard = $('#documents-card');
  const notAvailable = $('#verification-not-available');

  if (status) {
    const statusBadge = getStoreStatusBadge(status);
    const statusMessage = getStoreStatusMessage(status);

    $('#verification-status-badge').innerHTML = statusBadge;
    $('#verification-status-text').innerHTML = statusMessage || status.label;
    const documentsApprovedEl = $('#documents-approved');
    verificationCard.style.display = 'block';
    documentsApprovedEl.style.display = status.status === 'VERIFIED'
      && status.approval_notice_acknowledged !== true
      && compliance?.approval_notice_acknowledged !== true ? 'block' : 'none';
  } else if (!compliance) {
    verificationCard.style.display = 'none';
    documentsCard.style.display = 'none';
    notAvailable.style.display = 'block';
    return;
  } else {
    // Fallback to old logic if no status from RPC
    notAvailable.style.display = 'none';
    verificationCard.style.display = 'block';
    documentsCard.style.display = 'block';

    let statusText = '';
    let badgeClass = 'warn';

    if (compliance.all_documents_approved) {
      statusText = 'Verified';
      badgeClass = 'ok';
    } else {
      statusText = 'Permits submitted - awaiting Admin review';
      badgeClass = 'warn';
    }

    $('#verification-status-text').textContent = statusText;
    $('#verification-status-badge').textContent = statusText;
    $('#verification-status-badge').className = `pill ${badgeClass}`;

    const documentsApprovedEl = $('#documents-approved');

    if (compliance.all_documents_approved && compliance.approval_notice_acknowledged !== true) {
      documentsApprovedEl.style.display = 'block';
    } else {
      documentsApprovedEl.style.display = 'none';
    }
  }

  // Show the required permits submitted with the store application.
  const requiredDocs = [
    { column: 'barangay_clearance_image_url', label: 'Barangay Business Clearance' },
    { column: 'cedula_image_url', label: 'Community Tax Certificate (Cedula)' },
    { column: 'business_permit_image_url', label: 'Business Permit' }
  ];

  const docsHtml = requiredDocs.map(req => {
    const url = currentStore[req.column];
    const isApproved = currentStore.approval_status === 'APPROVED';
    const statusHtml = url
      ? `<span class="pill ${isApproved ? 'ok' : 'info'}">${isApproved ? 'Verified' : 'Submitted'}</span>`
      : '<span class="pill bad">Required</span>';
    const actionHtml = url
      ? `<a class="btn alt" href="${esc(url)}" target="_blank" rel="noopener">View permit</a>`
      : '<a class="btn alt" href="/store-setup/">Upload in Store Setup</a>';

    return `
      <div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;margin-bottom:8px">
          <div style="flex:1;min-width:200px">
            <strong>${req.label}</strong>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${statusHtml}${actionHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  $('#documents-list').innerHTML = docsHtml;

}

async function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const MAX_IMAGES = 3;
  const MAX_SIZE = 5 * 1024 * 1024;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  // Validate total count (including existing previews)
  const existingPreviews = $('#p-image-previews').querySelectorAll('.image-preview-item').length;
  if (existingPreviews + files.length > MAX_IMAGES) {
    alert(`Maximum ${MAX_IMAGES} images allowed. You already have ${existingPreviews}.`);
    e.target.value = '';
    return;
  }

  // Validate each file
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      alert('Please choose only JPG, PNG or WebP images');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      alert('Each image must be under 5 MB');
      e.target.value = '';
      return;
    }
  }

  // Show previews
  const previewsContainer = $('#p-image-previews');
  const filenameEl = $('#p-image-filename');

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const index = previewsContainer.children.length;
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';
      previewItem.style.cssText = 'position:relative;width:120px;height:120px;flex-shrink:0';
      previewItem.innerHTML = `
        <img src="${event.target.result}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--line)">
        <button type="button" data-remove-index="${index}" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;line-height:1;padding:0" aria-label="Remove image">&times;</button>
      `;
      previewsContainer.appendChild(previewItem);
      updateFilenameDisplay();
    };
    reader.readAsDataURL(file);
  }
}

function handleImageRemove(index) {
  const previewsContainer = $('#p-image-previews');
  const items = previewsContainer.querySelectorAll('.image-preview-item');
  if (items[index]) {
    items[index].remove();
    updateFilenameDisplay();
  }
  // If all removed, clear file input
  if (previewsContainer.children.length === 0) {
    $('#p-image').value = '';
  }
}

function updateFilenameDisplay() {
  const fileInput = $('#p-image');
  const filenameEl = $('#p-image-filename');
  const previewsContainer = $('#p-image-previews');
  const count = previewsContainer.children.length;
  const fileCount = fileInput.files?.length || 0;

  if (count > 0) {
    filenameEl.textContent = `${count} image${count !== 1 ? 's' : ''} selected`;
  } else if (fileCount > 0) {
    filenameEl.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''} selected`;
  } else {
    filenameEl.textContent = '';
  }
}

function switchTab(tab) {
  $$('.tab-btn').forEach(b => {
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  $$('[role="tabpanel"]').forEach(p => {
    p.style.display = p.id === `tab-${tab}` ? 'block' : 'none';
  });
}

function openProductModal(productId = null) {
  if (currentStore?.verification_status !== 'VERIFIED') {
    alert('Products can be added or managed after your store is approved by Admin.');
    return;
  }

  editingProductId = productId;
  productForm.reset();
  $('#product-id').value = '';
  updateOtherCategoryField();
  updateOtherUnitField();

  // Reset image previews
  $('#p-image-previews').innerHTML = '';
  $('#p-image-filename').textContent = '';
  $('#p-image').value = '';

  if (productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (product) {
      $('#modal-title').textContent = 'Edit Product';
      $('#modal-save').textContent = 'Save changes';
      $('#product-id').value = product.id;
      $('#p-name').value = product.name;
      const categorySelect = $('#p-category');
      const hasPresetCategory = Array.from(categorySelect.options).some(option => option.value === product.category);
      categorySelect.value = hasPresetCategory ? product.category : 'Other';
      $('#p-category-other').value = hasPresetCategory ? '' : product.category;
      updateOtherCategoryField();
      const unitSelect = $('#p-unit');
      const hasPresetUnit = Array.from(unitSelect.options)
        .some(option => option.value === product.unit && option.value !== CUSTOM_UNIT_VALUE);
      unitSelect.value = hasPresetUnit ? product.unit : CUSTOM_UNIT_VALUE;
      $('#p-unit-other').value = hasPresetUnit ? '' : product.unit;
      updateOtherUnitField();
      $('#p-price').value = product.current_price;
      $('#p-srp').value = product.lgu_srp_ceiling || '';
      $('#p-stock').value = product.in_stock ? 'true' : 'false';
      $('#p-quantity').value = product.quantity ?? '';

      // Show existing images if present (support both image_url and image_urls)
      const imageUrls = product.image_urls || (product.image_url ? [product.image_url] : []);
      if (imageUrls.length > 0) {
        const previewsContainer = $('#p-image-previews');
        imageUrls.forEach((url, index) => {
          const previewItem = document.createElement('div');
          previewItem.className = 'image-preview-item';
          previewItem.style.cssText = 'position:relative;width:120px;height:120px;flex-shrink:0';
          previewItem.innerHTML = `
            <img src="${url}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--line)">
            <button type="button" data-remove-index="${index}" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;line-height:1;padding:0" aria-label="Remove image">&times;</button>
          `;
          previewsContainer.appendChild(previewItem);
        });
        updateFilenameDisplay();
      }
    }
  } else {
    $('#modal-title').textContent = 'Add Product';
    $('#modal-save').textContent = 'Pay ₱2 & add product';
  }

  // New products must include at least one photo. Existing products can keep their current images.
  $('#p-image').required = !productId;

  modal.style.display = 'flex';
  $('#p-name').focus();
}

function updateOtherCategoryField() {
  const isOther = $('#p-category')?.value === 'Other';
  const wrapper = $('#p-category-other-wrap');
  const input = $('#p-category-other');
  if (!wrapper || !input) return;
  wrapper.style.display = isOther ? 'block' : 'none';
  input.required = isOther;
}

function updateOtherUnitField() {
  const isOther = $('#p-unit')?.value === CUSTOM_UNIT_VALUE;
  const wrapper = $('#p-unit-other-wrap');
  const input = $('#p-unit-other');
  if (!wrapper || !input) return;
  wrapper.style.display = isOther ? 'block' : 'none';
  input.required = isOther;
}

function closeModal() {
  modal.style.display = 'none';
  editingProductId = null;
}

async function saveProduct(e) {
  e.preventDefault();

  if (!currentStore) return;
  if (currentStore.verification_status !== 'VERIFIED') {
    alert('Products can be added or managed after your store is approved by Admin.');
    return;
  }

  const imageFiles = $('#p-image')?.files;
  const hasNewImages = imageFiles && imageFiles.length > 0;
  const existingImagesCount = $('#p-image-previews').children.length;

  if (!editingProductId && !hasNewImages && existingImagesCount === 0) {
    alert('Please add at least one product picture before saving.');
    $('#p-image').focus();
    return;
  }

  const productData = {
    store_id: currentStore.id,
    name: $('#p-name').value.trim(),
    category: $('#p-category').value === 'Other'
      ? $('#p-category-other').value.trim()
      : $('#p-category').value,
    unit: $('#p-unit').value === CUSTOM_UNIT_VALUE
      ? $('#p-unit-other').value.trim()
      : $('#p-unit').value,
    current_price: parseFloat($('#p-price').value),
    lgu_srp_ceiling: $('#p-srp').value ? parseFloat($('#p-srp').value) : null,
    in_stock: $('#p-stock').value === 'true',
    quantity: $('#p-quantity').value ? parseInt($('#p-quantity').value) : null,
  };

  if ($('#p-category').value === 'Other' && !$('#p-category-other').value.trim()) {
    alert('Please specify the product category.');
    $('#p-category-other').focus();
    return;
  }

  if (!productData.name || !productData.category || !productData.unit || isNaN(productData.current_price)) {
    alert('Please fill all required fields');
    return;
  }

  if ($('#p-unit').value === CUSTOM_UNIT_VALUE && !$('#p-unit-other').value.trim()) {
    alert('Please specify the product unit.');
    $('#p-unit-other').focus();
    return;
  }

  if (!editingProductId) {
    startDemoPayment({
      amount: 2,
      title: 'Product listing fee',
      description: `Pay the demo fee to publish “${productData.name}”.`,
      successMessage: 'Your product has been added successfully.',
      onCancel: () => {
        modal.style.display = 'flex';
        $('#p-name').focus();
      },
      onSuccess: async () => {
        await createNewProduct(productData, imageFiles);
        closeModal();
        await loadProducts(currentStore.id);
      },
    });
    return;
  }

  const saveBtn = $('#modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    // Handle image updates
    if (hasNewImages) {
      // Upload new images
      const { error: uploadError, urls } = await uploadProductImages(currentSession.user.id, editingProductId, imageFiles);
      if (uploadError) throw uploadError;

      // Get existing images and combine with new ones (max 3 total)
      const product = currentProducts.find(p => p.id === editingProductId);
      const existingUrls = product?.image_urls || (product?.image_url ? [product.image_url] : []);
      const combinedUrls = [...existingUrls, ...urls].slice(0, 3);

      const { error: imageUpdateError } = await supabase
        .from('products')
        .update({ image_urls: combinedUrls, image_url: combinedUrls[0] || null }) // Keep image_url for backwards compat
        .eq('id', editingProductId);
      if (imageUpdateError) throw imageUpdateError;
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: productData.name,
        category: productData.category,
        unit: productData.unit,
        current_price: productData.current_price,
        lgu_srp_ceiling: productData.lgu_srp_ceiling,
        in_stock: productData.in_stock,
        quantity: productData.quantity,
      })
      .eq('id', editingProductId)
      .eq('store_id', currentStore.id);

    if (error) throw error;
    closeModal();
    await loadProducts(currentStore.id);
  } catch (err) {
    console.error('Save product error:', err);
    alert(err?.message ? `Failed to save: ${err.message}` : 'Failed to save. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingProductId ? 'Save changes' : 'Save';
  }
}

async function createNewProduct(productData, imageFiles) {
  if (currentStore?.verification_status !== 'VERIFIED') {
    throw new Error('Products can be added after your store is approved by Admin.');
  }

  const { data: newProduct, error: insertError } = await supabase
    .from('products')
    .insert(productData)
    .select('id')
    .single();

  if (insertError) throw insertError;

  try {
    // Upload multiple images (up to 3)
    const { error: uploadError, urls } = await uploadProductImages(currentSession.user.id, newProduct.id, imageFiles);
    if (uploadError) throw uploadError;

    // Save image_urls array and first image as image_url for backwards compatibility
    const { error: imageUpdateError } = await supabase
      .from('products')
      .update({ image_urls: urls, image_url: urls[0] || null })
      .eq('id', newProduct.id)
      .eq('store_id', currentStore.id);

    if (imageUpdateError) {
      // Clean up uploaded images on failure
      if (urls.length > 0) {
        await deleteProductImages(currentSession.user.id, newProduct.id, urls);
      }
      throw imageUpdateError;
    }
  } catch (err) {
    const { error: rollbackError } = await supabase
      .from('products')
      .delete()
      .eq('id', newProduct.id)
      .eq('store_id', currentStore.id);
    if (rollbackError) console.error('Could not roll back incomplete product:', rollbackError);
    throw err;
  }
}

function advertiseProduct(productId) {
  if (currentStore?.verification_status !== 'VERIFIED') {
    alert('Products can be advertised after your store is approved by Admin.');
    return;
  }

  const product = currentProducts.find(item => item.id === productId);
  if (!product || !currentStore) return;

  startDemoPayment({
    amount: 20,
    title: 'Home page featured ad',
    description: `Promote ${product.name} from ${currentStore.business_name} on the home page for 7 days.`,
    successMessage: `${product.name} is now featured on the home page for 7 days.`,
    onSuccess: async () => {
      const previousEnd = Date.parse(product.featured_until);
      const startsAt = Math.max(Date.now(), Number.isFinite(previousEnd) ? previousEnd : 0);
      const featuredUntil = new Date(startsAt + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('products')
        .update({ featured_until: featuredUntil })
        .eq('id', product.id)
        .eq('store_id', currentStore.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('The featured ad could not be saved.');
      await loadProducts(currentStore.id);
    },
  });
}

function startDemoPayment({ amount, title, description, successMessage, onSuccess, onCancel }) {
  demoPaymentAction = onSuccess;
  demoPaymentCancelAction = onCancel || null;
  $('#demo-payment-title').textContent = title;
  $('#demo-payment-description').textContent = description;
  $('#demo-payment-amount').textContent = peso(amount);
  $('#demo-payment-success-message').textContent = successMessage;
  $('#demo-payment-code').innerHTML = createDemoQrSvg();
  $('#demo-payment-simulate').textContent = `Simulate scan & pay ${peso(amount)}`;

  modal.style.display = 'none';
  showDemoPaymentStep('demo-payment-qr');
  demoPaymentModal.style.display = 'flex';
  $('#demo-payment-simulate').focus();
}

function showDemoPaymentStep(stepId) {
  ['demo-payment-qr', 'demo-payment-processing', 'demo-payment-success', 'demo-payment-error']
    .forEach(id => { $(`#${id}`).style.display = id === stepId ? 'block' : 'none'; });
  $(`#${stepId} h2`)?.focus();
}

function closeDemoPayment(cancelled = false) {
  if (paymentCountdownInterval) {
    clearInterval(paymentCountdownInterval);
    paymentCountdownInterval = null;
  }
  demoPaymentModal.style.display = 'none';
  const onCancel = demoPaymentCancelAction;
  demoPaymentAction = null;
  demoPaymentCancelAction = null;
  if (cancelled) onCancel?.();
}

function runPaymentCountdown(element, seconds, onComplete) {
  let remaining = seconds;
  element.textContent = String(remaining);
  paymentCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (remaining === 0) {
      clearInterval(paymentCountdownInterval);
      paymentCountdownInterval = null;
      onComplete();
    } else {
      element.textContent = String(remaining);
    }
  }, 1000);
}

function completeDemoPayment() {
  $('#demo-payment-simulate').disabled = true;
  showDemoPaymentStep('demo-payment-processing');
  runPaymentCountdown($('#demo-payment-processing-count'), 3, async () => {
    try {
      await demoPaymentAction();
      showDemoPaymentStep('demo-payment-success');
      runPaymentCountdown($('#demo-payment-success-count'), 5, () => closeDemoPayment());
    } catch (err) {
      console.error('Demo payment completion error:', err);
      const missingFeaturedColumn = err?.code === 'PGRST204'
        && /featured_until/i.test(err?.message || '');
      $('#demo-payment-error-message').textContent = missingFeaturedColumn
        ? 'The database is missing the featured_until column. Run supabase/product-demo-payments.sql in the Supabase SQL Editor, then try again.'
        : err?.message
          ? `Could not save your product or ad. ${err.message}`
          : 'Could not save your product or ad. Please try the simulated payment again.';
      showDemoPaymentStep('demo-payment-error');
      $('#demo-payment-simulate').disabled = false;
    }
  });
}

function createDemoQrSvg() {
  const size = 21;
  const quietZone = 4;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = new Set();
  const rects = [];

  function reserve(x, y) {
    if (x >= 0 && x < size && y >= 0 && y < size) reserved.add(y * size + x);
  }

  function placeFinder(left, top) {
    for (let y = top - 1; y <= top + 7; y += 1) {
      for (let x = left - 1; x <= left + 7; x += 1) reserve(x, y);
    }

    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        modules[top + y][left + x] = x === 0 || x === 6 || y === 0 || y === 6
          || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);

  for (let index = 8; index < size - 8; index += 1) {
    reserve(index, 6);
    reserve(6, index);
    modules[6][index] = index % 2 === 0;
    modules[index][6] = index % 2 === 0;
  }

  let state = 0x6d2b79f5;
  function nextModule() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state & 1) === 1;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const position = y * size + x;
      if (!reserved.has(position)) modules[y][x] = nextModule();
      if (modules[y][x]) rects.push(`<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`);
    }
  }

  const viewSize = size + quietZone * 2;
  return `<svg viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="Decorative, non-scannable demo QR code" shape-rendering="crispEdges"><rect width="${viewSize}" height="${viewSize}" fill="#fff"/><g fill="#14351f">${rects.join('')}</g><rect x="10" y="13" width="9" height="3" rx=".5" fill="#fff" stroke="#d7dfd9" stroke-width=".25"/><text x="14.5" y="15.1" fill="#14351f" font-family="Arial,sans-serif" font-size="1.5" font-weight="700" text-anchor="middle" letter-spacing=".12">DEMO</text></svg>`;
}

async function deleteProduct(productId) {
  if (currentStore?.verification_status !== 'VERIFIED') {
    alert('Products can be managed after your store is approved by Admin.');
    return;
  }

  if (!confirm('Delete this product?')) return;

  try {
    // First, get the product to check if it has images
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('image_url, image_urls')
      .eq('id', productId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the product
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;

    // If product had images, delete them from storage
    const imageUrls = product?.image_urls || (product?.image_url ? [product.image_url] : []);
    if (imageUrls.length > 0) {
      await deleteProductImages(currentSession.user.id, productId, imageUrls);
    }

    await loadProducts(currentStore.id);
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete.');
  }
}

async function updateOrderStatus(orderId, newStatus, cancellationReason = null) {
  try {
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_cancellation_reason: cancellationReason
    });

    if (error) throw error;

    await loadOrders(currentStore.id);
    if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
      await loadProducts(currentStore.id);
    }
  } catch (err) {
    console.error('Update order error:', err);
    alert(typeof err?.message === 'string' ? err.message : 'Failed to update. Please try again.');
  }
}

async function cancelOrder(orderId) {
  const enteredReason = prompt('Enter a reason for cancelling this reservation:');
  if (enteredReason === null) return;

  const reason = enteredReason.trim();
  if (!reason) {
    alert('A cancellation reason is required.');
    return;
  }

  if (confirm('Cancel this reservation? The held stock will be released.')) {
    await updateOrderStatus(orderId, 'CANCELLED', reason);
  }
}

function $$ (s, r = document) { return r.querySelectorAll(s); }

init();
