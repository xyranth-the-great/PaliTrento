import { renderChrome, $, esc, storeCard, initializeFeaturedProductsCarousel, initializeStoresCarousel, srp, peso, UNITS, CATS, startAdvisoryToastListener } from './ui.js';
import logoUrl from '../logo.png';
import { getStores, getProducts } from './data.js';
import { getSessionWithStatus, getCachedProfile, getPostLoginPath, isNewGoogleAccount, clearProfileCache, startOrderStatusListener, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { initPushNotifications } from './push.js';

const TRENT_PUBLIC_MARKET = { lat: 8.0472, lng: 126.0631 };
const NEAR_CENTER_RADIUS_MILES = 2;

function distanceMiles(from, to) {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return Infinity;
  const lat1 = Number(from.lat) * Math.PI / 180;
  const lat2 = Number(to.lat) * Math.PI / 180;
  const deltaLat = lat2 - lat1;
  const deltaLng = (Number(to.lng) - Number(from.lng)) * Math.PI / 180;
  if (![lat1, lat2, deltaLat, deltaLng].every(Number.isFinite)) return Infinity;

  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

// Check for auth error params FIRST (before any session check)
// This handles Supabase redirect for banned/suspended users
const authErrorRedirect = checkAuthErrorParams();
if (authErrorRedirect) {
  window.location.replace(authErrorRedirect);
}

const { session, profile, redirectUrl } = await getSessionWithStatus();

// Redirect suspended/banned users (from database check) - includes email param
if (redirectUrl) {
  window.location.replace(redirectUrl);
}

const postLoginPath = getPostLoginPath(profile?.role || session?.user?.user_metadata?.role);
const isAuthCallback = new URLSearchParams(window.location.search).get('auth_callback') === '1';

// Track if user needs to choose role (persists across refresh)
const ROLE_CHOICE_KEY = 'palitrento_google_role_pending';
const hasRoleChoiceFlag = sessionStorage.getItem(ROLE_CHOICE_KEY) === '1';

// User needs role choice if: first callback OR flag is set AND profile role is still default 'customer'
const needsGoogleRoleChoice = !!session && (
  (isAuthCallback && isNewGoogleAccount(session.user)) ||
  (hasRoleChoiceFlag && (profile?.role === 'customer' || !profile?.role))
);

// DEBUG: Log values to understand the flow
console.log('[home.js] Debug:', {
  hasSession: !!session,
  isAuthCallback,
  hasRoleChoiceFlag,
  profileRole: profile?.role,
  isNewGoogleAccount: session ? isNewGoogleAccount(session.user) : false,
  needsGoogleRoleChoice
});

if (isAuthCallback) {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('auth_callback');
  window.history.replaceState(window.history.state, '', cleanUrl);

  // Set flag for refresh persistence
  if (isNewGoogleAccount(session.user)) {
    sessionStorage.setItem(ROLE_CHOICE_KEY, '1');
  }
}

if (session && isAuthCallback && !needsGoogleRoleChoice && postLoginPath !== '/') {
  window.location.replace(postLoginPath);
} else {
  renderChrome('/', session, profile);

  // Start advisory toast listener for logged-in users
  if (session) {
    startAdvisoryToastListener();
    startOrderStatusListener(session.user.id);
    // Initialize push notifications
    initPushNotifications();
  }

  if (needsGoogleRoleChoice) {
    showGoogleRoleChoice(session);
  } else {
    $('#home-tagline').innerHTML = `Tara, Palit <img class="tagline-logo" src="${logoUrl}" alt="T">a sa Trento!`;

    $('#chips').innerHTML = Object.entries(CATS).map(([k, v]) => `<a class="chip" href="/explore/?cat=${encodeURIComponent(k)}">${v}</a>`).join('');

    // Load featured stores and premium status in one request.
    let featuredStores = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('get_public_featured_stores', { p_limit: 20 });
        if (error) {
          console.warn('Could not load featured stores:', error);
        } else if (Array.isArray(data)) {
          featuredStores = data;
        }
      } catch (err) {
        console.warn('Could not load featured stores:', err);
      }
    }

    // Initialize the featured stores carousel.
    const featuredStoresSection = $('#featured-stores-section');
    if (featuredStoresSection && featuredStores.length) {
      featuredStoresSection.innerHTML = `
        <div class="wrap">
          <div class="sec-head">
            <div>
              <h2 id="featured-stores-title">Featured Stores</h2>
              <p class="muted">Discover businesses worth checking out in Trento.</p>
            </div>
          </div>
        </div>
        <div class="featured-products-carousel featured-stores-carousel" data-featured-carousel role="region" aria-roledescription="carousel" aria-label="Featured stores">
          <div class="featured-products-viewport">
            <div class="featured-products-grid" id="featured-stores-grid"></div>
          </div>
        </div>
      `;
      const grid = featuredStoresSection.querySelector('#featured-stores-grid');
      grid.innerHTML = featuredStores.slice(0, 10)
        .map(store => storeCard(store, store.is_premium))
        .join('');
      featuredStoresSection.style.display = 'block';
      initializeFeaturedProductsCarousel(featuredStoresSection);
    } else if (featuredStoresSection) {
      featuredStoresSection.style.display = 'none';
    }

    // Load stores and products for Bantay Presyo and nearby stores
    const [stores, products] = await Promise.all([getStores(), getProducts()]);
    const storeById = new Map(stores.map(store => [store.id, store]));
    const approvedProducts = products.filter(product => storeById.has(product.store_id));

    const capped = approvedProducts.filter(p => p.lgu_srp_ceiling != null).slice(0, 6);
    $('#board').innerHTML = capped.map(p => { const c = srp(p); return `<div class="prow">
  <div>${esc(p.name)}<div class="muted">Cap ${peso(p.lgu_srp_ceiling)} per ${esc(UNITS[p.unit] || p.unit || 'pc')}</div></div>
  <b>${peso(p.current_price)}</b><span class="pill ${c.cls}">${c.text}</span></div>`; }).join('') || '<p class="muted">No price advisories yet.</p>';
    const marketStore = stores.find(store => store.trn_code === 'TRN-2024-012');
    const marketCenter = marketStore?.lat != null && marketStore?.lng != null
      ? { lat: marketStore.lat, lng: marketStore.lng }
      : TRENT_PUBLIC_MARKET;
    const nearbyStores = stores
      .map(store => ({ store, distance: distanceMiles(marketCenter, store) }))
      .filter(({ distance }) => distance <= NEAR_CENTER_RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance)
      .map(({ store }) => store);

    const premiumStoreIds = new Set(
      featuredStores.filter(store => store.is_premium).map(store => store.id)
    );
    const nearbyStoreCards = nearbyStores.map(store => storeCard(store, premiumStoreIds.has(store.id))).join('');
    $('#featured-track').innerHTML = nearbyStoreCards || '<p class="muted">No approved stores are within 2 miles of Trento Public Market yet.</p>';
    if (nearbyStores.length) initializeStoresCarousel($('#featured-carousel'));
  }
}

function showGoogleRoleChoice(activeSession) {
  const roleChoice = $('#google-role-choice');
  const chromeTop = $('#chrome-top');

  // Hide chrome-top (navigation) for clean role choice page
  if (chromeTop) chromeTop.style.display = 'none';

  for (const child of document.querySelector('main').children) {
    child.hidden = child !== roleChoice;
  }
  roleChoice.hidden = false;

  const form = $('#google-role-form');
  const message = $('#google-role-message');
  const submitButton = form.querySelector('button[type="submit"]');

  function restoreChrome() {
    if (chromeTop) chromeTop.style.display = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const role = new FormData(form).get('account_role');
    if (!['customer', 'business_owner'].includes(role)) {
      message.textContent = 'Choose Customer or Business owner to continue.';
      message.className = 'pill bad';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    message.textContent = '';
    message.className = 'muted';

    try {
      const { error } = await supabase.rpc('complete_google_account_registration', { p_role: role });
      if (error) throw error;

      clearProfileCache();
      const savedProfile = await getCachedProfile(activeSession.user.id);
      if (savedProfile?.role !== role) {
        throw new Error('The selected account type was not saved to the profile.');
      }

      // Clear the role choice flag - user has chosen
      sessionStorage.removeItem('palitrento_google_role_pending');

      const destination = role === 'business_owner' ? '/store-setup/?step=1' : '/';
      window.location.replace(destination);
    } catch (error) {
      console.error('Google account type save error:', error);
      message.textContent = 'We could not save your account type. Please try again.';
      message.className = 'pill bad';
      submitButton.disabled = false;
      submitButton.textContent = 'Continue';
      // Show chrome again on error so user can navigate away if needed
      restoreChrome();
    }
  });
}
