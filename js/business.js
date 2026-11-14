import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderChrome, $, esc, CATS, PAY, badges, openPill, hours, productCard } from './ui.js';
import { getStore, getProducts } from './data.js';
import { getSession, getCachedProfile } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('', session, profile);

const trn = new URLSearchParams(location.search).get('trn');
const s = trn && await getStore(trn);
const main = $('#main');
if (!s) {
  main.innerHTML = '<section><div class="wrap"><div class="empty"><h1 style="font-size:1.6rem">We could not find that business</h1><p><a class="btn" href="/explore/">Browse all stores</a></p></div></div></section>';
} else {
  document.title = `${s.business_name} | PaliTrento`;
  const prods = s.verification_status === 'VERIFIED'
    ? (await getProducts()).filter(p => p.store_id === s.id)
    : [];
  const tel = s.contact_number;
  const description = s.description?.trim();
  main.innerHTML = `
  <div class="bhead"><div class="wrap">
    <div class="business-heading">
      <div class="business-heading-copy">
        <p class="muted">${esc(CATS[s.trade_category])}</p>
        <h1 style="font-size:clamp(2rem,4vw,2.8rem);margin:4px 0 12px">${esc(s.business_name)}</h1>
        ${description ? `<p class="store-description">${esc(description)}</p>` : ''}
        <div>${openPill(s)}${badges(s)}</div>
        <p style="margin-top:16px"><a class="btn" href="tel:${esc(tel)}">Call ${esc(tel)}</a>
        <a class="btn alt" href="https://www.openstreetmap.org/directions?to=${s.lat}%2C${s.lng}" target="_blank" rel="noopener">Get directions</a></p>
      </div>
      ${s.storefront_image_url ? `<img class="business-storefront" src="${esc(s.storefront_image_url)}" alt="${esc(s.business_name)} storefront" loading="eager" decoding="async">` : ''}
    </div>
  </div></div>
  <section><div class="wrap cols">
    <dl>
      <dt>Owner</dt><dd>${esc(s.proprietor_name)}</dd>
      <dt>Hours</dt><dd>${hours(s)}, daily</dd>
      <dt>Address</dt><dd>${esc(s.purok)}, ${esc(s.barangay)}, Trento</dd>
      <dt>Landmark</dt><dd>${esc(s.landmark_reference)}</dd>
      <dt>Accepts</dt><dd>${(s.accepted_payments || []).filter(x => Object.prototype.hasOwnProperty.call(PAY, x)).map(x => PAY[x]).join(', ') || '—'}</dd>
      <dt>Store ID</dt><dd>${esc(s.trn_code)}</dd>
    </dl>
    <div id="mini" class="mini" role="img" aria-label="Map showing ${esc(s.business_name)}"></div>
  </div></section>
  <section style="padding-top:0"><div class="wrap">
    <h2 style="margin-bottom:16px">Products and prices</h2>
    <div class="grid">${prods.map(p => productCard(p)).join('') || '<div class="empty" style="grid-column:1/-1"><p class="muted">This store has not listed products yet.</p></div>'}</div>
  </div></section>`;
  const m = L.map('mini', { scrollWheelZoom: false }).setView([s.lat, s.lng], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
  L.circleMarker([s.lat, s.lng], { radius: 10, color: '#14351f', fillColor: '#e59834', fillOpacity: 1, weight: 3 }).addTo(m);
}
