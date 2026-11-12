import{r as l,$ as a,e as s,C as f}from"./ui-DwUyflMc.js";import{i as u,a as p,b as g,f as i}from"./auth-Dmhd617G.js";async function m(){if(!u())return;const t=await p();if(!t){window.location.href="login.html";return}const r=await g(t.user.id);if(!r||r.role!=="admin"){window.location.href="index.html";return}l("admin-reports.html",t,r),await y()}async function y(){const{data:t,error:r}=await i.from("stores").select("verification_status, trade_category, barangay");if(r){console.error("Stores error:",r);return}const{data:n,error:e}=await i.from("products").select("lgu_srp_ceiling, current_price");e&&console.error("Products error:",e);let o=0;try{const{count:c,error:d}=await i.from("orders").select("*",{count:"exact",head:!0});d||(o=c||0)}catch{}w(t||[],n||[],o),h(t||[]),v(t||[]),C(n||[])}function w(t,r,n){const e=t.filter(o=>o.verification_status==="VERIFIED").length;a("#r-total-stores").textContent=t.length,a("#r-verified-stores").textContent=e,a("#r-total-products").textContent=r.length,a("#r-total-orders").textContent=n}function h(t){const r=a("#category-breakdown"),n={};t.forEach(e=>{n[e.trade_category]=(n[e.trade_category]||0)+1}),r.innerHTML=Object.entries(n).map(([e,o])=>`
    <div class="card" style="padding:16px;text-align:center">
      <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${o}</div>
      <div class="muted" style="font-size:.8rem">${s(f[e]||e)}</div>
    </div>
  `).join("")}function v(t){const r=a("#barangay-breakdown"),n={};t.forEach(e=>{n[e.barangay]=(n[e.barangay]||0)+1}),r.innerHTML=Object.entries(n).sort((e,o)=>o[1]-e[1]).map(([e,o])=>`
      <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center">
        <span class="muted" style="font-size:.85rem">${s(e)}</span>
        <span style="font-weight:700;color:var(--primary)">${o}</span>
      </div>
    `).join("")}function C(t){let r=0,n=0,e=0;t.forEach(o=>{o.lgu_srp_ceiling==null?e++:o.current_price<=o.lgu_srp_ceiling?r++:n++}),a("#r-within-cap").textContent=r,a("#r-over-cap").textContent=n,a("#r-no-cap").textContent=e}m();
