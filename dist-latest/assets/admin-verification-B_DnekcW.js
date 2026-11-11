import{$ as o,r as E,B as $,e as n,C as v,P as _,b as x}from"./ui-vxAF6k0x.js";import{i as I,a as C,b as w,f as y}from"./auth-BJIzV8-u.js";const p=o("#store-modal"),g=o("#modal-content"),l=o("#stores-list"),m=o("#no-stores"),h=o("#verification-stats");let b=[],s={status:"PENDING",barangay:"",search:""};async function R(){if(!I())return;const i=await C();if(!i){window.location.href="login.html";return}const t=await w(i.user.id);if(!t||t.role!=="admin"){window.location.href="index.html";return}E("admin-verification.html",i,t);const e=o("#filter-barangay");e.innerHTML='<option value="">All barangays</option>'+$.map(a=>`<option value="${n(a)}">${n(a)}</option>`).join(""),o("#filter-status")?.addEventListener("change",a=>{s.status=a.target.value,c()}),o("#filter-barangay")?.addEventListener("change",a=>{s.barangay=a.target.value,c()}),o("#filter-search")?.addEventListener("input",L(a=>{s.search=a.target.value.toLowerCase(),c()},300)),o("#modal-close")?.addEventListener("click",f),p?.addEventListener("click",a=>{a.target===p&&f()}),await c()}function L(i,t){let e;return(...a)=>{clearTimeout(e),e=setTimeout(()=>i(...a),t)}}async function c(){let i=y.from("stores").select("*");s.status!=="ALL"&&(i=i.eq("verification_status",s.status)),s.barangay&&(i=i.eq("barangay",s.barangay));const{data:t,error:e}=await i.order("created_at",{ascending:!1});if(e){console.error("Load stores error:",e);return}let a=t||[];s.search&&(a=a.filter(d=>d.business_name?.toLowerCase().includes(s.search)||d.proprietor_name?.toLowerCase().includes(s.search)||d.trn_code?.toLowerCase().includes(s.search))),b=a,A(a),D(a)}function A(i){const t={PENDING:0,VERIFIED:0,REJECTED:0,CLARIFICATION_REQUIRED:0};i.forEach(e=>{t[e.verification_status]!==void 0&&t[e.verification_status]++}),h.innerHTML=`
    <span class="pill warn" style="font-size:.9rem">Pending: ${t.PENDING}</span>
    <span class="pill ok" style="font-size:.9rem">Verified: ${t.VERIFIED}</span>
    <span class="pill bad" style="font-size:.9rem">Rejected: ${t.REJECTED}</span>
    <span class="pill info" style="font-size:.9rem">Clarification: ${t.CLARIFICATION_REQUIRED}</span>
    <span class="pill" style="font-size:.9rem;background:var(--muted-bg);color:var(--muted)">Total: ${i.length}</span>
  `}function D(i){if(i.length===0){l.style.display="none",m.style.display="block";return}m.style.display="none",l.style.display="grid",l.innerHTML=i.map(t=>`
    <div class="card" style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <h3 style="margin:0 0 4px;font-size:1rem">${n(t.business_name)}</h3>
          <span class="muted" style="font-size:.8rem">${t.trn_code}</span>
        </div>
        ${N(t.verification_status)}
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${n(v[t.trade_category]||t.trade_category)} • ${n(t.barangay)}, ${n(t.purok||"—")}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${n(t.proprietor_name)} • ${n(t.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(t.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</p>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:.85rem;padding:8px 12px" data-review="${t.id}">Review</button>
        <button class="btn alt" style="flex:1;font-size:.85rem;padding:8px 12px" data-view="${t.id}">View</button>
      </div>
    </div>
  `).join(""),l.querySelectorAll("[data-review]").forEach(t=>{t.addEventListener("click",()=>u(t.dataset.review,!0))}),l.querySelectorAll("[data-view]").forEach(t=>{t.addEventListener("click",()=>u(t.dataset.view,!1))})}function N(i){const t={PENDING:"warn",VERIFIED:"ok",REJECTED:"bad",CLARIFICATION_REQUIRED:"info"},e={PENDING:"Pending",VERIFIED:"Verified",REJECTED:"Rejected",CLARIFICATION_REQUIRED:"Clarification"};return`<span class="pill ${t[i]||"warn"}">${e[i]||i}</span>`}function u(i,t=!1){const e=b.find(r=>r.id===i);if(!e)return;const a=(e.accepted_payments||[]).map(r=>_[r]||r).join(", ")||"—",d=x(e);g.innerHTML=`
    <div style="display:grid;gap:20px">
      <!-- Basic Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><strong>Business name:</strong> ${n(e.business_name)}</div>
        <div><strong>TRN Code:</strong> ${n(e.trn_code)}</div>
        <div><strong>Category:</strong> ${n(v[e.trade_category]||e.trade_category)}</div>
        <div><strong>Proprietor:</strong> ${n(e.proprietor_name)}</div>
        <div><strong>Contact:</strong> ${n(e.contact_number)}</div>
        <div><strong>Barangay:</strong> ${n(e.barangay)}, ${n(e.purok||"—")}</div>
        <div><strong>Landmark:</strong> ${n(e.landmark_reference)}</div>
        <div><strong>Coordinates:</strong> ${e.lat}, ${e.lng}</div>
        <div><strong>Hours:</strong> ${e.open_time} – ${e.close_time}</div>
        <div><strong>Payments:</strong> ${n(a)}</div>
      </div>

      ${d?`<div>${d}</div>`:""}

      <!-- Images -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <strong>Storefront:</strong><br>
          ${e.storefront_image_url?`<img src="${n(e.storefront_image_url)}" alt="Storefront" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">`:'<span class="muted">Not provided</span>'}
        </div>
        <div>
          <strong>Permits:</strong><br>
          ${e.permits_image_url?`<img src="${n(e.permits_image_url)}" alt="Permits" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">`:'<span class="muted">Not provided</span>'}
        </div>
      </div>

      <!-- Verification Actions -->
      ${t?`
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Verification Action:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn ok" data-action="VERIFIED" data-id="${e.id}">Approve (Verified)</button>
            <button class="btn warn" data-action="CLARIFICATION_REQUIRED" data-id="${e.id}">Needs Clarification</button>
            <button class="btn bad" data-action="REJECTED" data-id="${e.id}">Reject</button>
          </div>
          <div style="margin-top:12px">
            <label for="admin-notes">Notes (sent to owner)</label>
            <textarea id="admin-notes" rows="3" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)"></textarea>
          </div>
        </div>
      `:""}
    </div>
  `,p.style.display="flex",g.querySelectorAll("[data-action]").forEach(r=>{r.addEventListener("click",()=>T(r.dataset.id,r.dataset.action))})}async function T(i,t){const e=o("#admin-notes")?.value||"",a=g.querySelector(`[data-action="${t}"]`),d=a.textContent;a.disabled=!0,a.textContent="Updating...";try{const{error:r}=await y.from("stores").update({verification_status:t,admin_notes:e}).eq("id",i);if(r)throw r;f(),await c()}catch(r){console.error("Update error:",r),alert("Failed to update. Please try again.")}finally{a.disabled=!1,a.textContent=d}}function f(){p.style.display="none"}R();
