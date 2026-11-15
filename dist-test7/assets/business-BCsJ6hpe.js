import"./modulepreload-polyfill-B5Qt9EMX.js";import{L as a}from"./leaflet-BQVByHHQ.js";import{r as g,s as u,$ as f,e as t,C as h,a as v,b as $,h as b,P as n,p as y}from"./ui-BQtFlIep.js";import{g as w,a as _}from"./data-GB8NF_Ip.js";import{getSession as P,getCachedProfile as T}from"./auth-BNd5RyvG.js";import"./styles-lfujndA6.js";import"./supabase-qt0oOlL5.js";const i=await P();let p=null;i&&(p=await T(i.user.id));g("",i,p);i&&u();const l=new URLSearchParams(location.search).get("trn"),s=l&&await w(l),c=f("#main");if(!s)c.innerHTML='<section><div class="wrap"><div class="empty"><h1 style="font-size:1.6rem">We could not find that business</h1><p><a class="btn" href="/explore/">Browse all stores</a></p></div></div></section>';else{document.title=`${s.business_name} | PaliTrento`;const m=s.verification_status==="VERIFIED"?(await _()).filter(e=>e.store_id===s.id):[],r=s.contact_number,o=s.description?.trim();c.innerHTML=`
  <div class="bhead"><div class="wrap">
    <div class="business-heading">
      <div class="business-heading-copy">
        <p class="muted">${t(h[s.trade_category])}</p>
        <h1 style="font-size:clamp(2rem,4vw,2.8rem);margin:4px 0 12px">${t(s.business_name)}</h1>
        ${o?`<p class="store-description">${t(o)}</p>`:""}
        <div>${v(s)}${$(s)}</div>
        <p style="margin-top:16px"><a class="btn" href="tel:${t(r)}">Call ${t(r)}</a>
        <a class="btn alt" href="https://www.openstreetmap.org/directions?to=${s.lat}%2C${s.lng}" target="_blank" rel="noopener">Get directions</a></p>
      </div>
      ${s.storefront_image_url?`<img class="business-storefront" src="${t(s.storefront_image_url)}" alt="${t(s.business_name)} storefront" loading="eager" decoding="async">`:""}
    </div>
  </div></div>
  <section><div class="wrap cols">
    <dl>
      <dt>Owner</dt><dd>${t(s.proprietor_name)}</dd>
      <dt>Hours</dt><dd>${b(s)}, daily</dd>
      <dt>Address</dt><dd>${t(s.purok)}, ${t(s.barangay)}, Trento</dd>
      <dt>Landmark</dt><dd>${t(s.landmark_reference)}</dd>
      <dt>Accepts</dt><dd>${(s.accepted_payments||[]).filter(e=>Object.prototype.hasOwnProperty.call(n,e)).map(e=>n[e]).join(", ")||"—"}</dd>
      <dt>Store ID</dt><dd>${t(s.trn_code)}</dd>
    </dl>
    <div id="mini" class="mini" role="img" aria-label="Map showing ${t(s.business_name)}"></div>
  </div></section>
  <section style="padding-top:0"><div class="wrap">
    <h2 style="margin-bottom:16px">Products and prices</h2>
    <div class="grid">${m.map(e=>y(e)).join("")||'<div class="empty" style="grid-column:1/-1"><p class="muted">This store has not listed products yet.</p></div>'}</div>
  </div></section>`;const d=a.map("mini",{scrollWheelZoom:!1}).setView([s.lat,s.lng],16);a.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(d),a.circleMarker([s.lat,s.lng],{radius:10,color:"#14351f",fillColor:"#e59834",fillOpacity:1,weight:3}).addTo(d)}
