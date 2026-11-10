import { renderChrome, $, esc, CATS, UNITS, PAY, peso, srp, isOpen, hours, badges } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');
const contentEl = $('#product-content');
const loadingMsg = $('#loading-msg');
const errorMsg = $('#error-msg');
const reserveForm = $('#reserve-form');
const reserveMsg = $('#reserve-msg');
const qtyInput = $('#qty');
const totalPriceEl = $('#total-price');

let currentProduct = null;
let currentStore = null;
let currentSession = null;
let map = null;
let storeMarker = null;

async function init() {
  if (!isSupabaseConfigured()) {
    showError('Supabase not configured');
    return;
  }

  const session = await getSession();
  if (session) currentSession = session;

  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('product-detail.html', session, profile);

  if (!productId) {
    showError('No product specified');
    return;
  }

  await loadProduct();
}

async function loadProduct() {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    showError('Product not found');
    return;
  }

  currentProduct = product;

  // Load store
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', product.store_id)
    .single();

  if (storeError || !store) {
    showError('Store not found');
    return;
  }

  currentStore = store;
  renderProduct();
  loadingMsg.style.display = 'none';
  contentEl.style.display = 'block';
}

function renderProduct() {
  const p = currentProduct;
  const s = currentStore;
  const srpInfo = srp(p);

  // Product info
  $('#p-name').textContent = p.name;
  $('#p-category').textContent = `${CATS[p.category] || p.category} • ${UNITS[p.unit] || p.unit}`;
  $('#p-price').textContent = peso(p.current_price);

  // SRP badge
  const srpBadge = $('#p-srp-badge');
  if (srpInfo) {
    srpBadge.innerHTML = `<span class="pill ${srpInfo.cls}">${srpInfo.text}</span><span class="muted" style="margin-left:8px">Cap ${peso(p.lgu_srp_ceiling)}</span>`;
  } else {
    srpBadge.innerHTML = '<span class="pill" style="background:var(--muted-bg);color:var(--muted)">No LGU cap</span>';
  }

  // Stock
  const stockEl = $('#p-stock');
  if (p.in_stock) {
    stockEl.innerHTML = '<span class="pill ok">In stock</span>';
  } else {
    stockEl.innerHTML = '<span class="pill bad">Out of stock</span>';
  }
  $('#p-unit').textContent = UNITS[p.unit] || p.unit;
  $('#p-quantity').textContent = p.quantity ? p.quantity.toLocaleString() : 'Unlimited';

  // Set max quantity
  const maxQty = p.quantity || 999;
  qtyInput.max = maxQty;
  $('#max-qty').textContent = p.quantity ? p.quantity.toLocaleString() : 'Unlimited';

  // Store info
  $('#store-name').textContent = s.business_name;
  $('#store-location').textContent = `${s.barangay}, ${s.purok || '—'}`;
  $('#store-hours').textContent = `${hours(s)} • ${isOpen(s) ? 'Open now' : 'Closed'}`;
  $('#store-badges').innerHTML = badges(s);
  $('#store-link').href = `business.html?trn=${encodeURIComponent(s.trn_code)}`;
  $('#store-landmark').textContent = s.landmark_reference;

  // Map
  initMap(s.lat, s.lng);

  // Update total price
  updateTotal();
}

function updateTotal() {
  const qty = parseInt(qtyInput.value) || 1;
  const total = currentProduct.current_price * qty;
  totalPriceEl.textContent = peso(total);
}

qtyInput.addEventListener('input', updateTotal);

function initMap(lat, lng) {
  if (typeof L === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = 'anonymous';
    script.onload = () => createMap(lat, lng);
    document.head.appendChild(script);
  } else {
    createMap(lat, lng);
  }
}

function createMap(lat, lng) {
  map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  storeMarker = L.marker([lat, lng]).addTo(map);
  storeMarker.bindPopup(`<strong>${currentStore.business_name}</strong><br>${currentStore.landmark_reference}`).openPopup();
}

reserveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  reserveMsg.style.display = 'none';

  if (!currentSession) {
    showMsg('Please log in to reserve', 'bad');
    setTimeout(() => window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`, 1500);
    return;
  }

  const qty = parseInt(qtyInput.value) || 1;
  if (qty < 1) {
    showMsg('Enter valid quantity', 'bad');
    return;
  }

  const maxQty = currentProduct.quantity || 999;
  if (qty > maxQty) {
    showMsg(`Only ${maxQty} available`, 'bad');
    return;
  }

  if (!currentProduct.in_stock) {
    showMsg('Product is out of stock', 'bad');
    return;
  }

  const paymentMethod = reserveForm.payment_method.value;
  const notes = reserveForm.notes.value.trim();
  const totalPrice = currentProduct.current_price * qty;

  const submitBtn = reserveForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Reserving...';

  try {
    const { error } = await supabase
      .from('orders')
      .insert({
        buyer_id: currentSession.user.id,
        store_id: currentStore.id,
        product_id: currentProduct.id,
        quantity: qty,
        total_price: totalPrice,
        payment_method: paymentMethod,
        notes: notes || null,
        status: 'PENDING',
      });

    if (error) throw error;

    showMsg('Reserved! Seller will confirm soon.', 'ok');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Reserved';

    setTimeout(() => window.location.href = 'account.html', 2000);
  } catch (err) {
    console.error('Reserve error:', err);
    showMsg('Failed to reserve. Please try again.', 'bad');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reserve for Pickup';
  }
});

function showMsg(text, type) {
  reserveMsg.textContent = text;
  reserveMsg.className = `pill ${type}`;
}

function showError(text) {
  loadingMsg.style.display = 'none';
  errorMsg.style.display = 'block';
  errorMsg.textContent = text;
}

init();