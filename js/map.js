import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderChrome, $, esc, CATS, isOpen, startAdvisoryToastListener } from './ui.js';
import { getStores } from './data.js';
import { getSession, getCachedProfile } from './auth.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('/map/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

const stores = (await getStores()).filter(s => s.lat && s.lng);
const COLORS = { SARI_SARI: '#2d6a42', PHARMACY: '#1f4d2e', AGRI: '#7a4a1e', CARINDERIA: '#b3412c', FRESH_PRODUCE: '#1d6a3d', SERVICES: '#3b7a4c' };
const map = L.map('map').setView([8.0461, 126.0618], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const markers = {};
stores.forEach(s => {
  markers[s.id] = L.circleMarker([s.lat, s.lng], { radius: 9, color: '#fff', weight: 2, fillColor: COLORS[s.trade_category] || '#1f4d2e', fillOpacity: 1 })
    .addTo(map).bindPopup(`<strong>${esc(s.business_name)}</strong><br>${esc(CATS[s.trade_category])}<br><a href="/business/?trn=${encodeURIComponent(s.trn_code)}">View details</a>`)
    .on('click', () => mark(s.id));
});
$('#list').innerHTML = stores.map(s => `<button class="card" data-id="${s.id}" aria-pressed="false">
  <h3>${esc(s.business_name)}</h3><p class="muted" style="margin:0">${esc(CATS[s.trade_category])}, ${esc(s.barangay)} (${isOpen(s) ? 'open now' : 'closed'})</p></button>`).join('');
function mark(id) { document.querySelectorAll('#list .card').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id)); }
$('#list').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  const s = stores.find(x => x.id === b.dataset.id);
  mark(s.id); map.flyTo([s.lat, s.lng], 16, { duration: .6 }); markers[s.id].openPopup();
});
let me;
$('#loc').addEventListener('click', () => {
  if (!navigator.geolocation) { $('#msg').textContent = 'Your browser does not support location.'; return; }
  $('#msg').textContent = 'Finding you...';
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    me?.remove(); me = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#2e6fbb', fillOpacity: 1 }).addTo(map).bindPopup('You are here');
    map.flyTo(ll, 15); $('#msg').textContent = '';
  }, () => { $('#msg').textContent = 'We could not get your location. Allow location access in your browser and try again.'; });
});