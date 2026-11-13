import '../css/styles.css';
import { getTotalUnreadCount, incrementUnreadCount, clearUnreadCount, getCachedUnreadCounts, startUnreadListener } from './auth.js';
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
  <a class="card store-card" href="business.html?trn=${encodeURIComponent(s.trn_code)}">
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
  return `<a class="card product-card" href="product-detail.html?id=${encodeURIComponent(p.id)}">
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
  const controls = carousel.querySelector('[data-featured-controls]');
  const previous = carousel.querySelector('[data-featured-prev]');
  const next = carousel.querySelector('[data-featured-next]');
  const status = carousel.querySelector('[data-featured-status]');
  const toggle = carousel.querySelector('[data-featured-toggle]');
  const cards = Array.from(track.children);
  const slides = cards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'featured-products-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${cards.length}`);
    track.replaceChild(slide, card);
    slide.appendChild(card);
    return slide;
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let position = 0;
  let direction = 1;
  let timer = null;
  let onScreen = !('IntersectionObserver' in window);
  let hovered = false;
  let focused = false;
  let userPaused = false;

  function configuredVisibleCount() {
    return Number.parseInt(getComputedStyle(carousel).getPropertyValue('--featured-visible'), 10) || 1;
  }

  function visibleCount() {
    const configuredCount = configuredVisibleCount();
    return slides.length > 1 && slides.length < configuredCount ? 1 : configuredCount;
  }

  function maxPosition() {
    return Math.max(0, slides.length - visibleCount());
  }

  function update() {
    carousel.classList.toggle('is-sparse', slides.length > 0 && slides.length < configuredVisibleCount());
    const visible = visibleCount();
    const max = maxPosition();
    position = Math.min(position, max);
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = (slides[0]?.getBoundingClientRect().width || 0) + gap;
    track.style.transform = `translate3d(${-position * step}px, 0, 0)`;
    slides.forEach((slide, index) => {
      slide.inert = index < position || index >= position + visible;
    });
    controls.hidden = max === 0;
    previous.disabled = position === 0;
    next.disabled = position === max;
    status.textContent = slides.length
      ? `${position + 1}-${Math.min(position + visible, slides.length)} of ${slides.length}`
      : '0 of 0';
    toggle.hidden = reduceMotion.matches;
    toggle.disabled = reduceMotion.matches;
    toggle.textContent = userPaused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-label', userPaused ? 'Resume automatic rotation' : 'Pause automatic rotation');

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (
      max > 0
      && !userPaused
      && !reduceMotion.matches
      && onScreen
      && !document.hidden
      && !hovered
      && !focused
    ) {
      timer = setTimeout(advanceAutomatically, 6000);
    }
  }

  function moveTo(nextPosition) {
    const currentPosition = position;
    position = Math.max(0, Math.min(nextPosition, maxPosition()));
    if (position !== currentPosition) direction = position > currentPosition ? 1 : -1;
    status.setAttribute('aria-live', 'polite');
    update();
  }

  function advanceAutomatically() {
    const max = maxPosition();
    if (position >= max) direction = -1;
    else if (position <= 0) direction = 1;
    position += direction;
    status.setAttribute('aria-live', 'off');
    update();
  }

  previous.addEventListener('click', () => moveTo(position - 1));
  next.addEventListener('click', () => moveTo(position + 1));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    update();
  });
  document.addEventListener('visibilitychange', update);
  reduceMotion.addEventListener('change', update);
  window.addEventListener('resize', update, { passive: true });

  if (canHover) {
    carousel.addEventListener('pointerenter', () => {
      hovered = true;
      update();
    });
    carousel.addEventListener('pointerleave', () => {
      hovered = false;
      update();
    });
  }

  carousel.addEventListener('focusin', () => {
    focused = true;
    update();
  });
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) {
      focused = false;
      update();
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }, { threshold: 0.1 });
    observer.observe(carousel);
  }

  update();
}

// Simple person icon SVG (24x24, currentColor for palette)
const PERSON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// Chevron down SVG
const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

export function renderChrome(active, session = null, profile = null) {
  const role = profile?.role ?? session?.user?.user_metadata?.role;
  const isBusinessOwner = role === 'business_owner';
  const isAdmin = role === 'admin';
  const isLoggedInBuyer = !!session && role !== 'admin';
  const showOrdersLink = !isBusinessOwner
    && !isAdmin
    && !['login.html', 'register.html'].includes(active)
    && (!!session && role === 'customer'
      || (!['explore.html', 'map.html', 'products.html'].includes(active)
        && (active !== 'index.html' || isLoggedInBuyer)));
  const links = [
    ['index.html', 'Home'],
    ...(isAdmin ? [['admin.html', 'Admin Dashboard']] : []),
    ['explore.html', 'Explore'],
    ['map.html', 'Map'],
    ['products.html', 'Products'],
    ...(isBusinessOwner ? [['dashboard.html#tab-products', 'My Products']] : []),
    ...(showOrdersLink ? [['orders.html', 'My Orders']] : [])
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
      extraLinks = `<a href="dashboard.html" class="avatar-dropdown-item" role="menuitem">Dashboard</a>`;
    } else if (isAdmin) {
      extraLinks = `<a href="admin.html" class="avatar-dropdown-item" role="menuitem">Admin Dashboard</a>`;
    }

    // Keep order history available to customers, but not sellers or admins.
    const ordersLink = isBusinessOwner || isAdmin
      ? ''
      : `<a href="orders.html" class="avatar-dropdown-item" role="menuitem">My Orders</a>`;

    // Get cached unread count
    const unreadCounts = getCachedUnreadCounts();
    const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
    const unreadBadge = `<span class="avatar-unread-badge" id="avatar-unread-badge" style="display:${totalUnread > 0 ? 'flex' : 'none'}">${totalUnread > 9 ? '9+' : totalUnread}</span>`;

    authLinks = `
      <div class="avatar-menu" id="avatar-menu">
        <a href="${isBusinessOwner ? 'dashboard.html' : isAdmin ? 'admin.html' : 'account.html'}" class="avatar-btn"${active === 'account.html' || active === 'dashboard.html' || active === 'admin.html' ? ' aria-current="page"' : ''} aria-label="My account" aria-haspopup="true" aria-expanded="false">
          ${avatarHtml}
          ${unreadBadge}
          <span class="avatar-chevron">${CHEVRON_SVG}</span>
        </a>
        <div class="avatar-dropdown" role="menu" aria-label="Account options">
          <div class="avatar-dropdown-header">
            <span class="avatar-dropdown-name">${esc(userName)}</span>
            <span class="avatar-dropdown-email">${esc(userEmail)}</span>
          </div>
          ${extraLinks}
          ${ordersLink}
          <a href="account.html" class="avatar-dropdown-item" role="menuitem">My Account</a>
          <a href="settings.html" class="avatar-dropdown-item" role="menuitem">Settings</a>
          <button type="button" class="avatar-dropdown-item avatar-dropdown-logout" role="menuitem" id="avatar-logout-btn">Log out</button>
        </div>
      </div>`;
  } else {
    authLinks = `<a href="login.html"${active === 'login.html' ? ' aria-current="page"' : ''}>Log in</a>
       <a href="register.html"${active === 'register.html' ? ' aria-current="page"' : ''}>Register</a>`;
  }
  const top = $('#chrome-top');
  if (top) top.outerHTML = `<header id="chrome-top" class="top"><div class="wrap">
    <a class="logo" href="index.html" aria-label="PaliTrento home">
      <span class="logo-word"><span class="logo-pali">Pali</span><span class="logo-inline-mark"><img class="logo-mark" src="${logoUrl}" alt="" aria-hidden="true"></span><span class="logo-rento">rento</span></span>
    </a>
    <nav aria-label="Main">${links.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}${authLinks}</nav></div></header>`;
  const f = $('#chrome-foot');
  if (f) f.outerHTML = `<footer id="chrome-foot"><div class="wrap"><p><strong>PaliTrento</strong>. Tara, Palit Ta sa Trento!</p>
    <p>A local directory for the Municipality of Trento, Agusan del Sur. Price caps shown follow LGU advisories and may change weekly.</p></div></footer>`;

  // Initialize avatar dropdown after DOM update
  if (session) {
    initAvatarDropdown();
    // Start global unread message listener
    startUnreadListener(session.user.id).catch(console.error);
  }
}

function initAvatarDropdown() {
  const menu = $('#avatar-menu');
  const btn = menu?.querySelector('.avatar-btn');
  const dropdown = menu?.querySelector('.avatar-dropdown');
  const logoutBtn = menu?.querySelector('#avatar-logout-btn');
  if (!menu || !btn || !dropdown) return;

  const badge = $('#avatar-unread-badge');
  console.log('Badge element:', badge);

  function updateBadge(counts) {
    console.log('updateBadge called with:', counts);
    if (!badge) {
      console.log('Badge element not found!');
      return;
    }
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    console.log('Total unread:', total);
    if (total > 0) {
      badge.textContent = total > 9 ? '9+' : total;
      badge.style.display = 'flex';
      console.log('Badge shown:', badge.textContent);
    } else {
      badge.style.display = 'none';
    }
  }

  // Listen for unread count changes
  window.addEventListener('unread-count-changed', (e) => {
    console.log('unread-count-changed event:', e.detail);
    updateBadge(e.detail);
  });

  // Initial badge update
  const counts = getCachedUnreadCounts();
  console.log('Initial counts:', counts);
  updateBadge(counts);

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
    if (!error) window.location.href = 'index.html';
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760 && isOpen) closeDropdown();
  });
}
