import { renderChrome, $, esc, BARANGAYS, CATS, PAY } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { uploadStoreImage, deleteStoreImage } from './storage.js';
import { isSupabaseConfigured } from './auth.js';

const form = $('#setup-form');
const msgEl = $('#setup-message');
const submitBtn = $('#submit-btn');

let currentStep = 1;
let map = null;
let marker = null;
let storefrontUrl = null;
let permitsUrl = null;

// Step elements
const steps = {
  1: $('#step-1'),
  2: $('#step-2'),
  3: $('#step-3'),
};

async function init() {
  if (!isSupabaseConfigured()) {
    showMsg('Store setup requires Supabase configuration.', 'warn');
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  let profile = await getCachedProfile(session.user.id);
  renderChrome('store-setup.html', session, profile);

  // Populate barangay
  const brgySelect = $('#barangay');
  brgySelect.innerHTML = '<option value="">Choose barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

  // Check if returning user has existing store
  const { data: existingStore } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingStore) {
    // Pre-fill form
    prefillForm(existingStore);
  }

  // Init map (default to Trento center)
  initMap(8.0733, 125.8689); // Trento, Agusan del Sur approx

  // Bind events
  bindEvents();

  // URL step parameter
  const urlStep = parseInt(new URLSearchParams(window.location.search).get('step')) || 1;
  if (urlStep >= 1 && urlStep <= 3) goToStep(urlStep);
}

function prefillForm(store) {
  $('#business_name').value = store.business_name ?? '';
  $('#trade_category').value = store.trade_category ?? '';
  $('#proprietor_name').value = store.proprietor_name ?? '';
  $('#description').value = store.description ?? '';
  $('#contact_number').value = store.contact_number ?? '';
  $('#barangay').value = store.barangay ?? '';
  $('#purok').value = store.purok ?? '';
  $('#landmark_reference').value = store.landmark_reference ?? '';
  $('#open_time').value = store.open_time ?? '07:00';
  $('#close_time').value = store.close_time ?? '20:00';

  if (store.storefront_image_url) {
    storefrontUrl = store.storefront_image_url;
    $('#storefront-preview').src = storefrontUrl;
    $('#storefront-preview').style.display = 'block';
    $('#storefront-upload').style.display = 'none';
  }

  if (Array.isArray(store.accepted_payments)) {
    form.querySelectorAll('input[name="payments"]').forEach(cb => { cb.checked = false; });
    store.accepted_payments.forEach(p => {
      const cb = form.querySelector(`input[name="payments"][value="${p}"]`);
      if (cb) cb.checked = true;
    });
  }

  if (store.lat && store.lng) {
    $('#lat').value = store.lat;
    $('#lng').value = store.lng;
    if (marker) marker.setLatLng([store.lat, store.lng]);
    else addMarker(store.lat, store.lng);
    map.setView([store.lat, store.lng], 17);
  }
}

function initMap(lat, lng) {
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    // Load Leaflet dynamically
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = 'anonymous';
    script.onload = () => createMap(lat, lng);
    document.head.appendChild(script);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } else {
    createMap(lat, lng);
  }
}

function createMap(lat, lng) {
  map = L.map('map', { zoomControl: true }).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', (e) => addMarker(e.latlng.lat, e.latlng.lng));
}

function addMarker(lat, lng) {
  if (marker) marker.remove();
  marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    $('#lat').value = pos.lat.toFixed(6);
    $('#lng').value = pos.lng.toFixed(6);
  });
  $('#lat').value = lat.toFixed(6);
  $('#lng').value = lng.toFixed(6);
}

function bindEvents() {
  // Step navigation
  $('#next-1')?.addEventListener('click', () => validateStep1() && goToStep(2));
  $('#next-2')?.addEventListener('click', () => {
    if (!requireStorefrontPhoto()) {
      $('#storefront-upload').focus();
      return;
    }
    goToStep(3);
  });
  $('#back-2')?.addEventListener('click', () => goToStep(1));
  $('#back-3')?.addEventListener('click', () => goToStep(2));

  // Location buttons
  $('#use-my-location')?.addEventListener('click', useMyLocation);
  $('#pick-on-map')?.addEventListener('click', () => {
    showMsg('Click on the map to set location', 'info');
  });

  // Photo uploads
  setupPhotoUpload('storefront');
  setupPhotoUpload('permits');

  // Form submit
  form.addEventListener('submit', handleSubmit);
}

function setupPhotoUpload(type) {
  const uploadEl = $(`#${type}-upload`);
  const fileInput = $(`#${type}-file`);
  const previewEl = $(`#${type}-preview`);

  uploadEl?.addEventListener('click', () => fileInput?.click());
  uploadEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput?.click();
    }
  });
  uploadEl?.addEventListener('dragover', (e) => { e.preventDefault(); uploadEl.style.borderColor = 'var(--primary)'; });
  uploadEl?.addEventListener('dragleave', () => uploadEl.style.borderColor = 'var(--line)');
  uploadEl?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadEl.style.borderColor = 'var(--line)';
    if (e.dataTransfer.files[0]) handleFileSelect(type, e.dataTransfer.files[0]);
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileSelect(type, e.target.files[0]);
  });
}

async function handleFileSelect(type, file) {
  const uploadEl = $(`#${type}-upload`);
  const previewEl = $(`#${type}-preview`);
  const session = await getSession();
  if (!session) return;

  uploadEl.style.opacity = '0.6';
  uploadEl.innerHTML = '<p class="muted">Uploading...</p>';

  const { error, url } = await uploadStoreImage(session.user.id, file, type);

  if (error) {
    showMsg(error.message, 'bad');
    uploadEl.style.opacity = '1';
    uploadEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted);margin-bottom:8px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p class="muted" style="margin:0">Click or drag to upload</p><p class="muted" style="font-size:.75rem;margin:4px 0 0">JPG, PNG, WebP • Max 5 MB</p>`;
    return;
  }

  if (type === 'storefront') storefrontUrl = url;
  if (type === 'permits') permitsUrl = url;

  previewEl.src = url;
  previewEl.style.display = 'block';
  uploadEl.style.display = 'none';
}

function useMyLocation() {
  if (!navigator.geolocation) {
    showMsg('Geolocation not supported', 'bad');
    return;
  }
  showMsg('Getting your location...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      addMarker(latitude, longitude);
      map.setView([latitude, longitude], 17);
      showMsg('Location set!', 'ok');
    },
    (err) => showMsg('Failed to get location: ' + err.message, 'bad'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function validateStep1() {
  const required = ['business_name', 'trade_category', 'proprietor_name', 'contact_number', 'barangay', 'landmark_reference', 'open_time', 'close_time'];
  for (const id of required) {
    const el = $(`#${id}`);
    if (!el.value.trim()) {
      showMsg(`Please fill in ${el.labels?.[0]?.textContent || id}`, 'bad');
      el.focus();
      return false;
    }
  }
  if (!$('#lat').value || !$('#lng').value) {
    showMsg('Please set your store location on the map', 'bad');
    return false;
  }
  const payments = Array.from(form.querySelectorAll('input[name="payments"]:checked')).map(cb => cb.value);
  if (payments.length === 0) {
    showMsg('Select at least one payment method', 'bad');
    return false;
  }
  return true;
}

function requireStorefrontPhoto() {
  if (storefrontUrl) return true;
  showMsg('Please upload a storefront photo before continuing.', 'bad');
  return false;
}

function goToStep(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !requireStorefrontPhoto()) step = 2;
  if (step === 3) buildReview();

  currentStep = step;
  Object.entries(steps).forEach(([num, el]) => {
    el.style.display = num == step ? 'block' : 'none';
  });
  if (step === 2 && !storefrontUrl) $('#storefront-upload').focus();

  // Update progress indicator
  [1, 2, 3].forEach(n => {
    const circle = $(`#step-indicator-${n} .step-circle`);
    const label = $(`#step-indicator-${n} .step-label`);
    if (n < step) {
      circle.style.background = 'var(--ok)';
      circle.style.color = '#fff';
      circle.textContent = '✓';
    } else if (n === step) {
      circle.style.background = 'var(--primary)';
      circle.style.color = '#fff';
      circle.textContent = n;
    } else {
      circle.style.background = 'var(--line)';
      circle.style.color = 'var(--muted)';
      circle.textContent = n;
    }
    label.style.fontWeight = n <= step ? '600' : '400';
    label.style.color = n <= step ? 'var(--ink)' : 'var(--muted)';
  });

  // Update URL
  const url = new URL(window.location.href);
  url.searchParams.set('step', step);
  window.history.replaceState({}, '', url);
}

function buildReview() {
  const payments = Array.from(form.querySelectorAll('input[name="payments"]:checked')).map(cb => cb.value);
  const content = $(`#review-content`);
  content.innerHTML = `
    <div style="display:grid;gap:12px">
      <div><strong>Business name:</strong> ${esc(form.business_name.value)}</div>
      <div><strong>Category:</strong> ${esc(CATS[form.trade_category.value] || form.trade_category.value)}</div>
      <div><strong>Proprietor:</strong> ${esc(form.proprietor_name.value)}</div>
      ${form.description.value.trim() ? `<div><strong>About:</strong> ${esc(form.description.value.trim())}</div>` : ''}
      <div><strong>Contact:</strong> ${esc(form.contact_number.value)}</div>
      <div><strong>Location:</strong> ${esc(form.barangay.value)}, ${esc(form.purok.value || '—')}</div>
      <div><strong>Landmark:</strong> ${esc(form.landmark_reference.value)}</div>
      <div><strong>Coordinates:</strong> ${form.lat.value}, ${form.lng.value}</div>
      <div><strong>Hours:</strong> ${form.open_time.value} – ${form.close_time.value}</div>
      <div><strong>Payments:</strong> ${payments.map(p => esc(PAY[p] || p)).join(', ')}</div>
      <div><strong>Storefront photo:</strong> ${storefrontUrl ? '<span class="ok">Uploaded</span>' : '<span class="warn">None</span>'}</div>
      <div><strong>Permits:</strong> ${permitsUrl ? '<span class="ok">Uploaded</span>' : '<span class="warn">None (optional)</span>'}</div>
    </div>
  `;
}

async function handleSubmit(e) {
  e.preventDefault();
  msgEl.style.display = 'none';

  if (!validateStep1()) {
    goToStep(1);
    return;
  }

  if (!storefrontUrl) {
    goToStep(2);
    requireStorefrontPhoto();
    $('#storefront-upload').focus();
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const payments = Array.from(form.querySelectorAll('input[name="payments"]:checked')).map(cb => cb.value);

    // Generate TRN code: TRN-YYYY-NNN
    const year = new Date().getFullYear();
    const { data: countData } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true });
    const seq = String((countData?.count || 0) + 1).padStart(3, '0');
    const trnCode = `TRN-${year}-${seq}`;

    const storeData = {
      trn_code: trnCode,
      user_id: session.user.id,
      business_name: form.business_name.value.trim(),
      trade_category: form.trade_category.value,
      proprietor_name: form.proprietor_name.value.trim(),
      description: form.description.value.trim() || null,
      contact_number: form.contact_number.value.trim(),
      barangay: form.barangay.value,
      purok: form.purok.value.trim() || null,
      landmark_reference: form.landmark_reference.value.trim(),
      lat: parseFloat(form.lat.value),
      lng: parseFloat(form.lng.value),
      open_time: form.open_time.value,
      close_time: form.close_time.value,
      accepted_payments: payments,
      storefront_image_url: storefrontUrl,
      permits_image_url: permitsUrl,
      verification_status: 'PENDING',
      srp_compliant: false,
      dti_registered: false,
      bmbe_registered: false,
    };

    // Check if updating existing
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    let error;
    if (existing) {
      const res = await supabase.from('stores').update(storeData).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('stores').insert(storeData);
      error = res.error;
    }

    if (error) {
      console.error('Store submit error:', error.message, error.code, error.details, error.hint);
      throw error;
    }

    showMsg('Store submitted for verification! LGU will review within 3-5 business days.', 'ok');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    setTimeout(() => window.location.href = 'dashboard.html', 2000);
  } catch (err) {
    console.error('Submit error:', err);
    showMsg('Failed to submit. Please try again.', 'bad');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for verification';
  }
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}

init();