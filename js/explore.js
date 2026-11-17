import { renderChrome, $, storeCard, initializeFeaturedProductsCarousel, isOpen, CATS, BARANGAYS, startAdvisoryToastListener } from './ui.js';
import { getStores, getProducts, hasAvailableQuantity } from './data.js';
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
renderChrome('/explore/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

const [stores, productsData] = await Promise.all([getStores(), getProducts()]);
const approvedProducts = productsData.filter(p => stores.some(s => s.id === p.store_id) && hasAvailableQuantity(p));

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

// Filter out locked products from approvedProducts for search matching
const visibleApprovedProducts = approvedProducts.filter(product => !lockedProductIds.has(product.id));

// Create a map of store premium status
const premiumStoreIds = new Set();

// Load featured stores from database (includes is_premium flag)
let featuredStores = [];
if (supabase) {
  try {
    const { data, error } = await supabase.rpc('get_public_featured_stores', { p_limit: 20 });
    if (!error && data) {
      featuredStores = data;
      // Mark premium stores from featured stores
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

// Also check all approved stores for premium status using a single query
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
const featuredSection = $('#explore-featured-stores-section');
const featuredStoresContainer = $('#explore-featured-stores');

if (featuredStores.length) {
  featuredStoresContainer.innerHTML = featuredStores
    .map(store => storeCard(store, store.is_premium))
    .join('');
  featuredSection.style.display = 'block';
  // This section uses the featured-products carousel markup, not the legacy
  // stores carousel markup. Passing it to initializeStoresCarousel throws
  // before the main store results can render.
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

// Show/hide featured stores section with smooth transition using CSS class
function updateFeaturedStoresVisibility() {
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

let searchDebounceTimer = null;

async function render() {
  const q = $('#q').value.trim();
  const cat = $('#cat').value;
  const br = $('#brgy').value;
  const openChecked = $('#open').checked;
  const verChecked = $('#ver').checked;

  // Use server-side search with priority for premium stores when supabase is available
  let resultsHtml;
  let count = 0;

  if (supabase && (q || cat || br || openChecked || verChecked)) {
    try {
      const { data, error } = await supabase.rpc('search_stores_with_priority', {
        p_query: q || '',
        p_category: cat || '',
        p_barangay: br || '',
        p_open_only: openChecked,
        p_verified_only: verChecked,
        p_limit: 100,
        p_offset: 0
      });

      if (!error && data) {
        count = data.length;
        resultsHtml = data.map(s => storeCard(s, s.is_premium)).join('');
      }
    } catch (err) {
      console.warn('Server search failed, falling back to client-side:', err);
    }
  }

  // Fallback to client-side filtering
  if (!resultsHtml) {
    const qLower = q.toLowerCase();
    const hit = new Set(visibleApprovedProducts.filter(x => qLower && x.name.toLowerCase().includes(qLower)).map(x => x.store_id));
    const out = stores.filter(s =>
      (!qLower || s.business_name.toLowerCase().includes(qLower) || CATS[s.trade_category].toLowerCase().includes(qLower) || s.barangay.toLowerCase().includes(qLower) || hit.has(s.id)) &&
      (!cat || s.trade_category === cat) && (!br || s.barangay === br) &&
      (!openChecked || isOpen(s)) && (!verChecked || s.approval_status === 'APPROVED' || s.verification_status === 'VERIFIED'));

    count = out.length;
    resultsHtml = out.map(s => storeCard(s, premiumStoreIds.has(s.id))).join('');
  }

  $('#count').textContent = `${count} ${count === 1 ? 'place' : 'places'} found`;
  $('#results').innerHTML = resultsHtml ||
    '<div class="empty" style="grid-column:1/-1"><h3>No matches</h3><p class="muted">Try a different word or clear a filter.</p></div>';

  // Update featured stores visibility based on filter state
  updateFeaturedStoresVisibility();
}

function debouncedRender() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 300);
}

$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'brgy', 'open', 'ver'].forEach(id => $('#' + id).addEventListener('input', debouncedRender));
render();
