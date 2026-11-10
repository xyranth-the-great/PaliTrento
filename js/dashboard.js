import { renderChrome, $, esc, CATS, UNITS, PAY, peso, badges, srp } from './ui.js';
import { getSession, getCachedProfile, clearProfileCache } from './auth.js';
import { supabase } from './supabase.js';
import { uploadStoreImage, deleteStoreImage, uploadProductImage, deleteProductImage } from './storage.js';
import { isSupabaseConfigured } from './auth.js';

const modal = $('#product-modal');
const productForm = $('#product-form');
let currentStore = null;
let currentProducts = [];
let currentOrders = [];
let editingProductId = null;

async function init() {
  if (!isSupabaseConfigured()) return;

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  let profile = await getCachedProfile(session.user.id);
  renderChrome('dashboard.html', session, profile);

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

  // Load products
  await loadProducts(store.id);
  // Load orders
  await loadOrders(store.id);
  // Load analytics
  await loadAnalytics(store.id);
}

function renderStoreCard(store) {
  $('#store-card').style.display = 'block';
  $('#store-status').textContent = '';

  $('#dash-business-name').textContent = store.business_name;
  $('#dash-category').textContent = `${CATS[store.trade_category] || store.trade_category} • ${store.barangay}, ${store.purok || '—'}`;
  $('#dash-location').textContent = `${store.landmark_reference} • ${store.lat}, ${store.lng}`;
  $('#dash-hours').textContent = `${store.open_time} – ${store.close_time}`;

  const badgeContainer = $('#dash-badges');
  badgeContainer.innerHTML = badges(store);

  if (store.storefront_image_url) {
    const img = $('#dash-storefront');
    img.src = store.storefront_image_url;
    img.style.display = 'block';
  }

  // Status pill
  const statusColors = {
    PENDING: 'warn',
    VERIFIED: 'ok',
    REJECTED: 'bad',
    CLARIFICATION_REQUIRED: 'info'
  };
  const statusLabels = {
    PENDING: 'Verification pending',
    VERIFIED: 'LGU verified',
    REJECTED: 'Rejected',
    CLARIFICATION_REQUIRED: 'Clarification needed'
  };
  const pill = document.createElement('span');
  pill.className = `pill ${statusColors[store.verification_status] || 'warn'}`;
  pill.textContent = statusLabels[store.verification_status] || store.verification_status;
  badgeContainer.appendChild(pill);

  // Show standee button for verified stores
  const standeeBtn = $('#standee-btn');
  if (standeeBtn) {
    standeeBtn.style.display = 'inline-flex';
    standeeBtn.href = `standee.html?storeId=${store.id}`;
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
      .select('id, full_name, email')
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
    CANCELLED: 'bad'
  };
  const statusLabels = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
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
        <button class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel="${o.id}">Cancel</button>
        <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'CONFIRMED') {
      actions = `
        <button class="btn ok" style="padding:6px 12px;font-size:.8rem" data-ready="${o.id}">Mark Ready</button>
        <button class="btn bad" style="padding:6px 12px;font-size:.8rem" data-cancel="${o.id}">Cancel</button>
        <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'READY_FOR_PICKUP') {
      actions = `
        <button class="btn ok" style="padding:6px 12px;font-size:.8rem" data-complete="${o.id}">Complete</button>
        <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'COMPLETED') {
      actions = `
        <span class="pill ok">Completed</span>
        <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
      `;
    } else if (o.status === 'CANCELLED') {
      actions = '<span class="pill bad">Cancelled</span>';
    }

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${esc(product?.name || 'Product')}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${o.quantity} × ${peso(product?.current_price || 0)} = <strong>${peso(o.total_price)}</strong></p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">Buyer: ${esc(buyer?.full_name || 'Customer')} (${esc(buyer?.email || '')})</p>
          </div>
          <span class="pill ${color}" style="font-size:.75rem;white-space:nowrap">${label}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">${actions}</div>
        ${o.notes ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${esc(o.notes)}</p>` : ''}
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
    btn.addEventListener('click', () => {
      if (confirm('Cancel this order?')) updateOrderStatus(btn.dataset.cancel, 'CANCELLED');
    });
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
    const hasImage = p.image_url && p.image_url.trim() !== '';
    const imageHtml = hasImage
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="width:100%;height:140px;object-fit:cover;border-radius:var(--r-md) var(--r-md) 0 0;margin-bottom:8px">`
      : `<div style="width:100%;height:140px;background:var(--muted-bg);border-radius:var(--r-md) var(--r-md) 0 0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem">No image</div>`;

    return `
      <div class="card" style="position:relative;display:flex;flex-direction:column">
        ${imageHtml}
        <div style="padding:12px;display:flex;flex-direction:column;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h3 style="margin:0;font-size:1rem">${esc(p.name)}</h3>
            <div style="display:flex;gap:4px">
              <button class="btn alt" style="padding:4px 8px;font-size:.75rem" data-edit="${p.id}">Edit</button>
              <button class="btn alt" style="padding:4px 8px;font-size:.75rem;color:var(--bad)" data-delete="${p.id}">Delete</button>
            </div>
          </div>
          <p class="price">${peso(p.current_price)} <span class="muted">per ${UNITS[p.unit] || 'pc'}</span></p>
          ${s ? `<span class="pill ${s.cls}">${s.text}</span><span class="muted">Cap ${peso(p.lgu_srp_ceiling)}</span>` : ''}
          <p class="muted" style="margin-top:8px;font-size:.8rem">
            ${p.in_stock ? '<span class="pill ok" style="font-size:.7rem">In stock</span>' : '<span class="pill bad" style="font-size:.7rem">Out of stock</span>'}
            ${p.quantity ? ` • Qty: ${p.quantity}` : ''}
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
}

function bindEvents() {
  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Add product
  $('#add-product-btn')?.addEventListener('click', () => openProductModal());

  // Edit store
  $('#edit-store-btn')?.addEventListener('click', () => {
    window.location.href = 'store-setup.html';
  });

  // Modal
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-cancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Image upload
  $('#p-image')?.addEventListener('change', handleImageSelect);
  $('#p-image-remove')?.addEventListener('click', handleImageRemove);

  // Product form
  productForm?.addEventListener('submit', saveProduct);
}

async function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    alert('Please choose a JPG, PNG or WebP image');
    e.target.value = '';
    return;
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5 MB');
    e.target.value = '';
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (event) => {
    $('#p-image-preview-img').src = event.target.result;
    $('#p-image-preview').style.display = 'block';
    $('#p-image-filename').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function handleImageRemove() {
  $('#p-image').value = '';
  $('#p-image-preview').style.display = 'none';
  $('#p-image-preview-img').src = '';
  $('#p-image-filename').textContent = '';
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
  editingProductId = productId;
  productForm.reset();
  $('#product-id').value = '';

  // Reset image preview
  $('#p-image-preview').style.display = 'none';
  $('#p-image-preview-img').src = '';
  $('#p-image-filename').textContent = '';
  $('#p-image').value = '';

  if (productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (product) {
      $('#modal-title').textContent = 'Edit Product';
      $('#product-id').value = product.id;
      $('#p-name').value = product.name;
      $('#p-category').value = product.category;
      $('#p-unit').value = product.unit;
      $('#p-price').value = product.current_price;
      $('#p-srp').value = product.lgu_srp_ceiling || '';
      $('#p-stock').value = product.in_stock ? 'true' : 'false';
      $('#p-quantity').value = product.quantity || '';

      // Show existing image if present
      if (product.image_url) {
        $('#p-image-preview-img').src = product.image_url;
        $('#p-image-preview').style.display = 'block';
        $('#p-image-filename').textContent = 'Current image';
      }
    }
  } else {
    $('#modal-title').textContent = 'Add Product';
  }

  modal.style.display = 'flex';
  $('#p-name').focus();
}

function closeModal() {
  modal.style.display = 'none';
  editingProductId = null;
}

async function saveProduct(e) {
  e.preventDefault();

  if (!currentStore) return;

  const imageFile = $('#p-image')[0]?.files[0];

  const productData = {
    store_id: currentStore.id,
    name: $('#p-name').value.trim(),
    category: $('#p-category').value,
    unit: $('#p-unit').value,
    current_price: parseFloat($('#p-price').value),
    lgu_srp_ceiling: $('#p-srp').value ? parseFloat($('#p-srp').value) : null,
    in_stock: $('#p-stock').value === 'true',
    quantity: $('#p-quantity').value ? parseInt($('#p-quantity').value) : null,
  };

  if (!productData.name || !productData.category || !productData.unit || isNaN(productData.current_price)) {
    alert('Please fill all required fields');
    return;
  }

  const saveBtn = $('#modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    let productId = editingProductId;
    let error = null;

    // For editing existing product: upload image first, then update
    if (editingProductId) {
      const imageFile = $('#p-image')[0]?.files[0];
      if (imageFile) {
        const { error: uploadError, url } = await uploadProductImage(currentSession.user.id, editingProductId, imageFile);
        if (uploadError) throw uploadError;
        // Update product with image URL
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: url })
          .eq('id', editingProductId);
        if (updateError) throw updateError;
      }

      // Update other product data
      const productData = {
        name: $('#p-name').value.trim(),
        category: $('#p-category').value,
        unit: $('#p-unit').value,
        current_price: parseFloat($('#p-price').value),
        lgu_srp_ceiling: $('#p-srp').value ? parseFloat($('#p-srp').value) : null,
        in_stock: $('#p-stock').value === 'true',
        quantity: $('#p-quantity').value ? parseInt($('#p-quantity').value) : null,
      };

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
        .eq('id', editingProductId);

      if (error) throw error;
    } else {
      // For new product: insert first, then handle image upload
      const productData = {
        store_id: currentStore.id,
        name: $('#p-name').value.trim(),
        category: $('#p-category').value,
        unit: $('#p-unit').value,
        current_price: parseFloat($('#p-price').value),
        lgu_srp_ceiling: $('#p-srp').value ? parseFloat($('#p-srp').value) : null,
        in_stock: $('#p-stock').value === 'true',
        quantity: $('#p-quantity').value ? parseInt($('#p-quantity').value) : null,
      };

      if (!productData.name || !productData.category || !productData.unit || isNaN(productData.current_price)) {
        alert('Please fill all required fields');
        return;
      }

      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          store_id: productData.store_id,
          name: productData.name,
          category: productData.category,
          unit: productData.unit,
          current_price: productData.current_price,
          lgu_srp_ceiling: productData.lgu_srp_ceiling,
          in_stock: productData.in_stock,
          quantity: productData.quantity,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const newProductId = newProduct.id;

      // Handle image upload for new product
      const imageFile = $('#p-image')[0]?.files[0];
      if (imageFile) {
        const { error: uploadError, url } = await uploadProductImage(currentSession.user.id, newProduct.id, $('#p-image')[0].files[0]);
        if (uploadError) throw uploadError;

        // Update product with image URL
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: url })
          .eq('id', newProduct.id);
        if (updateError) throw updateError;
      }
    }

    closeModal();
    await loadProducts(currentStore.id);
  } catch (err) {
    console.error('Save product error:', err);
    alert('Failed to save. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;

  try {
    // First, get the product to check if it has an image
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', productId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the product
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;

    // If product had an image, delete it from storage
    if (product?.image_url) {
      await deleteProductImage(currentSession.user.id, product.image_url);
    }

    await loadProducts(currentStore.id);
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete.');
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const updates = { status: newStatus };
  const now = new Date().toISOString();
  if (newStatus === 'CONFIRMED') updates.confirmed_at = now;
  else if (newStatus === 'READY_FOR_PICKUP') updates.ready_at = now;
  else if (newStatus === 'COMPLETED') updates.completed_at = now;

  try {
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) throw error;

    await loadOrders(currentStore.id);
  } catch (err) {
    console.error('Update order error:', err);
    alert('Failed to update. Please try again.');
  }
}

function $$ (s, r = document) { return r.querySelectorAll(s); }

init();