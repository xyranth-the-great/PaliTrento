import { renderChrome, $, productCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel } from './ui.js';
import { getStores, getProducts } from './data.js';
import { getSession, getCachedProfile } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('products.html', session, profile);

const [stores, products] = await Promise.all([getStores(), getProducts()]);
const byId = Object.fromEntries(stores.map(s => [s.id, s]));
const promotedProducts = getActiveFeaturedProducts(products)
  .filter(product => byId[product.store_id]);
const promotedProductIds = new Set(promotedProducts.map(product => product.id));
$('#products-featured-products').innerHTML = promotedProducts
  .map(product => productCard(product, byId[product.store_id]))
  .join('');
const cats = [...new Set(products.map(x => x.category))].sort();
$('#cat').insertAdjacentHTML('beforeend', cats.map(c => `<option>${c}</option>`).join(''));
function render() {
  const q = $('#q').value.trim().toLowerCase(), c = $('#cat').value;
  const filtered = products.filter(x => (!q || x.name.toLowerCase().includes(q)) && (!c || x.category === c) &&
    (!$('#capped').checked || x.lgu_srp_ceiling != null) && (!$('#stock').checked || x.in_stock));
  const showFeatured = !q && !c && !$('#capped').checked && !$('#stock').checked && promotedProducts.length > 0;
  const out = showFeatured ? filtered.filter(product => !promotedProductIds.has(product.id)) : filtered;
  $('#products-featured-products-section').style.display = showFeatured ? 'block' : 'none';
  $('#count').textContent = `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}${showFeatured ? ' total' : ''}`;
  $('#results').innerHTML = out.map(x => productCard(x, byId[x.store_id])).join('') ||
    (showFeatured
      ? '<div class="empty" style="grid-column:1/-1"><p class="muted">All products are featured above.</p></div>'
      : '<div class="empty" style="grid-column:1/-1"><h3>No products found</h3><p class="muted">Try another word or clear a filter.</p></div>');
}
$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'capped', 'stock'].forEach(id => $('#' + id).addEventListener('input', render));
render();
initializeFeaturedProductsCarousel($('#products-featured-products-section'));