import { renderChrome, $, esc, CATS, UNITS, PAY, peso, srp, isOpen, hours, badges, updatePremiumIndicator, ensureLiquidChromeStill, premiumSellerLabel, productCard } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';
import { getProducts, getStores, hasAvailableQuantity } from './data.js';

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

const SHOWCASE_PRODUCT_IDS = ['55b671e1-b9b5-4109-acc7-73f7b61b7d0f'];

const SHOWCASE_EMBERS = [
  ['8%','6px','0s','2.6s','-10px'],
  ['30%','5px','.9s','3s','12px'],
  ['52%','7px','1.7s','2.8s','-6px'],
  ['74%','5px','.4s','3.2s','14px'],
  ['90%','6px','1.3s','2.7s','8px'],
  ['18%','4px','2.1s','3.4s','-14px'],
  ['63%','4px','2.6s','2.9s','-12px'],
  ['40%','5px','.2s','3.1s','10px'],
  ['82%','4px','1.9s','2.5s','-8px'],
  ['12%','5px','1.1s','3.3s','9px'],
  ['58%','6px','.7s','2.6s','13px'],
  ['95%','4px','2.3s','3s','-9px']
];

function isShowcaseProduct(p) {
  return !!p && SHOWCASE_PRODUCT_IDS.indexOf(String(p.id)) !== -1;
}

function fitShowcaseFrame(frame, img) {
  if (!frame || !img?.naturalWidth || !img?.naturalHeight) return;
  const availableWidth = frame.parentElement?.clientWidth || 0;
  if (!availableWidth) return;

  const ratio = img.naturalWidth / img.naturalHeight;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  const maxHeight = isMobile ? Math.min(window.innerHeight * 0.6, 480) : 560;
  const photoWidth = Math.min(img.naturalWidth, Math.max(0, availableWidth - 2), maxHeight * ratio);
  const photoHeight = photoWidth / ratio;
  frame.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  frame.style.width = `${photoWidth + 2}px`;
  frame.style.height = `${photoHeight + 2}px`;
}

function fitPhotoFrame(frame, img) {
  if (!frame || !img) return;
  var done = function () { frame.classList.remove('is-loading'); };
  if (img.complete && img.naturalWidth) { done(); return; }
  frame.classList.add('is-loading');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
}

function getCurrentSlideIndex(frame) {
  const track = frame?.querySelector('.carousel-track');
  const viewport = frame?.querySelector('.carousel-viewport');
  if (!track) return 0;
  const match = track.style.transform.match(/translateX\((-?[\d.]+)px\)/);
  const slideWidth = viewport?.clientWidth || 0;
  return match && slideWidth ? Math.round(Math.abs(Number(match[1])) / slideWidth) : 0;
}

function getCurrentPhoto(frame) {
  const track = frame?.querySelector('.carousel-track');
  const index = getCurrentSlideIndex(frame);
  return track?.children[index]?.querySelector('img') || track?.querySelector('img') || null;
}

function resizePhotoFrame(frame, img = getCurrentPhoto(frame)) {
  if (!frame || !img?.naturalWidth || !img?.naturalHeight) return;
  const parent = frame.parentElement;
  if (!parent) return;
  const firstGridColumn = Number.parseFloat(getComputedStyle(parent).gridTemplateColumns);
  const availableWidth = Math.max(0, (firstGridColumn || parent.clientWidth) - 2);
  if (!availableWidth) return;

  const ratio = img.naturalWidth / img.naturalHeight;
  const isStacked = window.matchMedia('(max-width: 900px)').matches;
  const maxHeight = isStacked
    ? Math.min(window.innerHeight * 0.6, 480)
    : Math.min(window.innerHeight * 0.7, 560);
  const widthLimit = Math.min(availableWidth, maxHeight * ratio);
  const minWidth = Math.min(240, widthLimit);
  const photoWidth = Math.max(minWidth, Math.min(img.naturalWidth, widthLimit));
  const photoHeight = photoWidth / ratio;

  img.style.minWidth = `${photoWidth}px`;
  frame.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  frame.style.width = `${photoWidth + 2}px`;
  frame.style.height = `${photoHeight + 2}px`;
}

function watchPhotoFrame(frame) {
  if (!frame) return;
  const track = frame.querySelector('.carousel-track');
  const update = () => {
    const currentIndex = getCurrentSlideIndex(frame);
    const currentImage = frame.querySelector('.carousel-track')?.children[currentIndex]?.querySelector('img');
    resizePhotoFrame(frame, currentImage || getCurrentPhoto(frame));
    const viewport = frame.querySelector('.carousel-viewport');
    if (track && viewport) {
      const transform = `translateX(-${currentIndex * viewport.clientWidth}px)`;
      if (track.style.transform !== transform) track.style.transform = transform;
    }
  };
  frame.querySelectorAll('.carousel-slide img').forEach(img => {
    img.addEventListener('load', () => {
      if (img === getCurrentPhoto(frame)) requestAnimationFrame(update);
    }, { once: true });
  });
  if (track && typeof MutationObserver === 'function') {
    new MutationObserver(update).observe(track, { attributes: true, attributeFilter: ['style'] });
  }
  window.addEventListener('resize', () => requestAnimationFrame(update));
  requestAnimationFrame(update);
}

function applyShowcaseDetail(root, frame, img, price) {
  if (!root || !frame || !img) return;
  if (frame.getAttribute('data-ps-done')) return;
  frame.setAttribute('data-ps-done', '1');

  root.classList.add('ps-showcase');
  frame.classList.add('ps-frame');
  img.classList.add('ps-img');
  if (price) price.classList.add('ps-price');

  var ring = document.createElement('span');
  ring.className = 'ps-ring';
  ring.setAttribute('aria-hidden', 'true');
  frame.insertBefore(ring, frame.firstChild);

  SHOWCASE_EMBERS.forEach(function (e) {
    var s = document.createElement('span');
    s.className = 'ps-ember';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--x', e[0]);
    s.style.setProperty('--s', e[1]);
    s.style.setProperty('--d', e[2]);
    s.style.setProperty('--dur', e[3]);
    s.style.setProperty('--dx', e[4]);
    frame.insertBefore(s, frame.firstChild);
  });

  var holo = document.createElement('span');
  holo.className = 'ps-holo';
  holo.setAttribute('aria-hidden', 'true');
  frame.appendChild(holo);

  // keep the layout calm while the photo is loading
  var done = function () {
    frame.classList.remove('ps-loading');
    requestAnimationFrame(function () { fitShowcaseFrame(frame, img); });
  };
  if (img.complete && img.naturalWidth) {
    done();
  } else {
    frame.classList.add('ps-loading');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }
  frame.querySelectorAll('.carousel-slide img').forEach(function (slideImg) {
    if (slideImg === img) return;
    slideImg.addEventListener('load', function () {
      if (slideImg.classList.contains('ps-img')) fitShowcaseFrame(frame, slideImg);
    }, { once: true });
  });
  window.addEventListener('resize', function () {
    fitShowcaseFrame(frame, frame.querySelector('.ps-img'));
  });

  // tilt and shine that follow the mouse (computer only, never with reduced motion)
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce || !fine) return;
  frame.addEventListener('pointermove', function (e) {
    var r = frame.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    var py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    frame.classList.add('ps-hover');
    frame.style.setProperty('--ps-rx', ((.5 - py) * 14).toFixed(2) + 'deg');
    frame.style.setProperty('--ps-ry', ((px - .5) * 14).toFixed(2) + 'deg');
    frame.style.setProperty('--ps-hx', (px * 100).toFixed(1) + '%');
    frame.style.setProperty('--ps-hx2', (140 - px * 180).toFixed(1) + '%');
  });
  frame.addEventListener('pointerleave', function () {
    frame.classList.remove('ps-hover');
    frame.style.removeProperty('--ps-rx');
    frame.style.removeProperty('--ps-ry');
    frame.style.removeProperty('--ps-hx');
    frame.style.removeProperty('--ps-hx2');
  });
}

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
  const imageFrame = $('#p-image-wrap');
  const firstPhoto = imageFrame?.querySelector('.carousel-slide img');
  if (firstPhoto) {
    fitPhotoFrame(imageFrame, firstPhoto);
    watchPhotoFrame(imageFrame);
  }
  renderRelatedProducts(isPremiumStore);
}

async function renderRelatedProducts(currentStoreIsPremium) {
  const section = $('#related-products-section');
  const list = $('#related-products-list');
  if (!section || !list || !currentProduct) return;

  try {
    const [products, stores] = await Promise.all([getProducts(), getStores()]);
    const storesById = Object.fromEntries(stores.map(store => [store.id, store]));
    const lockedProductIds = new Set();
    const premiumStoreIds = new Set();

    if (supabase) {
      const [lockedResult, premiumResult] = await Promise.all([
        supabase.from('product_lock_states').select('product_id').eq('is_locked', true),
        supabase.rpc('get_premium_stores')
      ]);
      if (lockedResult.error) throw lockedResult.error;
      (lockedResult.data || []).forEach(item => lockedProductIds.add(item.product_id));
      if (!premiumResult.error && premiumResult.data) {
        premiumResult.data.forEach(store => premiumStoreIds.add(store.id));
      }
    }
    if (currentStoreIsPremium) premiumStoreIds.add(currentStore.id);

    const related = products
      .filter(product => product.id !== currentProduct.id
        && product.category === currentProduct.category
        && product.in_stock
        && hasAvailableQuantity(product)
        && !lockedProductIds.has(product.id)
        && storesById[product.store_id])
      .slice(0, 4);

    if (!related.length) {
      section.style.display = 'none';
      return;
    }

    list.innerHTML = related
      .map(product => productCard(product, storesById[product.store_id], premiumStoreIds.has(product.store_id)))
      .join('');
    section.style.display = 'block';
  } catch (error) {
    console.warn('Could not load related products:', error);
    section.style.display = 'none';
  }
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
    let currentSlide = 0;

    function updateFrameAspect(index = currentSlide) {
      if (index !== currentSlide) return;
      const image = track.children[index]?.querySelector('img');
      if (!image?.naturalWidth || !image?.naturalHeight) return;
      imageWrap.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    }

    // Clear existing content
    track.innerHTML = '';
    indicators.innerHTML = '';

    imageUrls.forEach((url, index) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.style.flex = '0 0 100%';
      slide.innerHTML = `<img src="${esc(url)}" alt="${esc(p.name)} ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">`;
      slide.querySelector('img').addEventListener('load', () => updateFrameAspect(index), { once: true });
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
    updateFrameAspect();

    // Initialize carousel if more than one image
    if (imageUrls.length > 1) {
      indicators.style.display = 'flex';
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';

      const totalSlides = imageUrls.length;

      function updateCarousel() {
        updateFrameAspect();
        const slideWidth = viewport.clientWidth;
        track.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
        if (imageWrap.classList.contains('ps-frame')) {
          track.querySelectorAll('.ps-img').forEach(image => image.classList.remove('ps-img'));
          const activeImage = track.children[currentSlide]?.querySelector('img');
          if (activeImage) {
            activeImage.classList.add('ps-img');
            fitShowcaseFrame(imageWrap, activeImage);
          }
        }
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
      updateFrameAspect();
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
  const hasAvailableQuantity = p.quantity == null || Number(p.quantity) > 0;
  if (p.in_stock && hasAvailableQuantity) {
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

  if (isShowcaseProduct(p)) {
    applyShowcaseDetail(contentEl, $('#p-image-wrap'), $('#p-image-wrap .carousel-slide img'), $('#p-price'));
  }
}

function renderPaymentOptions(store) {
  const paymentSelect = reserveForm.payment_method;
  const submitButton = reserveForm.querySelector('button[type="submit"]');
  const acceptedPayments = Array.isArray(store.accepted_payments)
    ? [...new Set(store.accepted_payments.filter(method => Object.prototype.hasOwnProperty.call(PAY, method)))]
    : [];
  const outOfStock = !currentProduct?.in_stock
    || (currentProduct?.quantity != null && Number(currentProduct.quantity) <= 0);

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
  submitButton.disabled = outOfStock;
  if (outOfStock) showMsg('This product is currently out of stock.', 'warn');
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

  const qtyValue = qtyInput.value.trim();
  const qty = Number(qtyValue);
  if (!qtyValue || !Number.isInteger(qty) || qty < 1) {
    showMsg('Enter a valid quantity before reserving.', 'bad');
    qtyInput.focus();
    return;
  }

  if (!currentProduct.in_stock || (currentProduct.quantity != null && Number(currentProduct.quantity) <= 0)) {
    showMsg('Product is out of stock', 'bad');
    return;
  }

  const maxQty = currentProduct.quantity != null ? currentProduct.quantity : 999;
  if (qty > maxQty) {
    showMsg(`Only ${maxQty} available`, 'bad');
    return;
  }

  const paymentMethod = reserveForm.payment_method.value;
  if (!Array.isArray(currentStore.accepted_payments) || !currentStore.accepted_payments.includes(paymentMethod)) {
    showMsg('Choose a payment method accepted by this store.', 'bad');
    reserveForm.payment_method.focus();
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
  reserveMsg.style.display = 'inline-block';
}

function showError(text) {
  loadingMsg.style.display = 'none';
  errorMsg.style.display = 'block';
  errorMsg.textContent = text;
}

init();
