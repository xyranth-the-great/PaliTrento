import { renderChrome, $, esc, BARANGAYS, CATS, PAY } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { uploadStoreImage, uploadCertification } from './storage.js';
import { isSupabaseConfigured } from './auth.js';

const CERTIFICATE_TYPES = [
  { id: 'locational_clearance', label: 'Locational / Zoning Clearance' },
  { id: 'cedula', label: 'Community Tax Certificate (Cedula)' },
  { id: 'fire_safety', label: 'Fire Safety Inspection Certificate' },
  { id: 'sanitary_permit', label: 'Sanitary Permit' },
  { id: 'building_occupancy', label: 'Building Permit and Certificate of Occupancy' },
];

const form = $('#setup-form');
const msgEl = $('#setup-message');
const submitBtn = $('#submit-btn');

let currentStep = 1;
let map = null;
let marker = null;
let mapError = null;
let storefrontUrl = null;
let currentStore = null;
let existingCertifications = [];
const certificationFiles = new Map();

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

  // Bind controls before loading remote data so failures cannot leave the buttons inert.
  bindEvents();

  // Check if returning user has existing store
  const { data: existingStore, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (storeError) throw storeError;
  currentStore = existingStore;

  if (existingStore) {
    const { data: certifications, error: certificationError } = await supabase
      .from('store_certifications')
      .select('*')
      .eq('store_id', existingStore.id)
      .order('created_at');
    if (certificationError) throw certificationError;
    existingCertifications = certifications ?? [];
  }
  renderCertificationOptions();

  try {
    await initMap(existingStore?.lat ?? 8.0733, existingStore?.lng ?? 125.8689);
  } catch (error) {
    mapError = error;
    console.error('Store setup map error:', error);
    showMsg('The map could not be loaded. Check your connection and refresh to set your store location.', 'bad');
  }

  if (existingStore) {
    prefillForm(existingStore);
    configureReviewMode(existingStore);
  }

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

  if (store.lat != null && store.lng != null) {
    $('#lat').value = store.lat;
    $('#lng').value = store.lng;
    if (map) {
      addMarker(store.lat, store.lng);
      map.setView([store.lat, store.lng], 17);
    }
  }
}

function configureReviewMode(store) {
  if (store?.verification_status !== 'VERIFIED') return;

  $('#review-heading').textContent = 'Step 3: Review & Save Changes';
  $('#review-description').textContent = 'Review your updates before saving. Certificate approval is managed separately.';
  $('#review-notice').style.display = 'none';
  submitBtn.textContent = 'Save changes';
}

function renderCertificationOptions() {
  const container = $('#certification-options');
  const statusLabels = {
    REQUESTED: 'Requested by admin',
    PENDING: 'Under review',
    APPROVED: 'Approved',
    REJECTED: 'Replacement needed',
  };
  const statusClasses = {
    REQUESTED: 'warn',
    PENDING: 'info',
    APPROVED: 'ok',
    REJECTED: 'bad',
  };

  container.innerHTML = CERTIFICATE_TYPES.map((certificate) => {
    const existing = existingCertifications.find((item) => item.certificate_type === certificate.id);
    const selected = Boolean(existing?.required);
    const approved = existing?.review_status === 'APPROVED';
    const fileId = `certificate-file-${certificate.id}`;
    const status = existing?.review_status;
    const fileStatus = existing?.storage_path
      ? 'A certificate file is on record.'
      : 'No file submitted yet.';

    return `
      <div style="border:1px solid var(--line);border-radius:var(--r-lg);padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <label for="certificate-select-${certificate.id}" style="display:flex;align-items:flex-start;gap:10px">
            <input id="certificate-select-${certificate.id}" type="checkbox" data-cert-select="${certificate.id}" ${selected ? 'checked' : ''} ${existing?.required ? 'disabled' : ''}>
            <span><strong>${esc(certificate.label)}</strong></span>
          </label>
          ${status ? `<span class="pill ${statusClasses[status] || 'warn'}">${statusLabels[status] || status}</span>` : ''}
        </div>
        ${existing?.admin_notes ? `<p class="muted" style="margin:8px 0 0">${esc(existing.admin_notes)}</p>` : ''}
        <div data-cert-input-wrap="${certificate.id}" style="display:${selected ? 'block' : 'none'};margin-top:12px">
          <label class="btn alt" for="${fileId}" style="width:auto">Choose or replace file</label>
          <input id="${fileId}" type="file" data-cert-file="${certificate.id}" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none" ${approved ? 'disabled' : ''}>
          <p class="muted" data-cert-file-name="${certificate.id}" style="font-size:.8rem;margin:8px 0 0">${fileStatus} JPG, PNG, WebP or PDF, up to 10 MB.</p>
        </div>
      </div>
    `;
  }).join('');

  CERTIFICATE_TYPES.forEach((certificate) => {
    const checkbox = container.querySelector(`[data-cert-select="${certificate.id}"]`);
    const fileInput = container.querySelector(`[data-cert-file="${certificate.id}"]`);
    const fileName = container.querySelector(`[data-cert-file-name="${certificate.id}"]`);
    const inputWrap = container.querySelector(`[data-cert-input-wrap="${certificate.id}"]`);

    checkbox.addEventListener('change', () => {
      inputWrap.style.display = checkbox.checked ? 'block' : 'none';
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      certificationFiles.set(certificate.id, file);
      fileName.textContent = `Selected: ${file.name}`;
    });
  });

  const deadlineInfo = $('#compliance-deadline-info');
  if (currentStore?.compliance_approved_at) {
    deadlineInfo.textContent = 'All required certificates have been approved.';
  } else if (currentStore?.compliance_deadline_at) {
    const date = new Date(currentStore.compliance_deadline_at).toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    deadlineInfo.textContent = `Certificate approval deadline: ${date}. The timer continues while submitted files are under review.`;
  } else if (currentStore) {
    deadlineInfo.textContent = 'Your 15-day deadline will begin when an admin emails your compliance notice.';
  } else {
    deadlineInfo.textContent = 'Your 15-day deadline starts when you submit your store.';
  }
}

function initMap(lat, lng) {
  if (typeof L !== 'undefined') {
    return Promise.resolve(createMap(lat, lng));
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      try {
        resolve(createMap(lat, lng));
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error('Could not load the map library.'));
    document.head.appendChild(script);
  });
}

function createMap(lat, lng) {
  map = L.map('map', { zoomControl: true }).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', (e) => addMarker(e.latlng.lat, e.latlng.lng, true));
  mapError = null;
  return map;
}

function addMarker(lat, lng, notify = false) {
  if (!map) {
    showMsg(mapError
      ? 'The map is unavailable. Check your connection and refresh to try again.'
      : 'The map is still loading. Please wait a moment and try again.', 'bad');
    return false;
  }

  if (marker) marker.remove();
  marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    $('#lat').value = pos.lat.toFixed(6);
    $('#lng').value = pos.lng.toFixed(6);
    showMsg('Store location updated.', 'ok');
  });
  $('#lat').value = lat.toFixed(6);
  $('#lng').value = lng.toFixed(6);
  if (notify) showMsg('Store location selected.', 'ok');
  return true;
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
    if (!map) {
      showMsg(mapError
        ? 'The map is unavailable. Check your connection and refresh to try again.'
        : 'The map is still loading. Please wait a moment and try again.', 'bad');
      return;
    }
    showMsg('Click the map or drag the marker to set your store location.', 'info');
  });

  // Photo uploads
  setupPhotoUpload('storefront');

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

  previewEl.src = url;
  previewEl.style.display = 'block';
  uploadEl.style.display = 'none';
}

function useMyLocation() {
  if (!map) {
    showMsg(mapError
      ? 'The map is unavailable. Check your connection and refresh to try again.'
      : 'The map is still loading. Please wait a moment and try again.', 'bad');
    return;
  }

  if (!navigator.geolocation) {
    showMsg('Location access is not supported by this browser.', 'bad');
    return;
  }
  showMsg('Requesting your location. Allow location access if prompted.', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (addMarker(latitude, longitude)) {
        map.setView([latitude, longitude], 17);
      }
    },
    (err) => {
      const message = err.code === err.PERMISSION_DENIED
        ? 'Location permission was denied. Allow it in your browser settings or choose a location on the map.'
        : err.code === err.POSITION_UNAVAILABLE
          ? 'Your current location is unavailable. Choose a location on the map instead.'
          : 'Location request timed out. Try again or choose a location on the map.';
      showMsg(message, 'bad');
    },
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
    showMsg(mapError
      ? 'The map is unavailable. Check your connection and refresh to set your store location.'
      : !map
        ? 'The map is still loading. Please wait a moment and try again.'
        : 'Please set your store location on the map.', 'bad');
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
  msgEl.textContent = '';
  msgEl.className = 'muted';
  Object.entries(steps).forEach(([num, el]) => {
    el.style.display = num == step ? 'block' : 'none';
  });
  $('.setup-progress').setAttribute('aria-valuenow', String(step));
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
  const certificates = Array.from($('#certification-options').querySelectorAll('[data-cert-select]:checked'))
    .map((checkbox) => CERTIFICATE_TYPES.find((certificate) => certificate.id === checkbox.dataset.certSelect)?.label)
    .filter(Boolean);
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
      <div><strong>Certificates selected:</strong> ${certificates.length ? certificates.map(esc).join(', ') : '<span class="warn">None yet</span>'}</div>
    </div>
  `;
}

async function saveSelectedCertifications(storeId, userId) {
  const selected = Array.from($('#certification-options').querySelectorAll('[data-cert-select]:checked'));
  const submitted = [];

  for (const checkbox of selected) {
    const certificateType = checkbox.dataset.certSelect;
    const file = certificationFiles.get(certificateType);
    if (!file) continue;

    const { error: uploadError, path } = await uploadCertification(userId, certificateType, file);
    if (uploadError) throw new Error(`${CERTIFICATE_TYPES.find((item) => item.id === certificateType)?.label}: ${uploadError.message}`);

    const { error } = await supabase
      .from('store_certifications')
      .upsert({
        store_id: storeId,
        certificate_type: certificateType,
        storage_path: path,
        required: true,
        review_status: 'PENDING',
        admin_notes: null,
        submitted_at: new Date().toISOString(),
        submission_notified_at: null,
        reviewed_at: null,
        reviewed_by: null,
      }, { onConflict: 'store_id,certificate_type' });
    if (error) throw error;

    certificationFiles.delete(certificateType);
    submitted.push(certificateType);
  }

  return submitted;
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

  submitBtn.disabled = true;
  let isApprovedUpdate = currentStore?.verification_status === 'VERIFIED';
  submitBtn.textContent = isApprovedUpdate ? 'Saving...' : 'Submitting...';

  try {
    const session = await getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    const payments = Array.from(form.querySelectorAll('input[name="payments"]:checked')).map(cb => cb.value);

    const { data: matchingStore, error: existingError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    const existing = matchingStore
      ?? (currentStore?.user_id === session.user.id ? currentStore : null);
    isApprovedUpdate = existing?.verification_status === 'VERIFIED';

    const storeData = {
      trn_code: existing?.trn_code || createTrnCode(),
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
      storefront_image_url: storefrontUrl || existing?.storefront_image_url || null,
      permits_image_url: existing?.permits_image_url || null,
      verification_status: isApprovedUpdate ? 'VERIFIED' : 'PENDING',
      srp_compliant: isApprovedUpdate ? existing.srp_compliant : false,
      dti_registered: isApprovedUpdate ? existing.dti_registered : false,
      bmbe_registered: isApprovedUpdate ? existing.bmbe_registered : false,
    };

    let error;
    let savedStoreId = existing?.id ?? null;
    if (existing) {
      const res = await supabase
        .from('stores')
        .update(storeData)
        .eq('id', existing.id)
        .select('id')
        .single();
      error = res.error;
      if (!error) savedStoreId = res.data.id;
    } else {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await supabase.from('stores').insert(storeData).select('id').single();
        error = res.error;
        if (!error) savedStoreId = res.data.id;
        if (!error || !isDuplicateTrnCodeError(error)) break;
        storeData.trn_code = createTrnCode();
      }
    }

    if (error) {
      console.error('Store submit error:', error.message, error.code, error.details, error.hint);
      throw error;
    }

    if (!savedStoreId) throw new Error('The store was saved, but its ID could not be loaded.');

    const submittedCertificates = await saveSelectedCertifications(savedStoreId, session.user.id);
    let emailNoticeError = null;
    const hasUnnotifiedCertificates = existingCertifications.some((certificate) =>
      certificate.review_status === 'PENDING'
      && certificate.storage_path
      && !certificate.submission_notified_at
    );
    if (submittedCertificates.length || hasUnnotifiedCertificates) {
      const { data, error: notifyError } = await supabase.functions.invoke('manage-certifications', {
        body: { action: 'submitted', storeId: savedStoreId },
      });
      if (notifyError || data?.success !== true) {
        emailNoticeError = notifyError?.message || data?.error || 'Email confirmation was not sent.';
        console.error('Certificate email notification failed:', emailNoticeError);
      }
    }

    const message = emailNoticeError
      ? `Store and certificates saved, but the confirmation email could not be sent: ${emailNoticeError}`
      : submittedCertificates.length
        ? 'Certificates submitted for review. Admin review usually takes about 24 hours; the 15-day timer remains until approval.'
        : isApprovedUpdate
          ? 'Store changes saved.'
          : 'Store submitted. Your 15-day certificate deadline has started.';
    showMsg(message, emailNoticeError ? 'warn' : 'ok');
    submitBtn.disabled = true;
    submitBtn.textContent = isApprovedUpdate ? 'Changes saved' : 'Submitted';

    currentStore = { ...currentStore, id: savedStoreId };
    existingCertifications = await supabase
      .from('store_certifications')
      .select('*')
      .eq('store_id', savedStoreId)
      .order('created_at')
      .then(({ data, error: refreshError }) => {
        if (refreshError) throw refreshError;
        return data ?? [];
      });
    renderCertificationOptions();
    setTimeout(() => window.location.href = 'dashboard.html', emailNoticeError ? 5000 : 2000);
  } catch (err) {
    console.error('Submit error:', err);
    const detail = getSubmitErrorMessage(err);
    showMsg(`Failed to submit: ${detail}`, 'bad');
    submitBtn.disabled = false;
    submitBtn.textContent = isApprovedUpdate ? 'Save changes' : 'Submit for verification';
  }
}

function createTrnCode() {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `TRN-${new Date().getFullYear()}-${suffix}`;
}

function isDuplicateTrnCodeError(error) {
  return error?.code === '23505' &&
    (error.constraint === 'stores_trn_code_key' || error.message?.includes('stores_trn_code_key'));
}

function getSubmitErrorMessage(error) {
  if (isDuplicateTrnCodeError(error)) {
    return 'A store reference was already in use. Please try submitting again.';
  }
  if (error?.code === '23514' && error?.constraint === 'stores_trade_category_check') {
    return 'Your Supabase database does not allow this store category yet. Run supabase/store-submission.sql in the Supabase SQL Editor, then try again.';
  }
  if (error?.code === 'PGRST204' || error?.code === '42703') {
    return 'The stores table is missing fields required for submission. Run supabase/store-submission.sql in your Supabase SQL Editor, then try again.';
  }
  if (error?.code === '42501') {
    return 'Supabase blocked this submission. Run supabase/store-submission.sql to configure store-owner permissions, then try again.';
  }

  return error?.message || error?.details || error?.hint || 'Please check your details and try again.';
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
  msgEl.style.display = 'block';
}

init().catch((error) => {
  console.error('Store setup initialization error:', error);
  showMsg('Could not load your store details. Please refresh and try again.', 'bad');
});