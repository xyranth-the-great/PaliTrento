import { renderChrome, $, productCard, storeCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel, initializeStoresCarousel, startAdvisoryToastListener } from './ui.js';
import { getStores, getProducts } from './data.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';

// Check for auth error params from Supabase redirect
const authErrorRedirect = checkAuthErrorParams();
if (authErrorRedirect) {
  window.location.replace(authErrorRedirect);
}

const { session, profile, redirectUrl } = await getSessionWithStatus();

if (redirectUrl) {
  window.location.replace(redirectUrl);
}
renderChrome('/products/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

const [stores] = await Promise.all([getStores()]);
const byId = Object.fromEntries(stores.map(s => [s.id, s]));

// Create a set of premium store IDs
const premiumStoreIds = new Set();

// Load featured stores from database
let featuredStores = [];
if (supabase) {
  try {
    const { data, error } = await supabase.rpc('get_public_featured_stores', { p_limit: 10 });
    if (!error && data) {
      featuredStores = data;
      // Mark premium stores
      featuredStores.forEach(store => {
        if (store.is_premium) {
          premiumStoreIds.add(store.id);
        }
      });
    }
  } catch (err) {
    console.warn('Could not load featured stores:', err);
  }
}

// Also check all stores for premium status using efficient RPC
if (supabase) {
  try {
    const { data: premiumStores } = await supabase.rpc('get_premium_stores');
    if (premiumStores) {
      premiumStores.forEach(store => {
        premiumStoreIds.add(store.id);
      });
    }
  } catch (err) {
    console.warn('Could not check premium status:', err);
  }
}

// Initialize featured stores section
const featuredSection = $('#products-featured-stores-section');
const featuredStoresContainer = $('#products-featured-stores');

if (featuredStores.length) {
  featuredStoresContainer.innerHTML = featuredStores
    .map(store => storeCard(store, store.is_premium))
    .join('');
  featuredSection.style.display = 'block';
  initializeStoresCarousel(document.querySelector('.featured-stores-carousel'));
} else {
  featuredSection.style.display = 'none';
}

// Check if any filter is active (Products page filters: search, category, capped, stock)
function hasActiveFilters() {
  const q = $('#q').value.trim();
  const cat = $('#cat').value;
  const cappedChecked = $('#capped').checked;
  const stockChecked = $('#stock').checked;
  return q !== '' || cat !== '' || cappedChecked || stockChecked;
}

// Show/hide featured stores section with smooth transition using CSS class
function updateFeaturedStoresVisibility() {
  const shouldHide = hasActiveFilters();

  if (shouldHide) {
    featuredSection.classList.add('hidden-by-filter');
  } else {
    featuredSection.classList.remove('hidden-by-filter');
  }
}

// Products still need to be loaded for the main product listing
const productsData = await getProducts();
const approvedProducts = productsData.filter(product => byId[product.store_id]);

// Fetch locked product IDs to filter them out from public view
let lockedProductIds = new Set();
if (supabase) {
  try {
    const { data: lockedProducts } = await supabase
      .from('product_lock_states')
      .select('product_id')
      .eq('is_locked', true);
    if (lockedProducts) {
      lockedProductIds = new Set(lockedProducts.map(lp => lp.product_id));
    }
  } catch (err) {
    console.warn('Could not load locked products:', err);
  }
}

// Filter out locked products from public view
const visibleApprovedProducts = approvedProducts.filter(product => !lockedProductIds.has(product.id));

const promotedProducts = getActiveFeaturedProducts(visibleApprovedProducts)
  .filter(product => byId[product.store_id]);
const promotedProductIds = new Set(promotedProducts.map(product => product.id));
const cats = [...new Set(visibleApprovedProducts.map(x => x.category))].sort();
$('#cat').insertAdjacentHTML('beforeend', cats.map(c => `<option>${c}</option>`).join(''));

let searchDebounceTimer = null;

async function render() {
  const q = $('#q').value.trim();
  const c = $('#cat').value;
  const cappedChecked = $('#capped').checked;
  const stockChecked = $('#stock').checked;

  // Use server-side search with priority for premium stores when supabase is available
  let resultsHtml;
  let count = 0;

  if (supabase && (q || c || cappedChecked || stockChecked)) {
    try {
      const { data, error } = await supabase.rpc('search_products_with_priority', {
        p_query: q || '',
        p_category: c || '',
        p_capped_only: cappedChecked,
        p_in_stock_only: stockChecked,
        p_limit: 100,
        p_offset: 0
      });

      if (!error && data) {
        count = data.length;
        resultsHtml = data.map(x => {
          const store = byId[x.store_id];
          return productCard(x, store, x.is_premium_store);
        }).join('');
      }
    } catch (err) {
      console.warn('Server search failed, falling back to client-side:', err);
    }
  }

  // Fallback to client-side filtering
  if (!resultsHtml) {
    const qLower = q.toLowerCase();
    const filtered = visibleApprovedProducts.filter(x => (!qLower || x.name.toLowerCase().includes(qLower)) && (!c || x.category === c) &&
      (!cappedChecked || x.lgu_srp_ceiling != null) && (!stockChecked || x.in_stock));
    const showFeatured = !qLower && !c && !cappedChecked && !stockChecked && promotedProducts.length > 0;
    const out = showFeatured ? filtered.filter(product => !promotedProductIds.has(product.id)) : filtered;

    count = filtered.length;
    resultsHtml = out.map(x => productCard(x, byId[x.store_id], premiumStoreIds.has(x.store_id))).join('');
  }

  // Update featured stores visibility with smooth transition
  updateFeaturedStoresVisibility();

  $('#count').textContent = `${count} ${count === 1 ? 'product' : 'products'}`;
  $('#results').innerHTML = resultsHtml ||
    '<div class="empty" style="grid-column:1/-1"><h3>No products found</h3><p class="muted">Try another word or clear a filter.</p></div>';
}

function debouncedRender() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 300);
}

$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'capped', 'stock'].forEach(id => $('#' + id).addEventListener('input', debouncedRender));
render();