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
  s.verification_status === 'VERIFIED' ? '<span class="pill ok">Verified</span>' : '<span class="pill warn">Verification pending</span>',
  s.dti_registered ? '<span class="pill info">DTI registered</span>' : '',
  s.bmbe_registered ? '<span class="pill info">BMBE</span>' : '',
  s.srp_compliant ? '<span class="pill ok">Follows price caps</span>' : ''
].join('');

// Price vs LGU cap. Returns null when no cap is set.
export function srp(p) {
  if (p.lgu_srp_ceiling == null) return null;
  return p.current_price <= p.lgu_srp_ceiling
    ? { cls: 'ok', text: 'Within cap' }
    : { cls: 'bad', text: `Over cap by ${peso(p.current_price - p.lgu_srp_ceiling)}` };
}
export const storeCard = s => `
  <a class="card store-card" href="/business/?trn=${encodeURIComponent(s.trn_code)}">
    <div class="row store-card-heading"><h3>${esc(s.business_name)}</h3>${openPill(s)}</div>
    <p class="store-card-meta"><span>${esc(CATS[s.trade_category])}</span> <span>in ${esc(s.barangay)}, ${esc(s.purok)}</span></p>
    <div class="store-card-badges">${badges(s)}</div>
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
      clone.inert = true;
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
    <p>A local directory for the Municipality of Trento, Agusan del Sur. Price caps shown follow LGU advisories and may change weekly.</p></div></footer>`;

  // Initialize avatar dropdown after DOM update
  if (session) {
    initAvatarDropdown();
    initNotificationBell();
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
    COMPLETED: 'ok'
  };
  const color = statusColors[status] || 'info';

  // Create advisory-like object for modal
  const advisory = {
    id: `order-${orderId}`,
    title: `Order ${status.replace('_', ' ')}`,
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
      <span class="advisory-toast-cat pill ${color}">Order ${status.replace('_', ' ')}</span>
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

async function initNotificationBell() {
  const bell = $('#notification-menu .notification-bell');
  const dropdown = $('#notification-menu .notification-dropdown');
  const list = dropdown?.querySelector('.notification-dropdown-list');
  if (!bell || !dropdown || !list) return;

  // Toggle dropdown
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    if (!isOpen) {
      positionDropdown(bell, dropdown);
      await loadNotifications(list);
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
    await markAllRead();
    bell.dataset.unread = '0';
    bell.querySelector('.notification-badge')?.remove();
    await loadNotifications(list);
  });

  // Initial load
  await updateUnreadCount(bell);
}

async function loadNotifications(listEl) {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) {
    listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Please log in</div>';
    return;
  }
  const userId = session.user.id;

  listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">Loading...</div>';
  try {
    const { data: advisories, error } = await supabase
      .from('advisories')
      .select('id, title, body, category, priority, published_at, barangay')
      .lte('published_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(10);

    if (error || !advisories?.length) {
      listEl.innerHTML = '<div class="muted" style="padding:16px;text-align:center">No notifications</div>';
      return;
    }

    // Get read status
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('advisory_id')
      .eq('user_id', userId)
      .in('advisory_id', advisories.map(a => a.id));
    const readIds = new Set((reads || []).map(r => r.advisory_id));

    listEl.innerHTML = advisories.map(a => {
      const isRead = readIds.has(a.id);
      const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' }[a.category] || 'warn';
      // Store advisory data in map for modal
      advisoryDataMap.set(a.id, a);
      return `
        <button class="notification-item ${isRead ? 'read' : 'unread'}" data-id="${a.id}" role="option" tabindex="0">
          <span class="notification-cat pill ${catColor}">${a.category.replace('_', ' ')}</span>
          <div class="notification-content">
            <strong>${esc(a.title)}</strong>
            <p class="muted" style="margin:2px 0 0;font-size:.85rem">${esc(a.body)}</p>
            <span class="muted" style="font-size:.7rem">${new Date(a.published_at).toLocaleString('en-PH')}${a.barangay ? ` • ${esc(a.barangay)}` : ''}</span>
          </div>
          ${!isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
        </button>
      `;
    }).join('');

    // Click to open detail modal (handles markRead + badge update)
    listEl.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        const advisory = advisoryDataMap.get(id);
        if (advisory) await openNotificationModal(advisory);

        // Update UI immediately for better UX
        if (!readIds.has(advisory?.id)) {
          item.classList.remove('unread');
          item.classList.add('read');
          item.querySelector('.notification-dot')?.remove();
        }
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

  try {
    // Get active advisory IDs
    const { data: advisories } = await supabase
      .from('advisories')
      .select('id')
      .lte('published_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    if (!advisories?.length) return;
    const advisoryIds = advisories.map(a => a.id);

    // Get read IDs
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('advisory_id')
      .eq('user_id', userId)
      .in('advisory_id', advisoryIds);
    const readIds = new Set((reads || []).map(r => r.advisory_id));

    const unread = advisoryIds.filter(id => !readIds.has(id)).length;
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

async function markAllRead() {
  const { supabase } = await import('./supabase.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  if (!supabase || !session) return;

  const { data: advisories } = await supabase
    .from('advisories')
    .select('id')
    .lte('published_at', new Date().toISOString())
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
  if (!advisories?.length) return;
  const rows = advisories.map(a => ({ user_id: session.user.id, advisory_id: a.id }));
  await supabase.from('notification_reads').upsert(rows);
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
