import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderChrome, $, esc, CATS, PAY, badges, openPill, hours, productCard, startAdvisoryToastListener, peso, srp, UNITS, ensureLiquidChromeStill, premiumSellerLabel } from './ui.js';
import { getStore, getProducts, hasAvailableQuantity } from './data.js';
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
renderChrome('', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

const trn = new URLSearchParams(location.search).get('trn');
const s = trn && await getStore(trn);
const main = $('#main');
if (!s) {
  main.innerHTML = '<section><div class="wrap"><div class="empty"><h1 style="font-size:1.6rem">We could not find that business</h1><p><a class="btn" href="/explore/">Browse all stores</a></p></div></div></section>';
} else {
  document.title = `${s.business_name} | PaliTrento`;

  // Check if store is premium
  let isPremiumStore = false;
  if (supabase && s.user_id) {
    try {
      const { data: sub } = await supabase.rpc('get_user_subscription', { p_user_id: s.user_id });
      if (sub && sub.length > 0) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('code')
          .eq('id', sub[0].plan_id)
          .single();
        if (plan && plan.code === 'PREMIUM' && sub[0].status === 'ACTIVE') {
          isPremiumStore = true;
        }
      }
      if (isPremiumStore) ensureLiquidChromeStill();
    } catch (err) {
      console.warn('Could not check premium status:', err);
    }
  }

  // Fetch locked product IDs to filter them out from public view
  let lockedProductIds = new Set();
  if (supabase && !(session && session.user.id === s.user_id)) {
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

  const prods = (s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED')
    ? (await getProducts()).filter(p => p.store_id === s.id && !lockedProductIds.has(p.id) && hasAvailableQuantity(p))
    : [];
  const tel = s.contact_number;
  const description = s.description?.trim();
  const premiumBadge = isPremiumStore ? premiumSellerLabel('pill premium premium-heading-label') : '';

  main.innerHTML = `
  <div class="bhead"><div class="wrap">
    <div class="business-heading">
      <div class="business-heading-copy">
        <p class="muted">${esc(CATS[s.trade_category])}</p>
        <h1 style="font-size:clamp(2rem,4vw,2.8rem);margin:4px 0 12px">${esc(s.business_name)}${premiumBadge}</h1>
        ${description ? `<p class="store-description">${esc(description)}</p>` : ''}
        <div>${openPill(s)}${badges(s)}</div>
        <p style="margin-top:16px"><a class="btn" href="tel:${esc(tel)}">Call ${esc(tel)}</a>
        <a class="btn alt" href="https://www.openstreetmap.org/directions?to=${s.lat}%2C${s.lng}" target="_blank" rel="noopener">Get directions</a>
        ${session && session.user.id !== s.user_id && (s.certificate_status === 'APPROVED' || s.approval_status === 'APPROVED') ? `<a class="btn alt" href="/report-business/?storeId=${encodeURIComponent(s.id)}">Report Business</a>` : ''}</p>
      </div>
      ${s.storefront_image_url ? `<img class="business-storefront" src="${esc(s.storefront_image_url)}" alt="${esc(s.business_name)} storefront" loading="eager" decoding="async">` : ''}
    </div>
  </div></div>
  <section><div class="wrap cols">
    <dl>
      <dt>Owner</dt><dd>${esc(s.proprietor_name)}</dd>
      <dt>Hours</dt><dd>${hours(s)}, daily</dd>
      <dt>Address</dt><dd>${esc(s.purok)}, ${esc(s.barangay)}, Trento</dd>
      <dt>Landmark</dt><dd>${esc(s.landmark_reference)}</dd
      <dt>Accepts</dt><dd>${(s.accepted_payments || []).filter(x => Object.prototype.hasOwnProperty.call(PAY, x)).map(x => PAY[x]).join(', ') || '—'}</dd>
      <dt>Store ID</dt><dd>${esc(s.trn_code)}</dd>
    </dl>
    <div id="mini" class="mini" role="img" aria-label="Map showing ${esc(s.business_name)}"></div>
  </div></section>
  <section style="padding-top:0"><div class="wrap">
    <h2 style="margin-bottom:16px">Products and prices</h2>
    <div class="grid">${prods.map(p => productCard(p, s, isPremiumStore)).join('') || '<div class="empty" style="grid-column:1/-1"><p class="muted">This store has not listed products yet.</p></div>'}</div>
  </div></section>`;
  const m = L.map('mini', { scrollWheelZoom: false }).setView([s.lat, s.lng], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
  L.circleMarker([s.lat, s.lng], { radius: 10, color: '#14351f', fillColor: '#e59834', fillOpacity: 1, weight: 3 }).addTo(m);
}
