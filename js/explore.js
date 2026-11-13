import { renderChrome, $, storeCard, productCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel, isOpen, CATS, BARANGAYS } from './ui.js';
import { getStores, getProducts } from './data.js';
import { getSession, getCachedProfile } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('explore.html', session, profile);

const [stores, products] = await Promise.all([getStores(), getProducts()]);
const storeById = new Map(stores.map(store => [store.id, store]));
const promotedProducts = getActiveFeaturedProducts(products)
  .filter(product => storeById.has(product.store_id));
if (promotedProducts.length) {
  $('#explore-featured-products').innerHTML = promotedProducts
    .map(product => productCard(product, storeById.get(product.store_id)))
    .join('');
  $('#explore-featured-products-section').style.display = 'block';
  initializeFeaturedProductsCarousel($('#explore-featured-products-section'));
}

const p = new URLSearchParams(location.search);
$('#cat').insertAdjacentHTML('beforeend', Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
$('#brgy').insertAdjacentHTML('beforeend', BARANGAYS.map(b => `<option>${b}</option>`).join(''));
$('#q').value = p.get('q') || ''; $('#cat').value = p.get('cat') || ''; $('#brgy').value = p.get('brgy') || '';
function render() {
  const q = $('#q').value.trim().toLowerCase(), cat = $('#cat').value, br = $('#brgy').value;
  const hit = new Set(products.filter(x => q && x.name.toLowerCase().includes(q)).map(x => x.store_id));
  const out = stores.filter(s =>
    (!q || s.business_name.toLowerCase().includes(q) || CATS[s.trade_category].toLowerCase().includes(q) || s.barangay.toLowerCase().includes(q) || hit.has(s.id)) &&
    (!cat || s.trade_category === cat) && (!br || s.barangay === br) &&
    (!$('#open').checked || isOpen(s)) && (!$('#ver').checked || s.verification_status === 'VERIFIED'));
  $('#count').textContent = `${out.length} ${out.length === 1 ? 'place' : 'places'} found`;
  $('#results').innerHTML = out.map(storeCard).join('') ||
    '<div class="empty" style="grid-column:1/-1"><h3>No matches</h3><p class="muted">Try a different word or clear a filter.</p></div>';
}
$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'brgy', 'open', 'ver'].forEach(id => $('#' + id).addEventListener('input', render));
render();