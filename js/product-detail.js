import { renderChrome, $, esc, CATS, UNITS, PAY, peso, srp, isOpen, hours, badges, updatePremiumIndicator, ensureLiquidChromeStill, premiumSellerLabel } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams, getCachedProfile } from './auth.js';
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
let imageCarousel = null;

async function init() {
  if (!isSupabaseConfigured()) {
    showError('Supabase not configured');
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
  if (session) currentSession = session;

  // profile is already from getSessionWithStatus, but fetch if missing
  const currentProfile = profile || (session ? await getCachedProfile(session.user.id) : null);
  renderChrome('/product-detail/', session, currentProfile);

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

  // Check if product is locked (for non-owners)
  const isOwner = currentSession && currentSession.user.id === product.store_id; // Will check properly after loading store
  if (!isOwner) {
    const { data: lock } = await supabase
      .from('product_lock_states')
      .select('is_locked')
      .eq('product_id', productId)
      .eq('is_locked', true)
      .maybeSingle();

    if (lock?.is_locked) {
      showError('Product not available');
      return;
    }
  }

  // Load store
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', product.store_id)
    .single();

  if (storeError || !store || store.verification_status !== 'VERIFIED') {
    showError('Store not found');
    return;
  }

  // Check ownership properly
  const isStoreOwner = currentSession && currentSession.user.id === store.user_id;

  currentStore = store;

  // Check if store has Premium subscription
  let isPremiumStore = false;
  if (supabase && store.user_id) {
    try {
      const { data: sub } = await supabase.rpc('get_user_subscription', { p_user_id: store.user_id });
      if (sub && sub.length > 0) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('code')
          .eq('id', sub[0].plan_id)
          .single();
        if (plan && plan.code === 'PREMIUM' && sub[0].status === 'ACTIVE') {
          isPremiumStore = true;
        }
      }
    } catch (err) {
      console.warn('Could not check premium status:', err);
    }
  }

  // Re-check lock with ownership
  if (!isStoreOwner) {
    const { data: lock } = await supabase
      .from('product_lock_states')
      .select('is_locked')
      .eq('product_id', productId)
      .eq('is_locked', true)
      .maybeSingle();

    if (lock?.is_locked) {
      showError('Product not available');
      return;
    }
  }

  renderProduct(isPremiumStore);
  loadingMsg.style.display = 'none';
  contentEl.style.display = 'block';
}

function renderProduct(isPremiumStore = false) {
  const p = currentProduct;
  const s = currentStore;
  if (isPremiumStore) ensureLiquidChromeStill();
  const srpInfo = srp(p);
  const isOwnStoreProduct = !!currentSession && currentSession.user.id === s.user_id;
  $('#reserve-card').style.display = isOwnStoreProduct ? 'none' : '';
  $('#owner-product-note').style.display = isOwnStoreProduct ? 'block' : 'none';

  // Product info with Premium badge
  const premiumBadge = isPremiumStore ? premiumSellerLabel('pill premium premium-heading-label') : '';
  $('#p-name').innerHTML = `${esc(p.name)}${premiumBadge}`;
  $('#p-category').textContent = `${CATS[p.category] || p.category} • ${UNITS[p.unit] || p.unit}`;
  $('#p-price').textContent = peso(p.current_price);

  // Product images - support multiple images via image_urls array
  const imageUrls = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0)
    ? p.image_urls
    : (p.image_url ? [p.image_url] : []);

  if (imageUrls.length > 0) {
    const imageWrap = $('#p-image-wrap');
    const track = $('#p-image-track');
    const indicators = $('#p-image-indicators');
    const viewport = $('#p-image-viewport');
    const prevBtn = $('.carousel-prev', imageWrap);
    const nextBtn = $('.carousel-next', imageWrap);

    // Clear existing content
    track.innerHTML = '';
    indicators.innerHTML = '';

    imageUrls.forEach((url, index) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.style.flex = '0 0 100%';
      slide.innerHTML = `<img src="${esc(url)}" alt="${esc(p.name)} ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">`;
      track.appendChild(slide);

      // Create indicator
      const indicator = document.createElement('button');
      indicator.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
      indicator.setAttribute('aria-label', `Image ${index + 1}`);
      indicator.dataset.index = index;
      indicator.addEventListener('click', () => goToSlide(index));
      indicators.appendChild(indicator);
    });

    imageWrap.style.display = 'block';
    $('.product-detail-header').classList.add('has-image');

    // Initialize carousel if more than one image
    if (imageUrls.length > 1) {
      indicators.style.display = 'flex';
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';

      let currentSlide = 0;
      const totalSlides = imageUrls.length;

      function updateCarousel() {
        const slideWidth = viewport.clientWidth;
        track.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
        indicators.querySelectorAll('.carousel-indicator').forEach((ind, i) => {
          ind.classList.toggle('active', i === currentSlide);
        });
      }

      function goToSlide(index) {
        currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
        updateCarousel();
      }

      function nextSlide() {
        goToSlide(currentSlide + 1);
      }

      function prevSlide() {
        goToSlide(currentSlide - 1);
      }

      prevBtn.addEventListener('click', prevSlide);
      nextBtn.addEventListener('click', nextSlide);

      // Touch/swipe support
      let touchStartX = 0;
      viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      viewport.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
          diff > 0 ? nextSlide() : prevSlide();
        }
      }, { passive: true });

      // Keyboard navigation
      viewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        else if (e.key === 'ArrowRight') nextSlide();
      });

      // Handle resize
      window.addEventListener('resize', updateCarousel);

      // Store reference for cleanup
      imageCarousel = { updateCarousel, goToSlide, nextSlide, prevSlide };
    } else {
      // Single image - no carousel controls needed
      indicators.style.display = 'none';
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  // SRP badge
  const srpBadge = $('#p-srp-badge');
  if (srpInfo) {
    srpBadge.innerHTML = `<span class="pill ${srpInfo.cls}">${srpInfo.text}</span><span class="muted" style="margin-left:8px">Cap ${peso(p.lgu_srp_ceiling)}</span>`;
  } else {
    srpBadge.innerHTML = '<span class="pill" style="background:var(--muted-bg);color:var(--muted)">No Admin cap</span>';
  }

  // Stock
  const stockEl = $('#p-stock');
  if (p.in_stock) {
    stockEl.innerHTML = '<span class="pill ok">In stock</span>';
  } else {
    stockEl.innerHTML = '<span class="pill bad">Out of stock</span>';
  }
  $('#p-unit').textContent = UNITS[p.unit] || p.unit;
  const hasLimitedQuantity = p.quantity != null;
  $('#p-quantity').textContent = hasLimitedQuantity ? p.quantity.toLocaleString() : 'Unlimited';

  // Set max quantity
  const maxQty = hasLimitedQuantity ? p.quantity : 999;
  qtyInput.max = maxQty;
  $('#max-qty').textContent = hasLimitedQuantity ? p.quantity.toLocaleString() : 'Unlimited';

  // Store info
  const storePremiumBadge = isPremiumStore ? premiumSellerLabel('pill premium premium-heading-label') : '';
  $('#store-name').innerHTML = `<span>${esc(s.business_name)}</span>${storePremiumBadge}`;
  $('#store-location').textContent = `${s.barangay}, ${s.purok || '—'}`;
  $('#store-hours').textContent = `${hours(s)} • ${isOpen(s) ? 'Open now' : 'Closed'}`;
  $('#store-badges').innerHTML = badges(s);
  $('#store-link').href = `/business/?trn=${encodeURIComponent(s.trn_code)}`;
  $('#store-landmark').textContent = s.landmark_reference;
  renderPaymentOptions(s);

  // Report product button (for logged-in users on verified stores)
  if (currentSession && s.verification_status === 'VERIFIED') {
    const reportBtn = document.createElement('a');
    reportBtn.href = `/report-product/?productId=${encodeURIComponent(p.id)}`;
    reportBtn.className = 'btn alt';
    reportBtn.style.marginTop = '12px';
    reportBtn.style.display = 'inline-flex';
    reportBtn.textContent = 'Report Product';
    // Add after the store link
    const storeLink = $('#store-link');
    if (storeLink && storeLink.parentNode) {
      storeLink.parentNode.insertBefore(reportBtn, storeLink.nextSibling);
    }
  }

  // Map
  initMap(s.lat, s.lng);

  // Update total price
  updateTotal();
}

function renderPaymentOptions(store) {
  const paymentSelect = reserveForm.payment_method;
  const submitButton = reserveForm.querySelector('button[type="submit"]');
  const acceptedPayments = Array.isArray(store.accepted_payments)
    ? [...new Set(store.accepted_payments.filter(method => Object.prototype.hasOwnProperty.call(PAY, method)))]
    : [];

  paymentSelect.replaceChildren();

  if (acceptedPayments.length === 0) {
    paymentSelect.add(new Option('No payment methods available', ''));
    paymentSelect.disabled = true;
    submitButton.disabled = true;
    showMsg('No payment methods are set for this store. Please contact the seller.', 'warn');
    return;
  }

  paymentSelect.add(new Option('Choose a payment method', ''));
  acceptedPayments.forEach(method => paymentSelect.add(new Option(PAY[method], method)));
  paymentSelect.disabled = false;
  submitButton.disabled = false;
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

  if (currentSession && currentStore && currentSession.user.id === currentStore.user_id) {
    $('#reserve-card').style.display = 'none';
    $('#owner-product-note').style.display = 'block';
    return;
  }

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

  const maxQty = currentProduct.quantity != null ? currentProduct.quantity : 999;
  if (qty > maxQty) {
    showMsg(`Only ${maxQty} available`, 'bad');
    return;
  }

  if (!currentProduct.in_stock) {
    showMsg('Product is out of stock', 'bad');
    return;
  }

  const paymentMethod = reserveForm.payment_method.value;
  if (!Array.isArray(currentStore.accepted_payments) || !currentStore.accepted_payments.includes(paymentMethod)) {
    showMsg('Choose a payment method accepted by this store.', 'bad');
    return;
  }

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

    setTimeout(() => window.location.href = '/orders/', 2000);
  } catch (err) {
    console.error('Reserve error:', err);
    showMsg(typeof err?.message === 'string' && err.message.includes('Insufficient stock')
      ? 'The remaining stock was just reserved by someone else. Refresh and try again.'
      : typeof err?.message === 'string' && err.message.includes('out of stock')
        ? 'This product is out of stock.'
        : 'Failed to reserve. Please try again.', 'bad');
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
