import '../css/styles.css';
import logoUrl from '../logo.png';
export const $ = (s, r = document) => r.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0 });

export const CATS = { SARI_SARI: 'Sari-sari store', CARINDERIA: 'Carinderia', FRESH_PRODUCE: 'Fresh produce', PHARMACY: 'Pharmacy', SERVICES: 'Services', PRODUCT: 'Product', AGRI: 'Agri supply' };
export const UNITS = { KG: 'kg', PC: 'pc', POUCH: 'pouch', BOTTLE: 'bottle', SACK_25KG: '25-kg sack', TIE: 'tie' };
export const PAY = { CASH: 'Cash', GCASH: 'GCash' };
// Check this list against the official PSGC barangay list for Trento before launch.
export const BARANGAYS = ['Basa','Cebolin','Cuevas','Kapatungan','Langasian','Manat','Pangyan','Poblacion','Pulang Lupa','Salvacion','San Ignacio','San Isidro','San Roque','Santa Maria','Sto. Niño','Tudela'];

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
  return `<p class="pill ${cls}" style="margin-top:8px;font-size:.8rem">${esc(status.message)}</p>`;
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
export const storeCard = s => `
  <a class="card store-card" href="/business/?trn=${encodeURIComponent(s.trn_code)}">
    <div class="store-card-media">${s.storefront_image_url
      ? `<img src="${esc(s.storefront_image_url)}" alt="${esc(s.business_name)}" loading="lazy" decoding="async">`
      : '<div class="store-card-placeholder" aria-hidden="true"><span>No photo</span></div>'}
    </div>
    <div class="store-card-content">
      <div class="row store-card-heading"><h3>${esc(s.business_name)}</h3>${openPill(s)}</div>
      <p class="store-card-meta"><span>${esc(CATS[s.trade_category])}</span> <span>in ${esc(s.barangay)}, ${esc(s.purok)}</span></p>
      <div class="store-card-badges">${badges(s)}${getPublicStoreStatusBadge(s)}</div>
    </div>
  </a>`;

export const getActiveFeaturedProducts = products => products
  .filter(product => Date.parse(product.featured_until) > Date.now())
  .sort((a, b) => Date.parse(b.featured_until) - Date.parse(a.featured_until));
export const productCard = (p, store) => {
  const c = srp(p);
  const isFeatured = Date.parse(p.featured_until) > Date.now();
  return `<a class="card product-card" href="/product-detail/?id=${encodeURIComponent(p.id)}">
    <div class="product-card-media">${p.image_url
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
      : '<div class="product-card-placeholder" aria-hidden="true"><span>No photo</span></div>'}
    </div>
    <div class="product-card-content">
      ${isFeatured ? '<span class="pill info featured-badge">Featured</span>' : ''}
      <div class="row"><h3>${esc(p.name)}</h3>${p.in_stock ? '' : '<span class="pill bad">Out of stock</span>'}</div>
      <p class="price">${peso(p.current_price)} <span class="muted">per ${UNITS[p.unit] || 'pc'}</span></p>
      ${c ? `<span class="pill ${c.cls}">${c.text}</span><span class="muted">Cap ${peso(p.lgu_srp_ceiling)}</span>` : ''}
      ${store ? `<p class="muted" style="margin-top:8px">Sold at <span style="color:var(--primary);font-weight:600">${esc(store.business_name)}</span></p>` : ''}
    </div>
  </a>`;
};

export function initializeFeaturedProductsCarousel(section) {
  const carousel = section.querySelector('[data-featured-carousel]');
  const viewport = carousel.querySelector('.featured-products-viewport');
  const track = viewport.querySelector('.featured-products-grid');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  console.log('[FeaturedCarousel] Touch device:', isTouchDevice, '| Reduced motion:', reduceMotion.matches);

  // Get original cards
  const originalCards = Array.from(track.children);
  if (originalCards.length <= 1) return;

  console.log('[FeaturedCarousel] Initializing with', originalCards.length, 'cards');

  // Wrap each card in a slide div for scroll-snap
  const slides = originalCards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'featured-products-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${originalCards.length}`);
    track.replaceChild(slide, card);
    slide.appendChild(card);
    return slide;
  });

  // Clone slides until track is at least 2x viewport width for seamless marquee (ALL devices)
  function ensureClones() {
    if (reduceMotion.matches) return;
    const viewportWidth = viewport.getBoundingClientRect().width;
    if (viewportWidth <= 0) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    let trackWidth = 0;
    track.querySelectorAll('.featured-products-slide').forEach(slide => {
      trackWidth += slide.getBoundingClientRect().width + gap;
    });
    trackWidth -= gap;

    // Clone until we have at least 2x viewport width
    let cloneIndex = 0;
    while (trackWidth < viewportWidth * 2 && cloneIndex < originalCards.length * 10) {
      const originalSlide = slides[cloneIndex % originalCards.length];
      const clone = originalSlide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      // Don't use inert=true - it makes links non-clickable
      // Just hide from screen readers with aria-hidden
      track.appendChild(clone);
      trackWidth += originalSlide.getBoundingClientRect().width + gap;
      cloneIndex++;
    }
    console.log('[FeaturedCarousel] Cloned', cloneIndex, 'slides, trackWidth:', trackWidth, 'viewportWidth:', viewportWidth);
  }

  // Calculate marquee shift for ONE SET (original cards) for seamless looping
  function calculateShift() {
    if (reduceMotion.matches) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const firstSlide = slides[0].getBoundingClientRect();
    const lastOriginalSlide = slides[originalCards.length - 1].getBoundingClientRect();
    const distance = lastOriginalSlide.right - firstSlide.left + gap;
    track.style.setProperty('--marquee-shift', `-${distance}px`);
    console.log('[FeaturedCarousel] Shift set to:', distance, 'px (for', originalCards.length, 'cards)');
  }

  // Initial setup - ALWAYS create clones and start marquee (unless reduced motion)
  if (!reduceMotion.matches) {
    ensureClones();
    calculateShift();
    track.style.animation = `featured-marquee var(--marquee-duration) linear infinite`;
  }

  // Recalculate on resize
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!reduceMotion.matches) {
        ensureClones();
        calculateShift();
      }
    }).observe(viewport);
  } else {
    window.addEventListener('resize', () => {
      if (!reduceMotion.matches) {
        ensureClones();
        calculateShift();
      }
    }, { passive: true });
  }

  // ===== TOUCH/MOBILE: Pause marquee during touch, resume after =====
  if (isTouchDevice && !reduceMotion.matches) {
    let touchTimer = null;
    let isTouching = false;

    function pauseMarquee() {
      track.classList.add('marquee-paused');
    }

    function resumeMarquee() {
      track.classList.remove('marquee-paused');
    }

    viewport.addEventListener('touchstart', () => {
      isTouching = true;
      pauseMarquee();
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });

    viewport.addEventListener('touchmove', () => {
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      isTouching = false;
      // Resume after a short delay to let native momentum finish
      touchTimer = setTimeout(resumeMarquee, 300);
    }, { passive: true });

    viewport.addEventListener('touchcancel', () => {
      isTouching = false;
      touchTimer = setTimeout(resumeMarquee, 300);
    }, { passive: true });
  }

  // ===== DESKTOP: Drag to scroll with momentum =====
  if (!isTouchDevice && !reduceMotion.matches) {
    let isDragging = false;
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
      velocity *= 0.95;
      animationFrame = requestAnimationFrame(animateMomentum);
    }

    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('a, button, input, select, textarea')) return;

      isDragging = true;
      let lastX = e.clientX;
      let lastTime = performance.now();
      velocity = 0;
      stopMarquee();
      viewport.style.scrollBehavior = 'auto';
      viewport.style.cursor = 'grabbing';
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();

      function onMove(e) {
        if (!isDragging) return;
        const now = performance.now();
        const deltaX = e.clientX - lastX;
        const deltaTime = now - lastTime;
        velocity = deltaX / deltaTime * 16;
        viewport.scrollLeft -= deltaX;
        lastX = e.clientX;
        lastTime = now;
      }

      function onUp(e) {
        if (!isDragging) return;
        isDragging = false;
        viewport.style.scrollBehavior = '';
        viewport.style.cursor = '';
        viewport.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animateMomentum();
      }

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }, { passive: false });
  }

  // Keyboard: pause on focus
  viewport.addEventListener('focusin', () => { track.classList.add('marquee-paused'); });
  viewport.addEventListener('focusout', () => { track.classList.remove('marquee-paused'); });

  // Respect reduced motion
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      track.style.animation = 'none';
    } else {
      track.style.animation = `featured-marquee var(--marquee-duration) linear infinite`;
      if (!isTouchDevice) {
        ensureClones();
        calculateShift();
      }
    }
  });

  // Hide controls (we removed pause/play button)
  const controls = carousel.querySelector('[data-featured-controls]');
  if (controls) controls.style.display = 'none';

  // Debug
  setTimeout(() => {
    const computed = getComputedStyle(track);
    console.log('[FeaturedCarousel] Animation:', computed.animation, '| --marquee-shift:', track.style.getPropertyValue('--marquee-shift'), '| Touch:', isTouchDevice);
  }, 1000);
}

export function initializeStoresCarousel(carousel) {
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = viewport.querySelector('.carousel-track');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Get original cards (before wrapping) - HTML already duplicates them (6×2=12)
  const allCards = Array.from(track.children);
  if (allCards.length <= 1) return;

  // The first half is the "original set", second half is the duplicate for looping
  const originalCount = allCards.length / 2;
  const originalCards = allCards.slice(0, originalCount);

  console.log('[StoresCarousel] Initializing with', originalCount, 'original cards (total:', allCards.length, ')');

  // Wrap each card in a slide div for scroll-snap
  const slides = allCards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${(index % originalCount) + 1} of ${originalCount}`);
    track.replaceChild(slide, card);
    slide.appendChild(card);
    return slide;
  });

  // Apply fixed width to all slides (including clones) after they exist
  // The CSS handles this, but ensure it's set for dynamically created slides
  slides.forEach(slide => {
    slide.style.width = '260px';
    slide.style.flex = '0 0 260px';
  });

  // Calculate marquee shift for ONE SET (originalCount cards) for seamless looping
  function calculateShift() {
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const firstSlide = slides[0].getBoundingClientRect();
    const lastOriginalSlide = slides[originalCount - 1].getBoundingClientRect();
    const distance = lastOriginalSlide.right - firstSlide.left + gap;
    track.style.setProperty('--marquee-shift', `-${distance}px`);
    console.log('[StoresCarousel] Shift set to:', distance, 'px (for', originalCount, 'cards)');
    console.log('[StoresCarousel] Track children:', track.children.length, '| firstSlide.left:', firstSlide.left, '| lastOriginalSlide.right:', lastOriginalSlide.right);
  }

  // Initial calculation
  calculateShift();

  // Recalculate on resize
  if ('ResizeObserver' in window) {
    new ResizeObserver(calculateShift).observe(viewport);
  } else {
    window.addEventListener('resize', calculateShift, { passive: true });
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
    console.log('[StoresCarousel] pointerdown', e.target.tagName, e.target.className);
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
    console.log('[StoresCarousel] pointerup');
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
    track.style.animation = reduceMotion.matches ? 'none' : '';
  });

  // Debug: log animation state
  setTimeout(() => {
    const computed = getComputedStyle(track);
    console.log('[StoresCarousel] Animation:', computed.animation, '| --marquee-shift:', track.style.getPropertyValue('--marquee-shift'));
  }, 1000);
}

// Simple person icon SVG (24x24, currentColor for palette)
const PERSON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// Chevron down SVG
const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

// Notification bell SVG
const BELL_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

export function renderChrome(active, session = null, profile = null, userId = null) {
  const role = profile?.role ?? session?.user?.user_metadata?.role;
  const isBusinessOwner = role === 'business_owner';
  const isAdmin = role === 'admin';
  const isLoggedInBuyer = !!session && role !== 'admin';
  const showOrdersLink = !isBusinessOwner
    && !isAdmin
    && !['/login/', '/register/'].includes(active)
    && (!!session && role === 'customer'
      || (!['/explore/', '/map/', '/products/'].includes(active)
        && (active !== '/' || isLoggedInBuyer)));
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

    // Keep order history available to customers, but not sellers or admins.
    const ordersLink = isBusinessOwner || isAdmin
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
    authLinks = `<a href="/login/"${active === '/login/' ? ' aria-current="page"' : ''}>Log in</a>
       <a href="/register/"${active === '/register/' ? ' aria-current="page"' : ''}>Register</a>`;
  }

  const top = $('#chrome-top');
  if (top) top.outerHTML = `<header id="chrome-top" class="top"><div class="wrap">
    <a class="logo" href="/" aria-label="PaliTrento home">
      <span class="logo-word"><span class="logo-pali">Pali</span><span class="logo-inline-mark"><img class="logo-mark" src="${logoUrl}" alt="" aria-hidden="true"></span><span class="logo-rento">rento</span></span>
    </a>
    <nav aria-label="Main">${links.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}${authLinks}</nav></div></header>`;
  const f = $('#chrome-foot');
  if (f) f.outerHTML = `<footer id="chrome-foot"><div class="wrap"><p><strong>PaliTrento</strong>. Tara, Palit Ta sa Trento!</p>
    <p>A local directory for the Municipality of Trento, Agusan del Sur. Price caps shown follow Admin advisories and may change weekly.</p></div></footer>`;

  // Initialize avatar dropdown after DOM update
  if (session) {
    initAvatarDropdown();
    initNotificationBell(session.user.id, isBusinessOwner);
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

export { openNotificationModal };

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

export async function getReservationNotifications(supabase, userId, limit = null) {
  if (!await orderNotificationsEnabled(userId)) return [];

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
  const buyerNames = new Map();
  for (const orderId of orderIds) {
    const { data: name, error: nameError } = await supabase.rpc(
      'get_order_customer_name',
      { p_order_id: orderId }
    );
    if (nameError) console.error('Load reservation customer name error:', nameError);
    buyerNames.set(orderId, name || 'Customer');
  }

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

export async function getOrderStatusNotifications(supabase, userId, limit = null) {
  if (!await orderNotificationsEnabled(userId)) return [];

  let query = supabase
    .from('order_status_notifications')
    .select('id, order_id, previous_status, new_status, created_at, read_at, orders(cancellation_reason, products(name), stores(business_name))')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });
  if (limit !== null) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('Load order status notifications error:', error);
    return null;
  }
  return data || [];
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
  for (const [type, ids] of idsByType) {
    const dismissedIds = await getNotificationDismissedIds(supabase, userId, type, ids);
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
      if (!await orderNotificationsEnabled(userId)) return;

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

async function loadNotifications(listEl, isBusinessOwner = false) {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) {
    listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Please log in</div>';
    return;
  }
  const userId = session.user.id;
  const now = new Date().toISOString();

  listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Loading...</div>';
  try {
    const { data: advisories, error } = await supabase
      .from('advisories')
      .select('id, title, body, category, priority, published_at, barangay, recipient_id, action_url, action_label')
      .lte('published_at', now)
      .or(`and(recipient_id.is.null,expires_at.is.null),and(recipient_id.is.null,expires_at.gt.${now}),and(recipient_id.eq.${userId},expires_at.is.null),and(recipient_id.eq.${userId},expires_at.gt.${now})`)
      .order('published_at', { ascending: false })
      .limit(10);

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
    const reservations = isBusinessOwner
      ? await getReservationNotifications(supabase, userId, 10)
      : [];
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
    const orderStatusNotifications = await getOrderStatusNotifications(supabase, userId, 10);
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
                <p class="muted" style="margin:2px 0 0;font-size:.85rem">Your order${product.name ? ` for ${esc(product.name)}` : ''}${store.business_name ? ` from ${esc(store.business_name)}` : ''} is now ${esc(statusLabel.toLowerCase())}.${order.cancellation_reason ? ` Reason: ${esc(order.cancellation_reason)}` : ''}</p>
                <span class="muted" style="font-size:.7rem">${new Date(notification.created_at).toLocaleString('en-PH')} • Order ${esc(orderLabel)}</span>
              </div>
              ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
            </button>
          `
        };
      });
    }

    let messageItems = [];
    if (await messageNotificationsEnabled(userId)) {
      const orders = await getMessageNotificationOrders(supabase, userId);
      if (orders === null) {
        console.error('Message notifications could not be loaded because the user orders query failed.');
      } else if (orders.length) {
        const orderMap = new Map(orders.map(order => [order.id, order]));
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, order_id, sender_id, content, created_at, read_at')
          .in('order_id', orders.map(order => order.id))
          .neq('sender_id', userId)
          .order('created_at', { ascending: false });
        if (messagesError) {
          console.error('Load unread message notifications error:', messagesError);
        } else {
          const senderNames = new Map();
          for (const orderId of new Set((messages || []).map(message => message.order_id))) {
            const order = orderMap.get(orderId);
            if (order?.buyer_id !== userId) {
              const { data, error: nameError } = await supabase.rpc('get_order_customer_name', { p_order_id: orderId });
              if (nameError) console.error('Load message sender name error:', nameError);
              senderNames.set(orderId, data || 'Customer');
            }
          }

          messageItems = (messages || []).map(message => {
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
      }
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
    if (await orderNotificationsEnabled(userId)) {
      const { count, error: orderStatusCountError } = await supabase
        .from('order_status_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', userId)
        .is('read_at', null);
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
            const { count: dismissedCount, error: dismissedCountError } = await supabase
              .from('order_status_notifications')
              .select('id', { count: 'exact', head: true })
              .in('id', ids.slice(index, index + 100))
              .eq('buyer_id', userId)
              .is('read_at', null);
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
