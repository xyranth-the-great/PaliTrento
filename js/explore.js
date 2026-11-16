import { renderChrome, $, storeCard, productCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel, isOpen, CATS, BARANGAYS, startAdvisoryToastListener } from './ui.js';
import { getStores, getProducts } from './data.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';

// Check for auth error params from Supabase redirect
const authErrorRedirect = checkAuthErrorParams();
if (authErrorRedirect) {
  window.location.replace(authErrorRedirect);
}

const { session, profile, redirectUrl } = await getSessionWithStatus();

if (redirectUrl) {
  window.location.replace(redirectUrl);
}
renderChrome('/explore/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

const [stores, products] = await Promise.all([getStores(), getProducts()]);
const storeById = new Map(stores.map(store => [store.id, store]));
const approvedProducts = products.filter(product => storeById.has(product.store_id));
const promotedProducts = getActiveFeaturedProducts(approvedProducts)
  .filter(product => storeById.has(product.store_id));

// Initialize featured products section (visible by default if products exist)
const featuredSection = $('#explore-featured-products-section');
const featuredProductsContainer = $('#explore-featured-products');

if (promotedProducts.length) {
  featuredProductsContainer.innerHTML = promotedProducts
    .map(product => productCard(product, storeById.get(product.store_id)))
    .join('');
  featuredSection.style.display = 'block';
  initializeFeaturedProductsCarousel(featuredSection);
} else {
  featuredSection.style.display = 'none';
}

// Check if any filter is active
function hasActiveFilters() {
  const q = $('#q').value.trim();
  const cat = $('#cat').value;
  const brgy = $('#brgy').value;
  const openChecked = $('#open').checked;
  const verChecked = $('#ver').checked;
  return q !== '' || cat !== '' || brgy !== '' || openChecked || verChecked;
}

// Show/hide featured products section with smooth transition using CSS class
function updateFeaturedProductsVisibility() {
  const shouldHide = hasActiveFilters();

  if (shouldHide) {
    featuredSection.classList.add('hidden-by-filter');
  } else {
    featuredSection.classList.remove('hidden-by-filter');
  }
}

const p = new URLSearchParams(location.search);
$('#cat').insertAdjacentHTML('beforeend', Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
$('#brgy').insertAdjacentHTML('beforeend', BARANGAYS.map(b => `<option>${b}</option>`).join(''));
$('#q').value = p.get('q') || ''; $('#cat').value = p.get('cat') || ''; $('#brgy').value = p.get('brgy') || '';

function render() {
  const q = $('#q').value.trim().toLowerCase(), cat = $('#cat').value, br = $('#brgy').value;
  const hit = new Set(approvedProducts.filter(x => q && x.name.toLowerCase().includes(q)).map(x => x.store_id));
  const out = stores.filter(s =>
    (!q || s.business_name.toLowerCase().includes(q) || CATS[s.trade_category].toLowerCase().includes(q) || s.barangay.toLowerCase().includes(q) || hit.has(s.id)) &&
    (!cat || s.trade_category === cat) && (!br || s.barangay === br) &&
    (!$('#open').checked || isOpen(s)) && (!$('#ver').checked || s.verification_status === 'VERIFIED'));
  $('#count').textContent = `${out.length} ${out.length === 1 ? 'place' : 'places'} found`;
  $('#results').innerHTML = out.map(storeCard).join('') ||
    '<div class="empty" style="grid-column:1/-1"><h3>No matches</h3><p class="muted">Try a different word or clear a filter.</p></div>';

  // Update featured products visibility based on filter state
  updateFeaturedProductsVisibility();
}

$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'brgy', 'open', 'ver'].forEach(id => $('#' + id).addEventListener('input', render));
render();