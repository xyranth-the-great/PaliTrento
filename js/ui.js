import './splash.js';
import '../css/styles.css';
import logoUrl from '../logo.png';
import {
  LiquidChrome,
  ensureLiquidChromeStill,
  registerPremiumTubeFrame,
  unregisterPremiumTubeFrame
} from './liquid-chrome.js';
export const $ = (s, r = document) => r.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0 });
export const premiumSellerLabel = className => `<span class="chrome-pill ${className}" role="img" aria-label="Premium seller"><span class="chrome-pill-icon" aria-hidden="true">✦</span><span class="chrome-pill-text">Premium</span></span>`;
const premiumChromeInstances = new WeakMap();
const observedPremiumFrames = new WeakSet();

function getPremiumFrames(node) {
  if (!(node instanceof Element)) return [];
  const frames = node.matches('.premium-frame') ? [node] : [];
  frames.push(...node.querySelectorAll('.premium-frame'));
  return frames;
}

if (typeof MutationObserver === 'function' && document.body) {
  const observeNode = node => {
    getPremiumFrames(node).forEach(frame => {
      if (observedPremiumFrames.has(frame)) return;
      observedPremiumFrames.add(frame);
      registerPremiumTubeFrame(frame);
    });
  };
  const unobserveNode = node => {
    getPremiumFrames(node).forEach(frame => {
      unregisterPremiumTubeFrame(frame);
      observedPremiumFrames.delete(frame);
    });
  };

  observeNode(document.body);
  const premiumFrameMutationObserver = new MutationObserver(records => {
    records.forEach(record => {
      record.removedNodes.forEach(unobserveNode);
      record.addedNodes.forEach(observeNode);
    });
  });
  premiumFrameMutationObserver.observe(document.body, { childList: true, subtree: true });
}

export function attachPremiumLiquidShader(surface, options = {}) {
  const existing = premiumChromeInstances.get(surface);
  if (existing) {
    if (options.live !== undefined) existing.setLive(options.live);
    return existing;
  }

  ensureLiquidChromeStill();
  const chrome = new LiquidChrome(surface, {
    radius: options.radius ?? 'inherit',
    zoom: options.zoom ?? 3.4,
    live: options.live ?? true
  });
  premiumChromeInstances.set(surface, chrome);
  return chrome;
}

export function setPremiumLiquidLive(surface, live) {
  premiumChromeInstances.get(surface)?.setLive(live);
}

export function removePremiumLiquidShader(surface) {
  premiumChromeInstances.get(surface)?.destroy();
  premiumChromeInstances.delete(surface);
}

export function setPlanBadge(element, text, className, isPremium = false) {
  removePremiumLiquidShader(element);

  element.className = className;
  if (!isPremium) {
    element.textContent = text;
    return;
  }

  element.classList.remove('ok', 'warn', 'bad', 'off', 'info');
  element.classList.add('chrome-pill', 'premium-video-label');
  element.replaceChildren();
  if (text.trim().startsWith('✦')) {
    const icon = document.createElement('span');
    icon.className = 'chrome-pill-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✦';
    element.append(icon);
  }
  const label = document.createElement('span');
  label.className = 'chrome-pill-text';
  label.textContent = text.replace(/^\s*✦\s*/, '');
  element.append(label);
}

export function renderFreePlanUsage(entitlement, planDetails) {
  const quotaValue = Number(planDetails?.free_listing_quota);
  const quota = Number.isFinite(quotaValue) && quotaValue >= 0
    ? Math.floor(quotaValue)
    : 15;
  const usedValue = Number(entitlement?.free_listings_used);
  const used = Number.isFinite(usedValue) ? Math.max(0, Math.floor(usedValue)) : 0;
  const remainingValue = Number(entitlement?.remaining_free);
  const hasRemainingValue = entitlement?.remaining_free !== null
    && entitlement?.remaining_free !== undefined
    && entitlement?.remaining_free !== ''
    && Number.isFinite(remainingValue);
  const remaining = hasRemainingValue
    ? Math.min(quota, Math.max(0, Math.floor(remainingValue)))
    : Math.max(0, quota - used);
  const usedForProgress = Math.min(used, quota);
  const progress = quota ? (usedForProgress / quota) * 100 : 0;
  const progressTrack = $('#sub-free-progress');

  $('#sub-free-used').textContent = String(used);
  $('#sub-free-quota').textContent = String(quota);
  progressTrack.setAttribute('aria-valuemax', String(quota));
  progressTrack.setAttribute('aria-valuenow', String(usedForProgress));
  progressTrack.classList.toggle('is-near-limit', quota > 0 && usedForProgress / quota >= 0.8);
  progressTrack.classList.toggle('is-full', quota > 0 && usedForProgress >= quota);
  $('#sub-free-progress-fill').style.width = `${progress}%`;

  const caption = $('#sub-free-caption');
  if (remaining === 0) {
    caption.textContent = `You’ve used all ${quota} free listings. Extra listings are ₱1 each.`;
  } else if (quota > 0 && usedForProgress / quota >= 0.8) {
    caption.innerHTML = `Only <strong>${remaining}</strong> free listings left.`;
  } else {
    caption.innerHTML = `<strong>${remaining}</strong> listings left.`;
  }
}

export const CATS = { SARI_SARI: 'Sari-sari store', CARINDERIA: 'Carinderia', FRESH_PRODUCE: 'Fresh produce', PHARMACY: 'Pharmacy', SERVICES: 'Services', PRODUCT: 'Product', AGRI: 'Agri supply' };
export const UNITS = { KG: 'kg', PC: 'pc', POUCH: 'pouch', BOTTLE: 'bottle', SACK_25KG: '25-kg sack', TIE: 'tie' };
export const PAY = { CASH: 'Cash', GCASH: 'GCash' };
// Check this list against the official PSGC barangay list for Trento before launch.
export const BARANGAYS = ['Basa','Cebolin','Cuevas','Kapatungan','Langasian','Manat','Pangyan','Poblacion','Pulang Lupa','Salvacion','San Ignacio','San Isidro','San Roque','Santa Maria','Sto. Niño','Tudela'];

// Prevent tree-shaking: use CATS and BARANGAYS in a side-effecting function
function _preventTreeShaking() {
  return { CATS, BARANGAYS };
}
_preventTreeShaking();

export function getCategoriesAndBarangays() {
  return { CATS, BARANGAYS };
}

if (typeof window !== 'undefined') {
  window.__PALITRENTO_CATEGORIES = { CATS, BARANGAYS };
}

const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function isOpen(s) {
  if (!s.open_time || !s.close_time) return false;
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  return now >= mins(s.open_time) && now < mins(s.close_time);
}
const clock = t => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
export const hours = s => `${clock(s.open_time)} to ${clock(s.close_time)}`;

export const openPill = s => isOpen(s) ? '<span class="pill ok">Open now</span>' : '<span class="pill off">Closed</span>';
export const badges = s => [
  s.dti_registered ? '<span class="pill info">DTI registered</span>' : '',
  s.bmbe_registered ? '<span class="pill info">BMBE</span>' : '',
  s.srp_compliant ? '<span class="pill ok">Follows price caps</span>' : ''
].join('');

/**
 * Get public store status badge for store cards (explore, home)
 * Only shows "Verified" when the store and all three permits are approved.
 */
export function getPublicStoreStatusBadge(store) {
  if (!store) return '';

  const hasAllPermits = [
    store.barangay_clearance_image_url,
    store.cedula_image_url,
    store.business_permit_image_url
  ].every(url => typeof url === 'string' && url.trim());

  if (store.approval_status === 'APPROVED'
      && store.certificate_status === 'APPROVED'
      && hasAllPermits) {
    return '<span class="pill ok">Verified</span>';
  }

  return '';
}

/**
 * Get store status badge from display status object (returned by get_store_display_status RPC)
 * This is the single source of truth for rendering store status badges across the app.
 * @param {Object} status - Object from get_store_display_status RPC
 * @returns {string} HTML string for the badge
 */
export function getStoreStatusBadge(status) {
  if (!status) {
    return '<span class="pill warn">Unknown</span>';
  }
  const badgeClass = status.badge_class || 'warn';
  const label = status.label || status.status || 'Unknown';
  return `<span class="pill ${badgeClass}">${esc(label)}</span>`;
}

/**
 * Get store status message HTML.
 * @param {Object} status - Object from get_store_display_status RPC
 * @returns {string} HTML string for the status message
 */
export function getStoreStatusMessage(status) {
  if (!status || !status.message) return '';
  const cls = status.badge_class === 'bad' ? 'bad' : status.badge_class === 'ok' ? 'ok' : 'warn';
  return `<span class="pill status-message ${cls}" style="margin-top:8px;font-size:.8rem">${esc(status.message)}</span>`;
}

// ===== Password Strength Validation =====

/**
 * Password requirements configuration
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true
};

/**
 * Check password against requirements
 * @param {string} password - Password to check
 * @returns {Object} { valid: boolean, errors: string[], score: number (0-4) }
 */
export function checkPasswordStrength(password) {
  const errors = [];
  let score = 0;

  if (!password) {
    return { valid: false, errors: ['Password is required'], score: 0 };
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  } else {
    score += 1;
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('One uppercase letter (A-Z)');
  } else if (PASSWORD_REQUIREMENTS.requireUppercase) {
    score += 1;
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('One lowercase letter (a-z)');
  } else if (PASSWORD_REQUIREMENTS.requireLowercase) {
    score += 1;
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('One number (0-9)');
  } else if (PASSWORD_REQUIREMENTS.requireNumber) {
    score += 1;
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('One special character (!@#$%^&* etc.)');
  } else if (PASSWORD_REQUIREMENTS.requireSpecial) {
    score += 1;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 4) // 0-4 scale
  };
}

/**
 * Get human-readable password requirements list
 * @returns {string[]} Array of requirement strings
 */
export function getPasswordRequirementsList() {
  return [
    `At least ${PASSWORD_REQUIREMENTS.minLength} characters`,
    'One uppercase letter (A-Z)',
    'One lowercase letter (a-z)',
    'One number (0-9)',
    'One special character (!@#$%^&* etc.)'
  ];
}

/**
 * Create password strength indicator HTML
 * @param {string} inputId - ID of the password input to watch
 * @returns {string} HTML for strength indicator
 */
export function createPasswordStrengthIndicator(inputId) {
  return `
    <div class="password-strength" data-for="${inputId}" style="margin-top:8px">
      <div class="password-strength-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="4" style="height:4px;background:var(--line);border-radius:2px;overflow:hidden">
        <div class="password-strength-fill" style="width:0%;height:100%;transition:width .3s,background .3s;background:var(--bad)"></div>
      </div>
      <div class="password-strength-text muted" style="font-size:.7rem;margin-top:4px;min-height:1.2em"></div>
      <ul class="password-requirements muted" style="font-size:.7rem;margin:6px 0 0;padding-left:16px;display:none"></ul>
    </div>
  `;
}

/**
 * Initialize password strength indicator for an input
 * @param {string} inputId - ID of password input element
 * @param {Object} options - { showRequirements: boolean, onValid: callback }
 */
export function initPasswordStrength(inputId, options = {}) {
  const input = document.getElementById(inputId);
  const container = document.querySelector(`.password-strength[data-for="${inputId}"]`);
  if (!input || !container) return;

  const fill = container.querySelector('.password-strength-fill');
  const text = container.querySelector('.password-strength-text');
  const reqList = container.querySelector('.password-requirements');
  const { showRequirements = true, onValid } = options;

  // Populate requirements list
  if (showRequirements && reqList) {
    reqList.innerHTML = getPasswordRequirementsList()
      .map(req => `<li>${req}</li>`)
      .join('');
  }

  function updateStrength(password) {
    const result = checkPasswordStrength(password);
    const pct = (result.score / 4) * 100;
    const colors = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--info)', 'var(--ok)'];
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

    if (fill) {
      fill.style.width = `${pct}%`;
      fill.style.background = colors[result.score];
    }
    if (text) {
      text.textContent = password ? `Strength: ${labels[result.score]}` : '';
      text.style.color = colors[result.score];
    }
    if (reqList) {
      // Highlight met/unmet requirements
      const items = reqList.querySelectorAll('li');
      const checks = {
        length: password.length >= PASSWORD_REQUIREMENTS.minLength,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
      };
      if (items[0]) items[0].style.color = checks.length ? 'var(--ok)' : 'var(--muted)';
      if (items[1]) items[1].style.color = checks.upper ? 'var(--ok)' : 'var(--muted)';
      if (items[2]) items[2].style.color = checks.lower ? 'var(--ok)' : 'var(--muted)';
      if (items[3]) items[3].style.color = checks.number ? 'var(--ok)' : 'var(--muted)';
      if (items[4]) items[4].style.color = checks.special ? 'var(--ok)' : 'var(--muted)';
    }

    if (onValid && result.valid) onValid();
  }

  input.addEventListener('input', (e) => updateStrength(e.target.value));
  input.addEventListener('focus', () => { if (reqList) reqList.style.display = 'block'; });
  input.addEventListener('blur', () => { if (reqList) reqList.style.display = 'none'; });

  // Initial check
  updateStrength(input.value);
}

// Price vs Admin cap. Returns null when no cap is set.
export function srp(p) {
  if (p.lgu_srp_ceiling == null) return null;
  return p.current_price <= p.lgu_srp_ceiling
    ? { cls: 'ok', text: 'Within cap' }
    : { cls: 'bad', text: `Over cap by ${peso(p.current_price - p.lgu_srp_ceiling)}` };
}
export const storeCard = (s, isPremium = false) => {
  if (isPremium) ensureLiquidChromeStill();
  const frameStart = isPremium ? '<div class="premium-frame-inner">' : '';
  const frameEnd = isPremium ? '</div>' : '';
  const premiumChip = isPremium ? premiumSellerLabel('premium-card-chip') : '';
  // Format purok: if purely numeric, render as "Purok N"
  const formattedPurok = s.purok && /^\d+$/.test(String(s.purok).trim()) ? `Purok ${s.purok.trim()}` : s.purok;
  const placeParts = [s.barangay, formattedPurok].filter(Boolean);
  const place = placeParts.join(', ');
  const locationHtml = place ? `<span>in ${esc(place)}</span>` : '';
  return `
  <a class="card store-card${isPremium ? ' premium premium-frame' : ''}" href="/business/?trn=${encodeURIComponent(s.trn_code)}">
    ${isPremium ? '<canvas class="tube-bg" aria-hidden="true"></canvas>' : ''}
    ${frameStart}
    <div class="store-card-media">${s.storefront_image_url
      ? `<img src="${esc(s.storefront_image_url)}" alt="${esc(s.business_name)}" loading="lazy" decoding="async">`
      : '<div class="store-card-placeholder" aria-hidden="true"><span>No photo</span></div>'}${premiumChip}
    </div>
    <div class="store-card-content">
      <div class="row store-card-heading"><h3>${esc(s.business_name)}</h3>${openPill(s)}</div>
      <p class="store-card-meta"><span>${esc(CATS[s.trade_category])}</span> ${locationHtml}</p>
      <div class="store-card-badges">${badges(s)}${getPublicStoreStatusBadge(s)}</div>
    </div>
    ${frameEnd}
  </a>`;
};

/* Pikachu product card showcase additions */
const PK_CARD_IDS = ['2ca26369-62b9-4b6e-a814-b2f2659b6228'];
function isPkProduct(p) { return !!p && PK_CARD_IDS.includes(String(p.id)); }

function pkCardDecorations() {
  const fragment = document.createDocumentFragment();
  ['pk-ring', 'pk-holo', 'pk-glit'].forEach(className => {
    const element = document.createElement('span');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    fragment.appendChild(element);
  });
  const positions = [[-8,10],[96,6],[-10,48],[98,40],[-9,82],[97,76]];
  positions.forEach((position, index) => {
    const bolt = document.createElement('span');
    bolt.className = 'pk-bolt';
    bolt.setAttribute('aria-hidden', 'true');
    bolt.style.left = `${position[0]}%`;
    bolt.style.top = `${position[1]}%`;
    bolt.style.setProperty('--pk-r', `${((index * 47) % 70) - 35}deg`);
    bolt.style.animationDelay = `${index * 0.37}s`;
    bolt.style.animationDuration = `${2.8 + (index % 4) * 0.4}s`;
    bolt.innerHTML = '<svg viewBox="0 0 14 26" width="14" height="26"><path d="M8 0L1 14h5l-2 12 9-16H8z" fill="#FFE14D" stroke="#fff" stroke-width="1"/></svg>';
    fragment.appendChild(bolt);
  });
  return fragment;
}

function enhancePkProductCards() {
  if (!/^\/products\/?$/.test(window.location.pathname)) return;
  document.querySelectorAll('.product-card').forEach(card => {
    if (card.classList.contains('product-card--pk')) return;
    const link = card.matches('a[href*="product-detail"]')
      ? card
      : card.querySelector('a[href*="product-detail"]');
    if (!link) return;
    const id = new URL(link.href, window.location.href).searchParams.get('id');
    if (!isPkProduct({ id })) return;
    card.classList.add('product-card--pk');
    card.prepend(pkCardDecorations());
    card.querySelector('.product-card-content .price')?.classList.add('pk-price');
  });
}

enhancePkProductCards();
if (document.body && typeof MutationObserver === 'function') {
  new MutationObserver(enhancePkProductCards).observe(document.body, { childList: true, subtree: true });
}

export const FIRE_PRODUCT_IDS = ['55b671e1-b9b5-4109-acc7-73f7b61b7d0f'];

const FIRE_EMBERS = [
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

export function isFireProduct(p) {
  return !!p && FIRE_PRODUCT_IDS.indexOf(String(p.id)) !== -1;
}

export function fireDecorHtml() {
  return '<span class="pt-fire-ring" aria-hidden="true"></span>' +
    FIRE_EMBERS.map(function (e) {
      return '<span class="pt-ember" aria-hidden="true" style="--x:' + e[0] + ';--s:' + e[1] + ';--d:' + e[2] + ';--dur:' + e[3] + ';--dx:' + e[4] + '"></span>';
    }).join('');
}

export const productCard = (p, store, isPremiumStore = false) => {
  if (isPremiumStore) ensureLiquidChromeStill();
  const c = srp(p);

  const productHref = `/product-detail/?id=${encodeURIComponent(p.id)}`;

  // Use first image from image_urls array, fallback to image_url
  const imageUrl = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0)
    ? p.image_urls[0]
    : p.image_url;

  const media = `<div class="product-card-media">${imageUrl
      ? `<img src="${esc(imageUrl)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
      : '<div class="product-card-placeholder" aria-hidden="true"><span>No photo</span></div>'}
    </div>`;

  const soldAt = store
    ? `<p class="muted" style="margin-top:8px">Sold at ${isPremiumStore
      ? `<a class="premium-store-link" href="/business/?trn=${encodeURIComponent(store.trn_code)}">${esc(store.business_name)}</a>`
      : `<span style="color:var(--primary);font-weight:600">${esc(store.business_name)}</span>`}</p>`
    : '';

  const content = `<div class="product-card-content">
      <div class="row"><h3>${esc(p.name)}</h3>${p.in_stock ? '' : '<span class="pill bad">Out of stock</span>'}</div>
      <p class="price">${peso(p.current_price)} <span class="muted">per ${esc(UNITS[p.unit] || p.unit || 'pc')}</span></p>
      ${c ? `<span class="pill ${c.cls}">${c.text}</span><span class="muted">Cap ${peso(p.lgu_srp_ceiling)}</span>` : ''}
      ${soldAt}
    </div>`;

  const fireProduct = isFireProduct(p);

  if (fireProduct) {
    const fireDecoration = fireDecorHtml();
    if (!isPremiumStore) {
      return `<a class="card product-card product-card--fire" href="${productHref}">${fireDecoration}${media}${content}</a>`;
    }
    return `<article class="card product-card premium premium-frame product-card--fire">${fireDecoration}
    <canvas class="tube-bg" aria-hidden="true"></canvas>
    <a class="premium-frame-link" href="${productHref}" aria-label="View ${esc(p.name)}"></a>
    <div class="premium-frame-inner">
      ${media}
      ${content}
    </div>
  </article>`;
  }

  if (!isPremiumStore) {
    return `<a class="card product-card" href="${productHref}">${media}${content}</a>`;
  }
  return `<article class="card product-card premium premium-frame">
    <canvas class="tube-bg" aria-hidden="true"></canvas>
    <a class="premium-frame-link" href="${productHref}" aria-label="View ${esc(p.name)}"></a>
    <div class="premium-frame-inner">
      ${media}
      ${content}
    </div>
  </article>`;
};

export function initializeFeaturedProductsCarousel(section) {
  const carousel = section.querySelector('[data-featured-carousel]');
  const viewport = carousel.querySelector('.featured-products-viewport');
  const track = viewport.querySelector('.featured-products-grid');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Speed constant: 40px per second
  const MARQUEE_SPEED_PX_PER_SEC = 40;

  // Get original cards and count unique stores (dedupe by trn_code in href)
  const allCards = Array.from(track.children);
  if (!allCards.length) return;

  // Deduplicate by store ID (from href /business/?trn=TRN-...)
  const seenStoreIds = new Set();
  const uniqueCards = [];
  allCards.forEach(card => {
    const href = card.getAttribute('href') || '';
    const match = href.match(/trn=([^&]+)/);
    const storeId = match ? match[1] : href;
    if (!seenStoreIds.has(storeId)) {
      seenStoreIds.add(storeId);
      uniqueCards.push(card);
    }
  });

  const uniqueCount = uniqueCards.length;
  console.log('[FeaturedCarousel] Initializing with', uniqueCount, 'unique stores (total cards:', allCards.length, ')');

  const originalCount = uniqueCards.length;

  // Create pause/play button
  const pausePlayBtn = document.createElement('button');
  pausePlayBtn.type = 'button';
  pausePlayBtn.className = 'carousel-pause-play-btn';
  pausePlayBtn.setAttribute('aria-pressed', 'false');
  pausePlayBtn.setAttribute('aria-label', 'Pause featured stores');
  pausePlayBtn.innerHTML = `
    <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
    <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  `;
  pausePlayBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(20, 10, 0, 0.8);
    color: var(--amber-light);
    border: 1px solid var(--chrome-edge);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  `;
  carousel.style.position = 'relative';
  carousel.appendChild(pausePlayBtn);

  let isPaused = false;

  function setPaused(paused) {
    isPaused = paused;
    track.classList.toggle('marquee-paused', paused);
    pausePlayBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pausePlayBtn.setAttribute('aria-label', paused ? 'Play featured stores' : 'Pause featured stores');
    pausePlayBtn.querySelector('.pause-icon').style.display = paused ? 'none' : 'block';
    pausePlayBtn.querySelector('.play-icon').style.display = paused ? 'block' : 'none';
  }

  pausePlayBtn.addEventListener('click', () => setPaused(!isPaused));

  // ---- MARQUEE MODE ----
  // Wrap unique cards in slides
  track.innerHTML = '';
  const originalSlidesWrapped = uniqueCards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'featured-products-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${uniqueCount}`);
    track.appendChild(slide);
    slide.appendChild(card);
    return slide;
  });

  const originalSlidesArray = originalSlidesWrapped;

  // Rebuild loop function
  let rebuildTimeout = null;
  let resizeObserver = null;
  let intersectionObserver = null;

  function unregisterCloneFrames() {
    if (typeof unregisterPremiumTubeFrame === 'function') {
      track.querySelectorAll('.featured-products-slide[data-clone="true"] .premium-frame').forEach(frame => {
        unregisterPremiumTubeFrame(frame);
      });
    }
  }

  function rebuildLoop() {
    if (reduceMotion.matches) return;

    // Remove old clones
    unregisterCloneFrames();
    track.querySelectorAll('.featured-products-slide[data-clone="true"]').forEach(clone => clone.remove());

    const viewportWidth = viewport.clientWidth;
    if (viewportWidth <= 0) return;

    // Include each track gap so the wrap point lands on the next set's first card.
    const trackStyle = getComputedStyle(track);
    const trackGap = parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
    const setWidth = originalSlidesArray.reduce((width, slide) => width + slide.offsetWidth, 0)
      + trackGap * originalSlidesArray.length;

    if (setWidth <= 0) return;

    // Calculate number of sets needed
    const totalSets = Math.ceil(viewportWidth / setWidth) + 1;
    const clonesNeeded = totalSets - 1;

    console.log('[FeaturedCarousel] viewportWidth:', viewportWidth, 'setWidth:', setWidth, 'totalSets:', totalSets, 'clonesNeeded:', clonesNeeded);

    // Create clone sets
    for (let set = 0; set < clonesNeeded; set++) {
      originalSlidesArray.forEach((originalSlide, slideIndex) => {
        const clone = originalSlide.cloneNode(true);
        clone.setAttribute('data-clone', 'true');
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('aria-label', `Clone ${set + 2}, slide ${slideIndex + 1} of ${originalCount}`);
        clone.querySelectorAll('a, button').forEach(el => {
          el.setAttribute('tabindex', '-1');
          el.setAttribute('aria-hidden', 'true');
        });
        track.appendChild(clone);
      });
    }

    // Register premium frames in new clones
    if (typeof registerPremiumTubeFrame === 'function') {
      track.querySelectorAll('.featured-products-slide[data-clone="true"] .premium-frame').forEach(frame => {
        registerPremiumTubeFrame(frame);
      });
    }

    // Set loop distance EXACTLY to one set width
    track.style.setProperty('--marquee-shift', `-${setWidth}px`);

    // Set duration for constant speed (40px/sec)
    const durationSec = (setWidth / 40).toFixed(2);
    track.style.setProperty('--marquee-duration', `${durationSec}s`);
    track.style.animationDuration = `${durationSec}s`;

    // Assert
    console.assert(track.scrollWidth - setWidth >= viewport.clientWidth, 'Marquee is too short: gap would show');
  }

  // Initial build
  rebuildLoop();

  // Debounced rebuild on resize
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        // Restart animation cleanly
        track.style.animation = 'none';
        void track.offsetWidth; // force reflow
        track.style.animation = '';
      }, 150);
    });
    resizeObserver.observe(viewport);
  } else {
    window.addEventListener('resize', () => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        track.style.animation = 'none';
        void track.offsetWidth;
        track.style.animation = '';
      }, 150);
    }, { passive: true });
  }

  // IntersectionObserver for off-screen pause
  intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        setPaused(true);
      } else if (!isPaused) {
        setPaused(false);
      }
    });
  }, { rootMargin: '100px' });
  intersectionObserver.observe(carousel);

  // Visibility change pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      setPaused(true);
    } else if (!isPaused && intersectionObserver) {
      // Will be handled by intersection observer
    }
  });

  // Pause/Resume handlers
  function setPaused(paused) {
    track.classList.toggle('marquee-paused', paused);
    pausePlayBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pausePlayBtn.setAttribute('aria-label', paused ? 'Play featured stores' : 'Pause featured stores');
    pausePlayBtn.querySelector('.pause-icon').style.display = paused ? 'none' : 'block';
    pausePlayBtn.querySelector('.play-icon').style.display = paused ? 'block' : 'none';
  }

  pausePlayBtn.addEventListener('click', () => {
    const currentlyPaused = track.classList.contains('marquee-paused');
    setPaused(!currentlyPaused);
  });

  // Pause on hover
  viewport.addEventListener('mouseenter', () => setPaused(true));
  viewport.addEventListener('mouseleave', () => setPaused(false));

  // Pause on focus-within
  viewport.addEventListener('focusin', () => setPaused(true));
  viewport.addEventListener('focusout', () => setPaused(false));

  // Touch pause
  if (isTouchDevice) {
    let touchTimer = null;
    viewport.addEventListener('touchstart', () => {
      setPaused(true);
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });
    viewport.addEventListener('touchmove', () => {
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });
    viewport.addEventListener('touchend', () => {
      touchTimer = setTimeout(() => setPaused(false), 300);
    }, { passive: true });
    viewport.addEventListener('touchcancel', () => {
      touchTimer = setTimeout(() => setPaused(false), 300);
    }, { passive: true });
  }

  // Reduced motion handling
  function handleReduceMotionChange() {
    if (reduceMotion.matches) {
      track.style.animation = 'none';
      // Clean up clones
      unregisterCloneFrames();
      track.querySelectorAll('.featured-products-slide[data-clone="true"]').forEach(clone => clone.remove());
      pausePlayBtn.style.display = 'none';
      // Switch to static mode
      track.style.animation = 'none';
      track.style.width = 'max-content';
      track.style.gap = '24px';
      viewport.style.overflowX = 'auto';
      viewport.style.scrollSnapType = 'x mandatory';
      viewport.style.webkitOverflowScrolling = 'touch';
      viewport.style.scrollbarWidth = 'thin';
    } else if (uniqueCount > 0) {
      track.style.animation = '';
      track.style.width = '';
      track.style.gap = '';
      viewport.style.overflowX = '';
      viewport.style.scrollSnapType = '';
      viewport.style.scrollbarWidth = '';
      viewport.scrollLeft = 0;
      pausePlayBtn.style.display = 'flex';
      rebuildLoop();
    }
  }

  reduceMotion.addEventListener('change', handleReduceMotionChange);

  // Initial reduced motion check
  if (reduceMotion.matches) {
    handleReduceMotionChange();
  }

  // Initial build
  rebuildLoop();

  // Debounced rebuild on resize
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        track.style.animation = 'none';
        void track.offsetWidth;
        track.style.animation = '';
      }, 150);
    }).observe(viewport);
  } else {
    window.addEventListener('resize', () => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        track.style.animation = 'none';
        void track.offsetWidth;
        track.style.animation = '';
      }, 150);
    }, { passive: true });
  }

  // Pause on focus (keyboard)
  viewport.addEventListener('focusin', () => setPaused(true));
  viewport.addEventListener('focusout', () => setPaused(false));

  // Debug
  setTimeout(() => {
    const computed = getComputedStyle(track);
    console.log('[FeaturedCarousel] Mode:', reduceMotion.matches ? 'static' : 'marquee', '| Animation:', computed.animation, '| --marquee-shift:', track.style.getPropertyValue('--marquee-shift'), '| --marquee-duration:', track.style.getPropertyValue('--marquee-duration'), '| Unique stores:', uniqueCount);
  }, 1000);
}

export function initializeStoresCarousel(carousel) {
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = viewport.querySelector('.carousel-track');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Get original cards (rendered once in HTML)
  const allCards = Array.from(track.children);
  if (allCards.length <= 1) return;

  // Wrap each card in a slide div for scroll-snap
  const originalSlides = allCards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${allCards.length}`);
    track.replaceChild(slide, card);
    slide.appendChild(card);
    return slide;
  });

  const originalCount = originalSlides.length;
  console.log('[StoresCarousel] Initializing with', originalCount, 'original cards');

  // If fewer than 5 stores or reduced motion: static row, no marquee
  if (originalCount < 5 || reduceMotion.matches) {
    track.style.animation = 'none';
    track.style.width = 'max-content';
    track.style.gap = '0';
    viewport.style.overflowX = 'auto';
    viewport.style.scrollSnapType = 'x mandatory';
    return;
  }

  // ===== REBUILD LOOP (clones based on viewport width) =====
  let rebuildTimeout = null;
  let resizeObserver = null;

  function unregisterCloneFrames() {
    if (typeof unregisterPremiumTubeFrame === 'function') {
      track.querySelectorAll('.carousel-slide[data-clone="true"] .premium-frame').forEach(frame => {
        unregisterPremiumTubeFrame(frame);
      });
    }
  }

  function rebuildLoop() {
    if (reduceMotion.matches) return;

    // Remove old clones
    unregisterCloneFrames();
    track.querySelectorAll('.carousel-slide[data-clone="true"]').forEach(clone => clone.remove());

    const viewportWidth = viewport.clientWidth;
    if (viewportWidth <= 0) return;

    // Measure setWidth from original slides only
    let setWidth = 0;
    originalSlides.forEach(slide => {
      setWidth += slide.offsetWidth;
    });
    if (setWidth <= 0) return;

    // Calculate number of sets needed
    const totalSets = Math.ceil(viewportWidth / setWidth) + 1;
    const clonesNeeded = totalSets - 1;

    console.log('[StoresCarousel] viewportWidth:', viewportWidth, 'setWidth:', setWidth, 'totalSets:', totalSets, 'clonesNeeded:', clonesNeeded);

    // Create clone sets
    for (let set = 0; set < clonesNeeded; set++) {
      originalSlides.forEach((originalSlide, slideIndex) => {
        const clone = originalSlide.cloneNode(true);
        clone.setAttribute('data-clone', 'true');
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('aria-label', `Clone ${set + 2}, slide ${slideIndex + 1} of ${originalCount}`);
        // Disable links/buttons in clones for accessibility
        clone.querySelectorAll('a, button').forEach(el => {
          el.setAttribute('tabindex', '-1');
          el.setAttribute('aria-hidden', 'true');
        });
        track.appendChild(clone);
      });
    }

    // Register premium frames in new clones
    if (typeof registerPremiumTubeFrame === 'function') {
      track.querySelectorAll('.carousel-slide[data-clone="true"] .premium-frame').forEach(frame => {
        registerPremiumTubeFrame(frame);
      });
    }

    // Set loop distance EXACTLY to one set width
    track.style.setProperty('--marquee-shift', `-${setWidth}px`);

    // Set duration for 60px/sec speed
    const durationSec = (setWidth / 60).toFixed(2);
    track.style.setProperty('--marquee-duration', `${durationSec}s`);
    track.style.animationDuration = `${durationSec}s`;

    }

  // Initial build
  rebuildLoop();

  // Debounced rebuild on resize
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        // Restart animation cleanly
        track.style.animation = 'none';
        void track.offsetWidth; // force reflow
        track.style.animation = '';
      }, 150);
    });
    resizeObserver.observe(viewport);
  } else {
    window.addEventListener('resize', () => {
      clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(() => {
        rebuildLoop();
        track.style.animation = 'none';
        void track.offsetWidth;
        track.style.animation = '';
      }, 150);
    }, { passive: true });
  }

  // ===== DRAG TO SCROLL (with momentum) =====
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let animationFrame = null;
  let wasAnimating = false;

  function stopMarquee() {
    wasAnimating = !track.classList.contains('marquee-paused');
    if (wasAnimating) track.classList.add('marquee-paused');
  }

  function resumeMarquee() {
    if (wasAnimating) track.classList.remove('marquee-paused');
    wasAnimating = false;
  }

  function animateMomentum() {
    if (Math.abs(velocity) < 0.5) {
      velocity = 0;
      resumeMarquee();
      return;
    }
    viewport.scrollLeft += velocity;
    velocity *= 0.95; // friction
    animationFrame = requestAnimationFrame(animateMomentum);
  }

  // Use viewport for drag events, but prevent default on card links
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // only left click/touch
    // Don't drag if clicking on a link/button
    if (e.target.closest('a, button, input, select, textarea')) return;

    isDragging = true;
    startX = e.clientX;
    startScrollLeft = viewport.scrollLeft;
    lastX = e.clientX;
    lastTime = performance.now();
    velocity = 0;
    stopMarquee();
    viewport.style.scrollBehavior = 'auto';
    viewport.style.cursor = 'grabbing';
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const now = performance.now();
    const deltaX = e.clientX - lastX;
    const deltaTime = now - lastTime;
    velocity = deltaX / deltaTime * 16; // px per frame
    viewport.scrollLeft -= deltaX;
    lastX = e.clientX;
    lastTime = now;
  }, { passive: true });

  window.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    viewport.style.scrollBehavior = '';
    viewport.style.cursor = '';
    viewport.releasePointerCapture(e.pointerId);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animateMomentum();
  });

  window.addEventListener('pointercancel', () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.style.scrollBehavior = '';
    viewport.style.cursor = '';
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animateMomentum();
  });

  // Keyboard: pause on focus
  viewport.addEventListener('focusin', () => { track.classList.add('marquee-paused'); });
  viewport.addEventListener('focusout', () => { track.classList.remove('marquee-paused'); });

  // Respect reduced motion
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      track.style.animation = 'none';
      // Clean up clones
      unregisterCloneFrames();
      track.querySelectorAll('.carousel-slide[data-clone="true"]').forEach(clone => clone.remove());
    } else {
      rebuildLoop();
    }
  });

  // Debug: log animation state
  setTimeout(() => {
    const computed = getComputedStyle(track);
    console.log('[StoresCarousel] Animation:', computed.animation, '| --marquee-shift:', track.style.getPropertyValue('--marquee-shift'), '| --marquee-duration:', track.style.getPropertyValue('--marquee-duration'));
  }, 1000);
}

// Simple person icon SVG (24x24, currentColor for palette)
const PERSON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// Chevron down SVG
const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

// Notification bell SVG
const BELL_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

// Premium indicator SVG
const PREMIUM_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const CLOSE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>`;

/**
 * Check if user has active Premium subscription
 * Uses cached profile data or session metadata for quick check
 */
export function isUserPremium(profile, session) {
  // Quick check from cached profile or session metadata
  if (profile?.is_premium === true) return true;
  if (session?.user?.user_metadata?.is_premium === true) return true;
  if (profile?.subscription_status === 'PREMIUM') return true;
  return false;
}

/**
 * Update premium indicator in navigation
 */
export function updatePremiumIndicator(session, profile) {
  const avatarMenu = document.querySelector('#avatar-menu');
  if (!avatarMenu) return;

  const isPremium = isUserPremium(profile, session);
  let wrapper = avatarMenu.parentElement.querySelector('.premium-indicator-wrap');

  if (!isPremium) {
    const indicator = wrapper?.querySelector('.premium-profile-indicator');
    if (indicator?.getAttribute('aria-expanded') === 'true') indicator.click();
    if (indicator) removePremiumLiquidShader(indicator);
    wrapper?.remove();
    return;
  }

  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'premium-indicator-wrap';
    wrapper.innerHTML = `
      <button type="button" class="premium-profile-indicator premium-video-label chrome-pill" aria-label="Premium subscription details" aria-haspopup="dialog" aria-expanded="false" aria-controls="premium-details-popover">
        <span class="chrome-pill-icon" aria-hidden="true">${PREMIUM_SVG}</span><span class="chrome-pill-text">PRO</span>
      </button>
      <div id="premium-details-popover" class="premium-details-modal" role="dialog" aria-modal="true" aria-labelledby="premium-details-title" hidden>
        <section class="premium-details-shell" aria-label="Premium membership details">
          <div class="premium-details-panel premium-details-header">
            <div class="premium-details-heading">
              <h2 id="premium-details-title"><span aria-hidden="true">✦</span> Premium Plan</h2>
              <span class="premium-details-status"><span class="premium-details-status-dot" aria-hidden="true"></span>Active</span>
            </div>
            <button type="button" class="premium-details-close" aria-label="Close Premium details">
              ${CLOSE_SVG}
            </button>
          </div>
          <div class="premium-details-content">
            <div class="premium-details-panel premium-details-price">
              <strong data-premium-amount></strong>
              <span>/ month</span>
            </div>
            <p class="premium-details-panel premium-details-renewal">Next renewal · <strong data-premium-renewal></strong></p>
            <section class="premium-details-panel premium-details-benefits" aria-labelledby="premium-benefits-title">
              <h3 id="premium-benefits-title">Included with Premium</h3>
              <ul>
                <li><span class="premium-benefit-icon" aria-hidden="true">✦</span><span>Unlimited product listings</span></li>
                <li><span class="premium-benefit-icon" aria-hidden="true">✦</span><span>Highlighted product &amp; store cards</span></li>
                <li><span class="premium-benefit-icon" aria-hidden="true">✦</span><span>Priority placement in search</span></li>
                <li><span class="premium-benefit-icon" aria-hidden="true">✦</span><span>Your store, automatically featured</span></li>
              </ul>
            </section>
            <div class="premium-details-panel premium-details-footer">
              <button type="button" class="premium-details-manage">Manage Membership</button>
            </div>
          </div>
        </section>
      </div>
    `;

    const indicator = wrapper.querySelector('.premium-profile-indicator');
    const modal = wrapper.querySelector('.premium-details-modal');
    const shell = wrapper.querySelector('.premium-details-shell');
    const closeButton = wrapper.querySelector('.premium-details-close');
    const manageButton = wrapper.querySelector('.premium-details-manage');
    const premiumBanner = document.querySelector('#sub-premium-status');
    let previousBodyOverflow = '';

    function closeCard(returnFocus = true) {
      if (modal.hidden) return;
      modal.hidden = true;
      indicator.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      removePremiumLiquidShader(shell);
      setPremiumLiquidLive(premiumBanner, true);
      if (returnFocus) indicator.focus();
    }

    function closeOnBackdropClick(event) {
      if (event.target === modal) closeCard(true);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        closeCard(true);
      } else if (event.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )).filter(element => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
        } else if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    indicator.addEventListener('click', (event) => {
      event.stopPropagation();
      if (modal.hidden) {
        previousBodyOverflow = document.body.style.overflow;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        indicator.setAttribute('aria-expanded', 'true');
        setPremiumLiquidLive(premiumBanner, false);
        const saveData = Boolean(navigator.connection && navigator.connection.saveData);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const forcedColors = window.matchMedia('(forced-colors: active)').matches;
        attachPremiumLiquidShader(shell, { radius: 20, live: !saveData && !reducedMotion && !forcedColors });
        document.addEventListener('keydown', closeOnEscape);
        closeButton.focus();
      } else {
        closeCard(true);
      }
    });

    closeButton.addEventListener('click', () => closeCard(true));
    manageButton.addEventListener('click', () => {
      window.location.href = '/dashboard/#tab-subscription';
    });
    modal.addEventListener('click', closeOnBackdropClick);

    avatarMenu.insertAdjacentElement('afterend', wrapper);
  }

  const details = profile?.premium_details;
  const planEnd = details?.current_period_end ? new Date(details.current_period_end) : null;
  const renewalDate = planEnd && !Number.isNaN(planEnd.getTime())
    ? planEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'December 17, 2026';
  const monthlyPrice = Number.isFinite(details?.price_monthly_cents)
    ? peso(details.price_monthly_cents / 100)
    : '₱49';

  wrapper.querySelector('[data-premium-amount]').textContent = monthlyPrice;
  wrapper.querySelector('[data-premium-renewal]').textContent = renewalDate;
}

export function renderChrome(active, session = null, profile = null, userId = null) {
  const role = profile?.role ?? session?.user?.user_metadata?.role;
  const isBusinessOwner = role === 'business_owner';
  const isAdmin = role === 'admin';
  const isLoggedInBuyer = !!session && role !== 'admin';
  const showOrdersLink = !isAdmin
    && !['/login/', '/register/'].includes(active)
    && (isBusinessOwner
      || (!!session && role === 'customer'
      || (!['/explore/', '/map/', '/products/'].includes(active)
        && (active !== '/' || isLoggedInBuyer))));
  const links = [
    ['/', 'Home'],
    ...(isAdmin ? [['/admin/', 'Admin Dashboard']] : []),
    ['/explore/', 'Explore'],
    ['/map/', 'Map'],
    ['/products/', 'Products'],
    ...(isBusinessOwner ? [['/dashboard/#tab-products', 'My Products']] : []),
    ...(showOrdersLink ? [['/orders/', 'My Orders']] : [])
  ];
  let authLinks;
  if (session) {
    const avatarHtml = profile?.avatar_url
      ? `<img src="${esc(profile.avatar_url)}" alt="" width="36" height="36" style="border-radius:50%;object-fit:cover">`
      : PERSON_SVG;
    const userName = profile?.full_name ?? session.user.user_metadata?.full_name ?? 'User';
    const userEmail = session.user.email ?? '';
    const role = profile?.role ?? session.user.user_metadata?.role;
    const isBusinessOwner = role === 'business_owner';
    const isAdmin = role === 'admin';

    let extraLinks = '';
    if (isBusinessOwner) {
      extraLinks = `<a href="/dashboard/" class="avatar-dropdown-item" role="menuitem">Dashboard</a>`;
    } else if (isAdmin) {
      extraLinks = `<a href="/admin/" class="avatar-dropdown-item" role="menuitem">Admin Dashboard</a>`;
    }

    // Buyers, including sellers purchasing from other stores, can view their order history.
    const ordersLink = isAdmin
      ? ''
      : `<a href="/orders/" class="avatar-dropdown-item" role="menuitem">My Orders</a>`;

    // Notification bell (only for logged-in users)
    const bellHtml = `
      <div class="notification-menu" id="notification-menu">
        <button class="icon-btn notification-bell" aria-label="Notifications" data-unread="0">
          ${BELL_SVG}
        </button>
        <div class="notification-dropdown" role="menu" aria-label="Notifications" hidden>
          <div class="notification-dropdown-header">
            <h3>Notifications</h3>
            <button class="mark-all-read" aria-label="Mark all as read">Mark all read</button>
          </div>
          <div class="notification-dropdown-list" role="listbox"></div>
          <div class="notification-dropdown-footer"><a href="/advisories/">View all notifications</a></div>
        </div>
      </div>`;

    authLinks = `
      ${bellHtml}
      <div class="avatar-menu" id="avatar-menu">
        <a href="${isBusinessOwner ? '/dashboard/' : isAdmin ? '/admin/' : '/account/'}" class="avatar-btn"${active === '/account/' || active === '/dashboard/' || active === '/admin/' ? ' aria-current="page"' : ''} aria-label="My account" aria-haspopup="true" aria-expanded="false">
          ${avatarHtml}
          <span class="avatar-chevron">${CHEVRON_SVG}</span>
        </a>
        <div class="avatar-dropdown" role="menu" aria-label="Account options">
          <div class="avatar-dropdown-header">
            <span class="avatar-dropdown-name">${esc(userName)}</span>
            <span class="avatar-dropdown-email">${esc(userEmail)}</span>
          </div>
          ${extraLinks}
          ${ordersLink}
          <a href="/account/" class="avatar-dropdown-item" role="menuitem">My Account</a>
          <a href="/settings/" class="avatar-dropdown-item" role="menuitem">Settings</a>
          ${!isAdmin ? `<a href="/support/" class="avatar-dropdown-item" role="menuitem">Help & Support</a>` : ''}
          <button type="button" class="avatar-dropdown-item avatar-dropdown-logout" role="menuitem" id="avatar-logout-btn">Log out</button>
        </div>
      </div>`;
  } else {
    authLinks = `<a class="top-auth-link" href="/login/"${active === '/login/' ? ' aria-current="page"' : ''}>Log in</a>
       <a class="top-auth-link" href="/register/"${active === '/register/' ? ' aria-current="page"' : ''}>Register</a>`;
  }

  const top = $('#chrome-top');
  if (top) top.outerHTML = `<header id="chrome-top" class="top"><div class="wrap">
    <a class="logo" href="/" aria-label="PaliTrento home">
      <span class="logo-word"><span class="logo-pali">Pali</span><span class="logo-inline-mark"><img class="logo-mark" src="${logoUrl}" alt="" aria-hidden="true"></span><span class="logo-rento">rento</span></span>
    </a>
    <nav id="primary-navigation" aria-label="Main">${links.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <div class="top-actions">${authLinks}</div></div></header>`;
  const f = $('#chrome-foot');
  if (f) f.outerHTML = `<footer id="chrome-foot"><div class="wrap"><p><strong>PaliTrento</strong>. Tara, Palit Ta sa Trento!</p>
    <p>A local directory for the Municipality of Trento, Agusan del Sur. Price caps shown follow Admin advisories and may change weekly.</p></div></footer>`;

  // Initialize avatar dropdown after DOM update
  if (session) {
    initAvatarDropdown();
    initNotificationBell(session.user.id, isBusinessOwner);
    updatePremiumIndicator(session, profile);
  }
}

function initAvatarDropdown() {
  const menu = $('#avatar-menu');
  const btn = menu?.querySelector('.avatar-btn');
  const dropdown = menu?.querySelector('.avatar-dropdown');
  const logoutBtn = menu?.querySelector('#avatar-logout-btn');
  if (!menu || !btn || !dropdown) return;

  let isOpen = false;

  function openDropdown() {
    isOpen = true;
    dropdown.style.display = 'block';
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
  }

  function closeDropdown() {
    isOpen = false;
    dropdown.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', closeOnOutsideClick);
    document.removeEventListener('keydown', closeOnEscape);
  }

  function toggleDropdown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) closeDropdown();
    else openDropdown();
  }

  function closeOnOutsideClick(e) {
    if (!menu.contains(e.target)) closeDropdown();
  }

  function closeOnEscape(e) {
    if (e.key === 'Escape') closeDropdown();
  }

  // Desktop: hover to open
  menu.addEventListener('mouseenter', () => {
    if (window.innerWidth > 760) openDropdown();
  });
  menu.addEventListener('mouseleave', () => {
    if (window.innerWidth > 760) closeDropdown();
  });

  // Mobile: click to toggle
  btn.addEventListener('click', (e) => {
    if (window.innerWidth <= 760) {
      toggleDropdown(e);
    }
    // On desktop, let the link navigate to account.html (Option A)
  });

  // Logout button
  logoutBtn?.addEventListener('click', async () => {
    closeDropdown();
    const { signOut } = await import('./auth.js');
    const { error } = await signOut();
    if (!error) window.location.href = '/';
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760 && isOpen) closeDropdown();
  });
}

// ===== Realtime Advisory Toast =====
let advisoryChannel = null;

export async function startAdvisoryToastListener() {
  const { supabase } = await import('./supabase.js');
  const { getSession, getNotificationPreferences } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session || advisoryChannel) return;

  const prefs = await getNotificationPreferences(session.user.id);

  advisoryChannel = supabase
    .channel('advisory-toasts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'advisories',
        filter: `published_at=lte.${new Date().toISOString()}`
      },
      (payload) => {
        const advisory = payload.new;
        if (advisory.recipient_id && advisory.recipient_id !== session.user.id) return;
        // Only show toast for active advisories
        if (!advisory.expires_at || new Date(advisory.expires_at) > new Date()) {
          // Check if user wants price cap notifications (for PRICE_CAP category)
          if (advisory.category === 'PRICE_CAP' && !prefs.price_caps) {
            console.log('[AdvisoryToast] Price cap notifications disabled, skipping');
            return;
          }
          // Check store_announcements for ANNOUNCEMENT and GENERAL categories
          if ((advisory.category === 'ANNOUNCEMENT' || advisory.category === 'GENERAL') && !prefs.store_announcements) {
            console.log('[AdvisoryToast] Store announcements disabled, skipping');
            return;
          }
          showAdvisoryToast(advisory);
        }
      }
    )
    .subscribe((status) => {
      console.log('[AdvisoryToast] Subscription:', status);
    });
}

function showAdvisoryToast(advisory) {
  // Remove existing toast
  const existing = document.querySelector('.advisory-toast');
  if (existing) existing.remove();

  const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' }[advisory.category] || 'warn';
  const toast = document.createElement('div');
  toast.className = `advisory-toast ${catColor}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="advisory-toast-content">
      <span class="advisory-toast-cat pill ${catColor}">${advisory.category.replace('_', ' ')}</span>
      <div>
        <strong>${esc(advisory.title)}</strong>
        <p class="muted" style="margin:2px 0 0;font-size:.85rem">${esc(advisory.body)}</p>
      </div>
    </div>
    <button class="advisory-toast-close" aria-label="Dismiss">&times;</button>
  `;

  document.body.appendChild(toast);

  // Store advisory data for modal
  toast.dataset.advisory = JSON.stringify(advisory);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Click content to open detail modal
  toast.querySelector('.advisory-toast-content').addEventListener('click', async () => {
    clearTimeout(dismissTimer);
    dismissToast(toast);
    await openNotificationModal(advisory);
  });

  // Manual dismiss (close button)
  toast.querySelector('.advisory-toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(dismissTimer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ===== Notification Detail Modal =====
let notificationModal = null;

function createNotificationModal() {
  if (notificationModal) return notificationModal;

  const modal = document.createElement('div');
  modal.className = 'notification-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'notification-modal-title');
  modal.innerHTML = `
    <div class="notification-modal-overlay"></div>
    <div class="notification-modal-content">
      <div class="notification-modal-header">
        <span class="notification-modal-cat pill" id="notification-modal-cat"></span>
        <button class="notification-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="notification-modal-body">
        <h2 id="notification-modal-title"></h2>
        <p id="notification-modal-body" class="muted"></p>
        <div class="notification-modal-meta">
          <span id="notification-modal-time"></span>
          <span id="notification-modal-barangay"></span>
        </div>
      </div>
      <div class="notification-modal-footer">
        <a class="btn notification-modal-action" hidden></a>
        <button class="btn alt notification-modal-dismiss">Dismiss</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('.notification-modal-overlay').addEventListener('click', closeNotificationModal);
  modal.querySelector('.notification-modal-close').addEventListener('click', closeNotificationModal);
  modal.querySelector('.notification-modal-dismiss').addEventListener('click', closeNotificationModal);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeNotificationModal();
  });

  notificationModal = modal;
  return modal;
}

async function openNotificationModal(advisory) {
  // Always create fresh modal (previous one was removed on close)
  const modal = createNotificationModal();

  const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' }[advisory.category] || 'warn';

  modal.querySelector('#notification-modal-cat').textContent = advisory.category.replace('_', ' ');
  modal.querySelector('#notification-modal-cat').className = `notification-modal-cat pill ${catColor}`;
  modal.querySelector('#notification-modal-title').textContent = advisory.title;
  modal.querySelector('#notification-modal-body').textContent = advisory.body;
  modal.querySelector('#notification-modal-time').textContent = new Date(advisory.published_at).toLocaleString('en-PH');

  const actionLink = modal.querySelector('.notification-modal-action');
  actionLink.hidden = true;
  actionLink.removeAttribute('href');
  actionLink.textContent = '';
  if (advisory.action_url) {
    const actionUrl = new URL(advisory.action_url, window.location.origin);
    if (actionUrl.origin === window.location.origin) {
      actionLink.href = `${actionUrl.pathname}${actionUrl.search}${actionUrl.hash}`;
      actionLink.textContent = advisory.action_label || 'View details';
      actionLink.hidden = false;
    }
  }

  const barangayEl = modal.querySelector('#notification-modal-barangay');
  if (advisory.barangay) {
    barangayEl.textContent = `• ${advisory.barangay}`;
    barangayEl.style.display = 'inline';
  } else {
    barangayEl.style.display = 'none';
  }

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('show'));
  document.body.style.overflow = 'hidden';

  // Mark as read when opened and update badge
  if (advisory.id) {
    await markRead(advisory.id);
    const bell = $('#notification-menu .notification-bell');
    if (bell) await updateUnreadCount(bell);
  }
}

function closeNotificationModal() {
  if (!notificationModal) return;

  // Always restore body overflow immediately
  document.body.style.overflow = '';

  notificationModal.classList.remove('show');

  // Remove from DOM after animation
  const removeModal = () => {
    if (notificationModal && notificationModal.parentNode) {
      notificationModal.parentNode.removeChild(notificationModal);
    }
    notificationModal = null;
    document.body.style.overflow = '';
  };

  // Try transitionend
  const onTransitionEnd = () => {
    removeModal();
    notificationModal?.removeEventListener('transitionend', onTransitionEnd);
  };
  notificationModal.addEventListener('transitionend', onTransitionEnd, { once: true });

  // Safety timeout - force remove
  setTimeout(removeModal, 300);
}

export { ensureLiquidChromeStill, openNotificationModal };

/**
 * Show order status change toast
 */
export function showOrderStatusToast(orderId, status, message) {
  // Remove existing toast
  const existing = document.querySelector('.order-status-toast');
  if (existing) existing.remove();

  const statusColors = {
    CONFIRMED: 'ok',
    READY_FOR_PICKUP: 'info',
    COMPLETED: 'ok',
    CANCELLED: 'bad',
    EXPIRED: 'bad'
  };
  const statusLabels = {
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired - not picked up'
  };
  const color = statusColors[status] || 'info';
  const statusLabel = statusLabels[status] || status.replace(/_/g, ' ');

  // Create advisory-like object for modal
  const advisory = {
    id: `order-${orderId}`,
    title: `Order ${statusLabel}`,
    body: message,
    category: 'ORDER_STATUS',
    published_at: new Date().toISOString(),
    barangay: null
  };

  const toast = document.createElement('div');
  toast.className = `advisory-toast order-status-toast ${color}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.advisory = JSON.stringify(advisory);
  toast.innerHTML = `
    <div class="advisory-toast-content">
      <span class="advisory-toast-cat pill ${color}">Order ${esc(statusLabel)}</span>
      <div>
        <strong>${esc(message)}</strong>
        <p class="muted" style="margin:2px 0 0;font-size:.85rem">Order #${orderId.slice(0,8)}</p>
      </div>
    </div>
    <button class="advisory-toast-close" aria-label="Dismiss">&times;</button>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  // Click content to open detail modal
  toast.querySelector('.advisory-toast-content').addEventListener('click', async () => {
    clearTimeout(dismissTimer);
    dismissToast(toast);
    await openNotificationModal(advisory);
  });

  const dismissTimer = setTimeout(() => dismissToast(toast), 8000);
  toast.querySelector('.advisory-toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(dismissTimer);
    dismissToast(toast);
  });
}

export function stopAdvisoryToastListener() {
  if (advisoryChannel) {
    advisoryChannel.unsubscribe();
    advisoryChannel = null;
  }
}

// ===== Notification Bell =====
let notificationClickHandlerAdded = false;
const advisoryDataMap = new Map(); // Store advisory data by ID for modal
let notificationOrderCacheUserId = null;
let notificationOrderCache = [];
let messageNotificationChannel = null;
let messageNotificationUserId = null;
let orderStatusNotificationChannel = null;
let orderStatusNotificationUserId = null;
let notificationStoreCacheUserId = null;
let notificationStoreCache = [];
let reservationNotificationChannel = null;
let reservationNotificationUserId = null;

async function initNotificationBell(userId, isBusinessOwner) {
  const bell = $('#notification-menu .notification-bell');
  const dropdown = $('#notification-menu .notification-dropdown');
  const list = dropdown?.querySelector('.notification-dropdown-list');
  if (!bell || !dropdown || !list) return;

  bell.dataset.businessOwner = String(isBusinessOwner);
  startMessageNotificationListener(userId, isBusinessOwner);
  startOrderStatusNotificationListener(userId, isBusinessOwner);
  startReservationNotificationListener(userId, isBusinessOwner);

  // Toggle dropdown
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    if (!isOpen) {
      positionDropdown(bell, dropdown);
      list.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Loading...</div>';
      await loadNotifications(list, isBusinessOwner);
    }
  });

  // Close on outside click (only add once)
  if (!notificationClickHandlerAdded) {
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside the notification menu
      const menu = $('#notification-menu');
      if (menu && menu.contains(e.target)) return;
      dropdown.hidden = true;
    });
    notificationClickHandlerAdded = true;
  }

  // Prevent clicks inside dropdown from closing it
  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Mark all read
  dropdown.querySelector('.mark-all-read')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await markAllRead(isBusinessOwner);
    await updateUnreadCount(bell);
    await loadNotifications(list, isBusinessOwner);
  });

  // Initial load
  await updateUnreadCount(bell);
}

export async function getMessageNotificationOrders(supabase, userId) {
  if (notificationOrderCacheUserId === userId) return notificationOrderCache;

  const storeIds = await getOwnedStoreIds(supabase, userId);
  if (storeIds === null) return null;
  let query = supabase
    .from('orders')
    .select('id, buyer_id, store_id, stores(business_name, user_id)');
  if (storeIds.length) {
    query = query.or(`buyer_id.eq.${userId},store_id.in.(${storeIds.join(',')})`);
  } else {
    query = query.eq('buyer_id', userId);
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error('Load message notification orders error:', error);
    return null;
  }

  notificationOrderCacheUserId = userId;
  notificationOrderCache = orders || [];
  return notificationOrderCache;
}

export async function getOwnedStoreIds(supabase, userId) {
  if (notificationStoreCacheUserId === userId) return notificationStoreCache;

  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId);
  if (error) {
    console.error('Load owned stores error:', error);
    return null;
  }

  notificationStoreCacheUserId = userId;
  notificationStoreCache = (data || []).map(store => store.id);
  return notificationStoreCache;
}

export async function messageNotificationsEnabled(userId) {
  const { getNotificationPreferences } = await import('./auth.js');
  const preferences = await getNotificationPreferences(userId);
  return preferences.messages !== false;
}

async function orderNotificationsEnabled(userId) {
  const { getNotificationPreferences } = await import('./auth.js');
  const preferences = await getNotificationPreferences(userId);
  return preferences.orders !== false;
}

export async function getReservationNotifications(supabase, userId, limit = null, notificationsEnabled = null) {
  if (!(notificationsEnabled ?? await orderNotificationsEnabled(userId))) return [];

  const storeIds = await getOwnedStoreIds(supabase, userId);
  if (storeIds === null) return null;
  if (!storeIds.length) return [];

  let query = supabase
    .from('reservation_notifications')
    .select('id, order_id, created_at, read_at, orders(id, buyer_id, quantity, status, cancellation_reason, products(name))')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (limit !== null) query = query.limit(limit);

  const { data: notifications, error } = await query;
  if (error) {
    console.error('Load reservation notifications error:', error);
    return null;
  }

  const orderIds = [...new Set((notifications || []).map(notification => notification.order_id))];
  const buyerNameResults = await Promise.all(orderIds.map(async orderId => {
    const { data: name, error: nameError } = await supabase.rpc(
      'get_order_customer_name',
      { p_order_id: orderId }
    );
    if (nameError) console.error('Load reservation customer name error:', nameError);
    return [orderId, name || 'Customer'];
  }));
  const buyerNames = new Map(buyerNameResults);

  return (notifications || []).map(notification => ({
    ...notification,
    buyer_name: buyerNames.get(notification.order_id) || 'Customer'
  }));
}

export async function markReservationNotificationRead(supabase, notificationId, userId) {
  return supabase
    .from('reservation_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('owner_id', userId)
    .is('read_at', null);
}

export async function getOrderStatusNotifications(supabase, userId, limit = null, notificationsEnabled = null) {
  if (notificationsEnabled === null) notificationsEnabled = await orderNotificationsEnabled(userId);

  let query = supabase
    .from('order_status_notifications')
    .select('id, order_id, previous_status, new_status, created_at, read_at, orders(ready_at, cancellation_reason, products(name), stores(business_name))')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });
  if (!notificationsEnabled) query = query.in('new_status', ['READY_FOR_PICKUP', 'EXPIRED']);
  if (limit !== null) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('Load order status notifications error:', error);
    return null;
  }
  return data || [];
}

export function pickupDeadlineNotice(readyAt) {
  const deadlineMs = readyAt ? Date.parse(readyAt) + 72 * 60 * 60 * 1000 : NaN;
  const deadline = Number.isFinite(deadlineMs)
    ? new Date(deadlineMs).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  return `Please pick it up within 72 hours${deadline ? `, by ${deadline}` : ''}. If it is not collected, the reservation will be automatically cancelled.`;
}

export async function markOrderStatusNotificationRead(supabase, notificationId, userId) {
  return supabase
    .from('order_status_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('buyer_id', userId)
    .is('read_at', null);
}

async function getNotificationDismissedIds(supabase, userId, notificationType, notificationIds = null) {
  const dismissedIds = new Set();
  const pageSize = 1000;

  if (notificationIds !== null) {
    const uniqueIds = [...new Set(notificationIds)];
    for (let index = 0; index < uniqueIds.length; index += 100) {
      const { data, error } = await supabase
        .from('notification_dismissals')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .in('notification_id', uniqueIds.slice(index, index + 100));
      if (error) {
        console.error('Load notification dismissals error:', error);
        return null;
      }
      (data || []).forEach(row => dismissedIds.add(row.notification_id));
    }
    return dismissedIds;
  }

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('notification_dismissals')
      .select('notification_id')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .order('notification_id')
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Load notification dismissals error:', error);
      return null;
    }
    (data || []).forEach(row => dismissedIds.add(row.notification_id));
    if (!data || data.length < pageSize) break;
  }
  return dismissedIds;
}

export async function getNotificationDismissals(supabase, userId, notifications) {
  const idsByType = new Map();
  for (const notification of notifications) {
    if (!idsByType.has(notification.type)) idsByType.set(notification.type, []);
    idsByType.get(notification.type).push(notification.id);
  }

  const dismissedKeys = new Set();
  const dismissalResults = await Promise.all(
    [...idsByType].map(async ([type, ids]) => [
      type,
      await getNotificationDismissedIds(supabase, userId, type, ids)
    ])
  );
  for (const [type, dismissedIds] of dismissalResults) {
    if (dismissedIds === null) return null;
    dismissedIds.forEach(id => dismissedKeys.add(`${type}:${id}`));
  }
  return dismissedKeys;
}

export async function dismissNotifications(supabase, userId, notifications) {
  const rows = notifications.map(notification => ({
    user_id: userId,
    notification_type: notification.type,
    notification_id: notification.id
  }));
  if (!rows.length) return { error: null };

  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase
      .from('notification_dismissals')
      .upsert(rows.slice(index, index + 100), { onConflict: 'user_id,notification_type,notification_id' });
    if (error) return { error };
  }
  return { error: null };
}

export function getNotificationDismissErrorMessage(error, action = 'dismiss this notification') {
  const setupError = ['PGRST205', 'PGRST204', '42P01', '42501'].includes(error?.code);
  if (setupError) {
    return `Could not ${action}. Run the updated supabase/reservation-notifications.sql in Supabase, then reload the app.`;
  }
  return `Could not ${action}: ${error?.message || 'Please try again.'}`;
}

async function startMessageNotificationListener(userId, isBusinessOwner) {
  const { supabase } = await import('./supabase.js');
  if (!supabase || messageNotificationUserId === userId) return;

  if (messageNotificationChannel) {
    await messageNotificationChannel.unsubscribe();
    messageNotificationChannel = null;
  }
  const orders = await getMessageNotificationOrders(supabase, userId);
  if (orders === null) return;
  messageNotificationUserId = userId;
  if (!orders.length) return;

  const orderIds = orders.map(order => order.id);
  messageNotificationChannel = supabase
    .channel(`message-notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `order_id=in.(${orderIds.join(',')})`
    }, async payload => {
      const message = payload.new;
      if (!message || message.sender_id === userId) return;
      if (!await messageNotificationsEnabled(userId)) return;

      const bell = $('#notification-menu .notification-bell');
      if (bell) await updateUnreadCount(bell);

      const list = $('#notification-menu .notification-dropdown-list');
      const dropdown = $('#notification-menu .notification-dropdown');
      if (list && dropdown && !dropdown.hidden) await loadNotifications(list, isBusinessOwner);
    })
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Message notification subscription error:', error || status);
      }
    });
}

async function startOrderStatusNotificationListener(userId, isBusinessOwner) {
  const { supabase } = await import('./supabase.js');
  if (!supabase || orderStatusNotificationUserId === userId) return;

  if (orderStatusNotificationChannel) {
    await orderStatusNotificationChannel.unsubscribe();
    orderStatusNotificationChannel = null;
  }

  orderStatusNotificationUserId = userId;
  orderStatusNotificationChannel = supabase
    .channel(`order-status-notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'order_status_notifications',
      filter: `buyer_id=eq.${userId}`
    }, async () => {
      const bell = $('#notification-menu .notification-bell');
      if (bell) await updateUnreadCount(bell);

      const list = $('#notification-menu .notification-dropdown-list');
      const dropdown = $('#notification-menu .notification-dropdown');
      if (list && dropdown && !dropdown.hidden) await loadNotifications(list, isBusinessOwner);
    })
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Order status notification subscription error:', error || status);
      }
    });
}

async function startReservationNotificationListener(userId, isBusinessOwner) {
  if (!isBusinessOwner || reservationNotificationUserId === userId) return;

  const { supabase } = await import('./supabase.js');
  if (!supabase || !await orderNotificationsEnabled(userId)) return;
  const storeIds = await getOwnedStoreIds(supabase, userId);
  if (storeIds === null || !storeIds.length) return;

  if (reservationNotificationChannel) {
    await reservationNotificationChannel.unsubscribe();
  }
  reservationNotificationUserId = userId;
  reservationNotificationChannel = supabase
    .channel(`reservation-notifications-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservation_notifications',
      filter: `owner_id=eq.${userId}`
    }, async () => {
      const bell = $('#notification-menu .notification-bell');
      if (bell) await updateUnreadCount(bell);

      const list = $('#notification-menu .notification-dropdown-list');
      const dropdown = $('#notification-menu .notification-dropdown');
      if (list && dropdown && !dropdown.hidden) await loadNotifications(list, true);
    })
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Reservation notification subscription error:', error || status);
      }
    });
}

async function loadMessageNotificationItems(supabase, userId) {
  if (!await messageNotificationsEnabled(userId)) return [];

  const orders = await getMessageNotificationOrders(supabase, userId);
  if (orders === null) {
    console.error('Message notifications could not be loaded because the user orders query failed.');
    return [];
  }
  if (!orders.length) return [];

  const orderMap = new Map(orders.map(order => [order.id, order]));
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, order_id, sender_id, content, created_at, read_at')
    .in('order_id', orders.map(order => order.id))
    .neq('sender_id', userId)
    .order('created_at', { ascending: false });
  if (messagesError) {
    console.error('Load unread message notifications error:', messagesError);
    return [];
  }

  const orderIds = [...new Set((messages || [])
    .filter(message => orderMap.get(message.order_id)?.buyer_id !== userId)
    .map(message => message.order_id))];
  const senderNameResults = await Promise.all(orderIds.map(async orderId => {
    const { data, error: nameError } = await supabase.rpc('get_order_customer_name', { p_order_id: orderId });
    if (nameError) console.error('Load message sender name error:', nameError);
    return [orderId, data || 'Customer'];
  }));
  const senderNames = new Map(senderNameResults);

  return (messages || []).map(message => {
    const order = orderMap.get(message.order_id);
    const isRead = !!message.read_at;
    const senderName = order?.buyer_id === userId
      ? order?.stores?.business_name || 'Business owner'
      : senderNames.get(message.order_id) || 'Customer';
    const orderLabel = message.order_id.slice(0, 8);
    return {
      id: message.id,
      type: 'message',
      createdAt: message.created_at,
      html: `
        <button class="notification-item chat-notification ${isRead ? 'read' : 'unread'}" data-chat-order-id="${esc(message.order_id)}" data-chat-message-id="${esc(message.id)}" role="option" tabindex="0">
          <span class="notification-cat pill info">Message</span>
          <div class="notification-content">
            <strong>New message from ${esc(senderName)}</strong>
            <p class="muted" style="margin:2px 0 0;font-size:.85rem">${esc(message.content)}</p>
            <span class="muted" style="font-size:.7rem">${new Date(message.created_at).toLocaleString('en-PH')} • Order ${esc(orderLabel)}</span>
          </div>
          ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
        </button>
      `
    };
  });
}

async function loadNotifications(listEl, isBusinessOwner = false) {
  listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Loading...</div>';
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) {
    listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Please log in</div>';
    return;
  }
  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    const orderNotificationsEnabledPromise = orderNotificationsEnabled(userId);
    const [advisoryResult, reservations, orderStatusNotifications, messageItems] = await Promise.all([
      supabase
        .from('advisories')
        .select('id, title, body, category, priority, published_at, barangay, recipient_id, action_url, action_label')
        .lte('published_at', now)
        .or(`and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`)
        .order('published_at', { ascending: false })
        .limit(10),
      isBusinessOwner
        ? orderNotificationsEnabledPromise.then(enabled => getReservationNotifications(supabase, userId, 10, enabled))
        : Promise.resolve([]),
      orderNotificationsEnabledPromise.then(enabled => getOrderStatusNotifications(supabase, userId, 10, enabled)),
      loadMessageNotificationItems(supabase, userId)
    ]);
    const { data: advisories, error } = advisoryResult;

    if (error) console.error('Load advisory notifications error:', error);

    // Get read status
    const advisoryIds = (advisories || []).map(advisory => advisory.id);
    let reads = [];
    if (advisoryIds.length) {
      const result = await supabase
        .from('notification_reads')
        .select('advisory_id')
        .eq('user_id', userId)
        .in('advisory_id', advisoryIds);
      if (result.error) console.error('Load notification read status error:', result.error);
      reads = result.data || [];
    }
    const readIds = new Set((reads || []).map(r => r.advisory_id));

    const advisoryItems = (advisories || []).map(a => {
      const isRead = readIds.has(a.id);
      const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' }[a.category] || 'warn';
      // Store advisory data in map for modal
      advisoryDataMap.set(a.id, a);
      return {
        id: a.id,
        type: 'advisory',
        createdAt: a.published_at,
        html: `
          <button class="notification-item advisory-notification ${isRead ? 'read' : 'unread'}" data-advisory-id="${esc(a.id)}" role="option" tabindex="0">
            <span class="notification-cat pill ${catColor}">${a.category.replace('_', ' ')}</span>
            <div class="notification-content">
              <strong>${esc(a.title)}</strong>
              <p class="muted" style="margin:2px 0 0;font-size:.85rem">${esc(a.body)}</p>
              <span class="muted" style="font-size:.7rem">${new Date(a.published_at).toLocaleString('en-PH')}${a.barangay ? ` • ${esc(a.barangay)}` : ''}</span>
            </div>
            ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
          </button>
        `
      };
    });

    let reservationItems = [];
    if (reservations === null) {
      console.error('Reservation notification list could not be loaded.');
    } else {
      reservationItems = reservations.map(reservation => {
        const order = reservation.orders || {};
        const product = order.products || {};
        const isRead = !!reservation.read_at;
        const orderLabel = reservation.order_id.slice(0, 8);
        const isExpired = order.status === 'EXPIRED';
        const title = isExpired
          ? `Reservation expired for ${reservation.buyer_name}`
          : `New reservation from ${reservation.buyer_name}`;
        const body = isExpired
          ? `${order.cancellation_reason || 'Not picked up within 3 days of being marked ready'} • ${order.quantity || 0} × ${product.name || 'Product'} • Order ${orderLabel}`
          : `${order.quantity || 0} × ${product.name || 'Product'} • Order ${orderLabel}`;
        return {
          id: reservation.id,
          type: 'reservation',
          createdAt: reservation.created_at,
          html: `
            <button class="notification-item reservation-notification ${isRead ? 'read' : 'unread'}" data-reservation-id="${esc(reservation.id)}" data-order-id="${esc(reservation.order_id)}" role="option" tabindex="0">
              <span class="notification-cat pill ${isExpired ? 'bad' : 'info'}">${isExpired ? 'Expired' : 'Reservation'}</span>
              <div class="notification-content">
                <strong>${esc(title)}</strong>
                <p class="muted" style="margin:2px 0 0;font-size:.85rem">${esc(body)}</p>
                <span class="muted" style="font-size:.7rem">${new Date(reservation.created_at).toLocaleString('en-PH')}</span>
              </div>
              ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
            </button>
          `
        };
      });
    }

    let orderStatusItems = [];
    if (orderStatusNotifications === null) {
      console.error('Order status notifications could not be loaded.');
    } else {
      const statusLabels = {
        CONFIRMED: 'Confirmed',
        READY_FOR_PICKUP: 'Ready for pickup',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
        EXPIRED: 'Expired - not picked up'
      };
      orderStatusItems = orderStatusNotifications.map(notification => {
        const order = notification.orders || {};
        const product = order.products || {};
        const store = order.stores || {};
        const statusLabel = statusLabels[notification.new_status] || 'Updated';
        const isRead = !!notification.read_at;
        const orderLabel = notification.order_id.slice(0, 8);
        return {
          id: notification.id,
          type: 'order_status',
          createdAt: notification.created_at,
          html: `
            <button class="notification-item order-status-notification ${isRead ? 'read' : 'unread'}" data-notification-id="${esc(notification.id)}" data-order-id="${esc(notification.order_id)}" role="option" tabindex="0">
              <span class="notification-cat pill info">Order update</span>
              <div class="notification-content">
                <strong>Order ${esc(statusLabel)}</strong>
                <p class="muted" style="margin:2px 0 0;font-size:.85rem">Your order${product.name ? ` for ${esc(product.name)}` : ''}${store.business_name ? ` from ${esc(store.business_name)}` : ''} is now ${esc(statusLabel.toLowerCase())}.${notification.new_status === 'READY_FOR_PICKUP' ? ` ${esc(pickupDeadlineNotice(order.ready_at))}` : ''}${order.cancellation_reason ? ` Reason: ${esc(order.cancellation_reason)}` : ''}</p>
                <span class="muted" style="font-size:.7rem">${new Date(notification.created_at).toLocaleString('en-PH')} • Order ${esc(orderLabel)}</span>
              </div>
              ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
            </button>
          `
        };
      });
    }

    let items = [...advisoryItems, ...reservationItems, ...orderStatusItems, ...messageItems]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const dismissedKeys = await getNotificationDismissals(supabase, userId, items);
    if (dismissedKeys === null) {
      console.error('Dismissed notifications could not be loaded.');
    } else {
      items = items.filter(item => !dismissedKeys.has(`${item.type}:${item.id}`));
    }
    listEl.innerHTML = items.length
      ? items.map(item => item.html).join('')
      : '<div class="muted" style="padding:16px;text-align:center">No notifications</div>';

    listEl.querySelectorAll('.advisory-notification').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.advisoryId;
        const advisory = advisoryDataMap.get(id);
        if (advisory) await openNotificationModal(advisory);

        if (!readIds.has(advisory?.id)) {
          item.classList.remove('unread');
          item.classList.add('read');
          item.querySelector('.notification-dot')?.remove();
        }
      });
    });

    listEl.querySelectorAll('.chat-notification').forEach(item => {
      item.addEventListener('click', () => {
        const orderId = item.dataset.chatOrderId;
        const messageId = item.dataset.chatMessageId;
        window.location.href = `/chat/?orderId=${encodeURIComponent(orderId)}&messageId=${encodeURIComponent(messageId)}`;
      });
    });

    listEl.querySelectorAll('.reservation-notification').forEach(item => {
      item.addEventListener('click', async () => {
        const { error: readError } = await markReservationNotificationRead(
          supabase,
          item.dataset.reservationId,
          userId
        );
        if (readError) {
          console.error('Mark reservation notification read error:', readError);
          alert('Could not mark this reservation notification as read.');
          return;
        }

        item.classList.remove('unread');
        item.classList.add('read');
        item.querySelector('.notification-dot')?.remove();
        const bell = $('#notification-menu .notification-bell');
        if (bell) await updateUnreadCount(bell);
        window.location.href = `/dashboard/?tab=orders&orderId=${encodeURIComponent(item.dataset.orderId)}`;
      });
    });

    listEl.querySelectorAll('.order-status-notification').forEach(item => {
      item.addEventListener('click', async () => {
        const { error: readError } = await markOrderStatusNotificationRead(
          supabase,
          item.dataset.notificationId,
          userId
        );
        if (readError) {
          console.error('Mark order status notification read error:', readError);
          alert('Could not mark this order update as read.');
          return;
        }

        const bell = $('#notification-menu .notification-bell');
        if (bell) await updateUnreadCount(bell);
        window.location.href = `/orders/?orderId=${encodeURIComponent(item.dataset.orderId)}`;
      });
    });

  } catch (err) {
    console.error('Load notifications error:', err);
    listEl.innerHTML = '<div class="pill bad" style="padding:16px;text-align:center">Failed to load</div>';
  }
}

async function updateUnreadCount(bell) {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) return;
  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    // Get active advisory IDs
    const { data: advisories, error: advisoriesError } = await supabase
      .from('advisories')
      .select('id')
      .lte('published_at', now)
      .or(`and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`);
    if (advisoriesError) console.error('Load unread advisories error:', advisoriesError);
    const advisoryIds = (advisories || []).map(a => a.id);
    let advisoryUnread = 0;
    if (advisoryIds.length) {
      const { data: reads, error: readsError } = await supabase
        .from('notification_reads')
        .select('advisory_id')
        .eq('user_id', userId)
        .in('advisory_id', advisoryIds);
      if (readsError) console.error('Load unread advisory read status error:', readsError);
      const readIds = new Set((reads || []).map(r => r.advisory_id));
      advisoryUnread = advisoryIds.filter(id => !readIds.has(id)).length;
      const dismissedIds = await getNotificationDismissedIds(supabase, userId, 'advisory', advisoryIds);
      if (dismissedIds === null) {
        console.error('Unread advisory count could not exclude dismissed notifications.');
      } else {
        advisoryUnread = advisoryIds.filter(id => !readIds.has(id) && !dismissedIds.has(id)).length;
      }
    }

    let messageUnread = 0;
    if (await messageNotificationsEnabled(userId)) {
      const orders = await getMessageNotificationOrders(supabase, userId);
      if (orders === null) {
        console.error('Unread message count could not be loaded because the user orders query failed.');
      } else if (orders.length) {
        const { count, error: messageCountError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('order_id', orders.map(order => order.id))
          .neq('sender_id', userId)
          .is('read_at', null);
        if (messageCountError) console.error('Load unread message count error:', messageCountError);
        else {
          messageUnread = count || 0;
          const dismissedIds = await getNotificationDismissedIds(supabase, userId, 'message');
          if (dismissedIds === null) {
            console.error('Unread message count could not exclude dismissed notifications.');
          } else if (dismissedIds.size) {
            let dismissedUnread = 0;
            const ids = [...dismissedIds];
            for (let index = 0; index < ids.length; index += 100) {
              const { count: dismissedCount, error: dismissedCountError } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .in('id', ids.slice(index, index + 100))
                .in('order_id', orders.map(order => order.id))
                .neq('sender_id', userId)
                .is('read_at', null);
              if (dismissedCountError) {
                console.error('Count dismissed unread messages error:', dismissedCountError);
                dismissedUnread = 0;
                break;
              }
              dismissedUnread += dismissedCount || 0;
            }
            messageUnread = Math.max(0, messageUnread - dismissedUnread);
          }
        }
      }
    }

    let orderStatusUnread = 0;
    {
      const notificationsEnabled = await orderNotificationsEnabled(userId);
      let orderStatusQuery = supabase
        .from('order_status_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', userId)
        .is('read_at', null);
      if (!notificationsEnabled) orderStatusQuery = orderStatusQuery.in('new_status', ['READY_FOR_PICKUP', 'EXPIRED']);
      const { count, error: orderStatusCountError } = await orderStatusQuery;
      if (orderStatusCountError) console.error('Load unread order status count error:', orderStatusCountError);
      else {
        orderStatusUnread = count || 0;
        const dismissedIds = await getNotificationDismissedIds(supabase, userId, 'order_status');
        if (dismissedIds === null) {
          console.error('Unread order status count could not exclude dismissed notifications.');
        } else if (dismissedIds.size) {
          let dismissedUnread = 0;
          const ids = [...dismissedIds];
          for (let index = 0; index < ids.length; index += 100) {
            let dismissedQuery = supabase
              .from('order_status_notifications')
              .select('id', { count: 'exact', head: true })
              .in('id', ids.slice(index, index + 100))
              .eq('buyer_id', userId)
              .is('read_at', null);
            if (!notificationsEnabled) dismissedQuery = dismissedQuery.in('new_status', ['READY_FOR_PICKUP', 'EXPIRED']);
            const { count: dismissedCount, error: dismissedCountError } = await dismissedQuery;
            if (dismissedCountError) {
              console.error('Count dismissed unread order status notifications error:', dismissedCountError);
              dismissedUnread = 0;
              break;
            }
            dismissedUnread += dismissedCount || 0;
          }
          orderStatusUnread = Math.max(0, orderStatusUnread - dismissedUnread);
        }
      }
    }

    let reservationUnread = 0;
    if (bell.dataset.businessOwner === 'true' && await orderNotificationsEnabled(userId)) {
      const storeIds = await getOwnedStoreIds(supabase, userId);
      if (storeIds === null) {
        console.error('Unread reservation count could not be loaded because the stores query failed.');
      } else if (storeIds.length) {
        const { count, error: reservationCountError } = await supabase
          .from('reservation_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .is('read_at', null);
        if (reservationCountError) console.error('Load unread reservation count error:', reservationCountError);
        else {
          reservationUnread = count || 0;
          const dismissedIds = await getNotificationDismissedIds(supabase, userId, 'reservation');
          if (dismissedIds === null) {
            console.error('Unread reservation count could not exclude dismissed notifications.');
          } else if (dismissedIds.size) {
            let dismissedUnread = 0;
            const ids = [...dismissedIds];
            for (let index = 0; index < ids.length; index += 100) {
              const { count: dismissedCount, error: dismissedCountError } = await supabase
                .from('reservation_notifications')
                .select('id', { count: 'exact', head: true })
                .in('id', ids.slice(index, index + 100))
                .eq('owner_id', userId)
                .is('read_at', null);
              if (dismissedCountError) {
                console.error('Count dismissed unread reservations error:', dismissedCountError);
                dismissedUnread = 0;
                break;
              }
              dismissedUnread += dismissedCount || 0;
            }
            reservationUnread = Math.max(0, reservationUnread - dismissedUnread);
          }
        }
      }
    }

    const unread = advisoryUnread + messageUnread + orderStatusUnread + reservationUnread;
    bell.dataset.unread = unread;
    if (unread > 0) {
      let badge = bell.querySelector('.notification-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        bell.appendChild(badge);
      }
      badge.textContent = unread > 9 ? '9+' : unread;
    } else {
      bell.querySelector('.notification-badge')?.remove();
    }
  } catch (err) { console.error('Unread count error:', err); }
}

export async function refreshNotificationBell() {
  const bell = $('#notification-menu .notification-bell');
  if (bell) await updateUnreadCount(bell);
}

async function markRead(advisoryId) {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) return;

  const { error } = await supabase
    .from('notification_reads')
    .upsert({ user_id: session.user.id, advisory_id: advisoryId });

  if (error) {
    console.error('Mark read error:', error);
    // Retry once on failure
    await supabase.from('notification_reads').upsert({ user_id: session.user.id, advisory_id: advisoryId });
  }
}

async function markAllRead(isBusinessOwner) {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) return;
  const now = new Date().toISOString();

  const { data: advisories, error: advisoryError } = await supabase
    .from('advisories')
    .select('id')
    .lte('published_at', now)
    .or(`and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${session.user.id},expires_at.is.null),and(recipient_id.eq.${session.user.id},expires_at.gt.${now})`);
  if (advisoryError) console.error('Load notifications to mark read error:', advisoryError);
  if (advisories?.length) {
    const rows = advisories.map(a => ({ user_id: session.user.id, advisory_id: a.id }));
    const { error } = await supabase.from('notification_reads').upsert(rows);
    if (error) console.error('Mark all advisories read error:', error);
  }

  const orders = await getMessageNotificationOrders(supabase, session.user.id);
  if (orders === null) {
    console.error('Messages could not be marked read because the user orders query failed.');
  } else if (orders.length) {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('order_id', orders.map(order => order.id))
      .neq('sender_id', session.user.id)
      .is('read_at', null);
    if (error) console.error('Mark all messages read error:', error);
  }

  const { error: orderStatusError } = await supabase
    .from('order_status_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('buyer_id', session.user.id)
    .is('read_at', null);
  if (orderStatusError) console.error('Mark all order status notifications read error:', orderStatusError);

  if (isBusinessOwner) {
    const storeIds = await getOwnedStoreIds(supabase, session.user.id);
    if (storeIds === null) return;
    if (storeIds.length) {
      const { error } = await supabase
        .from('reservation_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('owner_id', session.user.id)
        .is('read_at', null);
      if (error) console.error('Mark all reservation notifications read error:', error);
    }
  }
}

function positionDropdown(bell, dropdown) {
  const rect = bell.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 8}px`;
  // Align dropdown's right edge with bell's right edge (dropdown is 360px wide)
  const left = rect.right - 360;
  // Keep on screen
  dropdown.style.left = `${Math.max(8, Math.min(left, window.innerWidth - 368))}px`;
  // Clear any right positioning
  dropdown.style.right = 'auto';
}
