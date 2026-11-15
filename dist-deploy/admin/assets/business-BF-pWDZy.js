import"./modulepreload-polyfill-B5Qt9EMX.js";import{L as i}from"./leaflet-BQVByHHQ.js";import{r as g,s as h,$ as f,e as s,C as v,a as $,b,h as w,P as n,p as y}from"./ui-RYbaGHoh.js";import{g as _,a as P}from"./data-GB8NF_Ip.js";import{checkAuthErrorParams as T,getSessionWithStatus as C}from"./auth-_FXb4y8X.js";import"./styles-lfujndA6.js";import"./supabase-qt0oOlL5.js";const l=T();l&&window.location.replace(l);const{session:a,profile:x,redirectUrl:c}=await C();c&&window.location.replace(c);g("",a,x);a&&h();const p=new URLSearchParams(location.search).get("trn"),t=p&&await _(p),m=f("#main");if(!t)m.innerHTML='<section><div class="wrap"><div class="empty"><h1 style="font-size:1.6rem">We could not find that business</h1><p><a class="btn" href="/explore/">Browse all stores</a></p></div></div></section>';else{document.title=`${t.business_name} | PaliTrento`;const u=t.verification_status==="VERIFIED"?(await P()).filter(e=>e.store_id===t.id):[],r=t.contact_number,o=t.description?.trim();m.innerHTML=`
  <div class="bhead"><div class="wrap">
    <div class="business-heading">
      <div class="business-heading-copy">
        <p class="muted">${s(v[t.trade_category])}</p>
        <h1 style="font-size:clamp(2rem,4vw,2.8rem);margin:4px 0 12px">${s(t.business_name)}</h1>
        ${o?`<p class="store-description">${s(o)}</p>`:""}
        <div>${$(t)}${b(t)}</div>
        <p style="margin-top:16px"><a class="btn" href="tel:${s(r)}">Call ${s(r)}</a>
        <a class="btn alt" href="https://www.openstreetmap.org/directions?to=${t.lat}%2C${t.lng}" target="_blank" rel="noopener">Get directions</a>
        ${a&&t.verification_status==="VERIFIED"?`<a class="btn alt" href="/report-business/?storeId=${encodeURIComponent(t.id)}">Report Business</a>`:""}</p>
      </div>
      ${t.storefront_image_url?`<img class="business-storefront" src="${s(t.storefront_image_url)}" alt="${s(t.business_name)} storefront" loading="eager" decoding="async">`:""}
    </div>
  </div></div>
  <section><div class="wrap cols">
    <dl>
      <dt>Owner</dt><dd>${s(t.proprietor_name)}</dd>
      <dt>Hours</dt><dd>${w(t)}, daily</dd>
      <dt>Address</dt><dd>${s(t.purok)}, ${s(t.barangay)}, Trento</dd>
      <dt>Landmark</dt><dd>${s(t.landmark_reference)}</dd>
      <dt>Accepts</dt><dd>${(t.accepted_payments||[]).filter(e=>Object.prototype.hasOwnProperty.call(n,e)).map(e=>n[e]).join(", ")||"—"}</dd>
      <dt>Store ID</dt><dd>${s(t.trn_code)}</dd>
    </dl>
    <div id="mini" class="mini" role="img" aria-label="Map showing ${s(t.business_name)}"></div>
  </div></section>
  <section style="padding-top:0"><div class="wrap">
    <h2 style="margin-bottom:16px">Products and prices</h2>
    <div class="grid">${u.map(e=>y(e)).join("")||'<div class="empty" style="grid-column:1/-1"><p class="muted">This store has not listed products yet.</p></div>'}</div>
  </div></section>`;const d=i.map("mini",{scrollWheelZoom:!1}).setView([t.lat,t.lng],16);i.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(d),i.circleMarker([t.lat,t.lng],{radius:10,color:"#14351f",fillColor:"#e59834",fillOpacity:1,weight:3}).addTo(d)}
