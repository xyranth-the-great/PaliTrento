import { renderChrome, $, productCard } from './ui.js';
import { getStores, getProducts } from './data.js';
import { getSession, getCachedProfile } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('products.html', session, profile);

const [stores, products] = await Promise.all([getStores(), getProducts()]);
const byId = Object.fromEntries(stores.map(s => [s.id, s]));
const cats = [...new Set(products.map(x => x.category))].sort();
$('#cat').insertAdjacentHTML('beforeend', cats.map(c => `<option>${c}</option>`).join(''));
function render() {
  const q = $('#q').value.trim().toLowerCase(), c = $('#cat').value;
  const out = products.filter(x => (!q || x.name.toLowerCase().includes(q)) && (!c || x.category === c) &&
    (!$('#capped').checked || x.lgu_srp_ceiling != null) && (!$('#stock').checked || x.in_stock));
  $('#count').textContent = `${out.length} ${out.length === 1 ? 'product' : 'products'}`;
  $('#results').innerHTML = out.map(x => productCard(x, byId[x.store_id])).join('') ||
    '<div class="empty" style="grid-column:1/-1"><h3>No products found</h3><p class="muted">Try another word or clear a filter.</p></div>';
}
$('#f').addEventListener('submit', e => e.preventDefault());
['q', 'cat', 'capped', 'stock'].forEach(id => $('#' + id).addEventListener('input', render));
render();