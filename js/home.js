import { renderChrome, $, esc, storeCard, productCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel, initializeStoresCarousel, srp, peso, UNITS, CATS } from './ui.js';
import logoUrl from '../logo.png';
import { getStores, getProducts } from './data.js';
import { getSession, getCachedProfile, getPostLoginPath, isNewGoogleAccount, clearProfileCache } from './auth.js';
import { supabase } from './supabase.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
const postLoginPath = getPostLoginPath(profile?.role || session?.user?.user_metadata?.role);
const isAuthCallback = new URLSearchParams(window.location.search).get('auth_callback') === '1';
const needsGoogleRoleChoice = !!session && isAuthCallback && isNewGoogleAccount(session.user);

if (isAuthCallback) {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('auth_callback');
  window.history.replaceState(window.history.state, '', cleanUrl);
}

if (session && isAuthCallback && !needsGoogleRoleChoice && postLoginPath !== 'index.html') {
  window.location.replace(postLoginPath);
} else {
  renderChrome('index.html', session, profile);

  if (needsGoogleRoleChoice) {
    showGoogleRoleChoice(session);
  } else {
    $('#home-tagline').innerHTML = `Tara, Palit <img class="tagline-logo" src="${logoUrl}" alt="T">a sa Trento!`;

    $('#chips').innerHTML = Object.entries(CATS).map(([k, v]) => `<a class="chip" href="explore.html?cat=${k}">${v}</a>`).join('');
    const [stores, products] = await Promise.all([getStores(), getProducts()]);
    const storeById = new Map(stores.map(store => [store.id, store]));
    const approvedProducts = products.filter(product => storeById.has(product.store_id));
    const promotedProducts = getActiveFeaturedProducts(approvedProducts)
      .filter(product => storeById.has(product.store_id));
    if (promotedProducts.length) {
      $('#featured-products').innerHTML = promotedProducts
        .map(product => productCard(product, storeById.get(product.store_id)))
        .join('');
      $('#featured-products-section').style.display = 'block';
      initializeFeaturedProductsCarousel($('#featured-products-section'));
    }

    const capped = approvedProducts.filter(p => p.lgu_srp_ceiling != null).slice(0, 6);
    $('#board').innerHTML = capped.map(p => { const c = srp(p); return `<div class="prow">
  <div>${esc(p.name)}<div class="muted">Cap ${peso(p.lgu_srp_ceiling)} per ${UNITS[p.unit] || 'pc'}</div></div>
  <b>${peso(p.current_price)}</b><span class="pill ${c.cls}">${c.text}</span></div>`; }).join('') || '<p class="muted">No price advisories yet.</p>';
    const featuredCards = stores.slice(0, 6).map(storeCard).join('');
    $('#featured-track').innerHTML = featuredCards + featuredCards;
    initializeStoresCarousel($('#featured-carousel'));
  }
}

function showGoogleRoleChoice(activeSession) {
  const roleChoice = $('#google-role-choice');
  for (const child of document.querySelector('main').children) {
    child.hidden = child !== roleChoice;
  }
  roleChoice.hidden = false;

  const form = $('#google-role-form');
  const message = $('#google-role-message');
  const submitButton = form.querySelector('button[type="submit"]');

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

      const destination = role === 'business_owner' ? 'store-setup.html?step=1' : 'index.html';
      window.location.replace(destination);
    } catch (error) {
      console.error('Google account type save error:', error);
      message.textContent = 'We could not save your account type. Please try again.';
      message.className = 'pill bad';
      submitButton.disabled = false;
      submitButton.textContent = 'Continue';
    }
  });
}
