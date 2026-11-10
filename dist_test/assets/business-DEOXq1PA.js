import{r as p,$ as m,e,C as g,o as h,b as u,h as v,P as f,a as $}from"./ui-ykS8AFOO.js";import{L as a}from"./leaflet-BQVByHHQ.js";import{g as b,a as w}from"./data-CsXX37X3.js";import{a as y,b as _}from"./auth-bXQxvQf8.js";const d=await y();let l=null;d&&(l=await _(d.user.id));p("",d,l);const o=new URLSearchParams(location.search).get("trn"),t=o&&await b(o),n=m("#main");if(!t)n.innerHTML='<section><div class="wrap"><div class="empty"><h1 style="font-size:1.6rem">We could not find that business</h1><p><a class="btn" href="explore.html">Browse all stores</a></p></div></div></section>';else{document.title=`${t.business_name} | PaliTrento`;const c=(await w()).filter(s=>s.store_id===t.id),i=t.contact_number;n.innerHTML=`
  <div class="bhead"><div class="wrap">
    <p class="muted">${e(g[t.trade_category])}</p>
    <h1 style="font-size:clamp(2rem,4vw,2.8rem);margin:4px 0 12px">${e(t.business_name)}</h1>
    <div>${h(t)}${u(t)}</div>
    <p style="margin-top:16px"><a class="btn" href="tel:${e(i)}">Call ${e(i)}</a>
    <a class="btn alt" href="https://www.openstreetmap.org/directions?to=${t.lat}%2C${t.lng}" target="_blank" rel="noopener">Get directions</a></p>
  </div></div>
  <section><div class="wrap cols">
    <dl>
      <dt>Owner</dt><dd>${e(t.proprietor_name)}</dd>
      <dt>Hours</dt><dd>${v(t)}, daily</dd>
      <dt>Address</dt><dd>${e(t.purok)}, ${e(t.barangay)}, Trento</dd>
      <dt>Landmark</dt><dd>${e(t.landmark_reference)}</dd>
      <dt>Accepts</dt><dd>${(t.accepted_payments||[]).map(s=>f[s]).join(", ")}</dd>
      <dt>Store ID</dt><dd>${e(t.trn_code)}</dd>
    </dl>
    <div id="mini" class="mini" role="img" aria-label="Map showing ${e(t.business_name)}"></div>
  </div></section>
  <section style="padding-top:0"><div class="wrap">
    <h2 style="margin-bottom:16px">Products and prices</h2>
    <div class="grid">${c.map(s=>$(s)).join("")||'<div class="empty" style="grid-column:1/-1"><p class="muted">This store has not listed products yet.</p></div>'}</div>
  </div></section>`;const r=a.map("mini",{scrollWheelZoom:!1}).setView([t.lat,t.lng],16);a.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(r),a.circleMarker([t.lat,t.lng],{radius:10,color:"#14351f",fillColor:"#e59834",fillOpacity:1,weight:3}).addTo(r)}
