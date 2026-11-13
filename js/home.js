import { renderChrome, $, esc, storeCard, productCard, getActiveFeaturedProducts, initializeFeaturedProductsCarousel, srp, peso, UNITS, CATS } from './ui.js';
import logoUrl from '../logo.png';
import { getStores, getProducts } from './data.js';
import { getSession, getCachedProfile, getPostLoginPath } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
const postLoginPath = getPostLoginPath(profile?.role || session?.user?.user_metadata?.role);

if (session && postLoginPath !== 'index.html') {
  window.location.replace(postLoginPath);
} else {
  renderChrome('index.html', session, profile);

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
  $('#featured').innerHTML = stores.slice(0, 6).map(storeCard).join('');
}