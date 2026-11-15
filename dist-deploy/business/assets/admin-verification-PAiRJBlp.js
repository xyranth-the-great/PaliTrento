import"./modulepreload-polyfill-B5Qt9EMX.js";import{$ as o,r as $,B as _,e as i,C as y,P as u,b as w}from"./ui-RYbaGHoh.js";import{isSupabaseConfigured as x,checkAuthErrorParams as I,getSessionWithStatus as C}from"./auth-_FXb4y8X.js";import{supabase as b}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const p=o("#store-modal"),f=o("#modal-content"),l=o("#stores-list"),m=o("#no-stores"),h=o("#verification-stats");let E=[],s={status:"PENDING",barangay:"",search:""};async function R(){if(!x())return;const r=I();if(r){window.location.replace(r);return}const{session:e,profile:t,redirectUrl:n}=await C();if(n){window.location.replace(n);return}if(!e){window.location.href="/login/";return}if(!t||t.role!=="admin"){window.location.href="/";return}$("/admin-verification/",e,t);const d=o("#filter-barangay");d.innerHTML='<option value="">All barangays</option>'+_.map(a=>`<option value="${i(a)}">${i(a)}</option>`).join(""),o("#filter-status")?.addEventListener("change",a=>{s.status=a.target.value,c()}),o("#filter-barangay")?.addEventListener("change",a=>{s.barangay=a.target.value,c()}),o("#filter-search")?.addEventListener("input",L(a=>{s.search=a.target.value.toLowerCase(),c()},300)),o("#modal-close")?.addEventListener("click",g),p?.addEventListener("click",a=>{a.target===p&&g()}),await c()}function L(r,e){let t;return(...n)=>{clearTimeout(t),t=setTimeout(()=>r(...n),e)}}async function c(){let r=b.from("stores").select("*");s.status!=="ALL"&&(r=r.eq("verification_status",s.status)),s.barangay&&(r=r.eq("barangay",s.barangay));const{data:e,error:t}=await r.order("created_at",{ascending:!1});if(t){console.error("Load stores error:",t);return}let n=e||[];s.search&&(n=n.filter(d=>d.business_name?.toLowerCase().includes(s.search)||d.proprietor_name?.toLowerCase().includes(s.search)||d.trn_code?.toLowerCase().includes(s.search))),E=n,A(n),D(n)}function A(r){const e={PENDING:0,VERIFIED:0,REJECTED:0,CLARIFICATION_REQUIRED:0};r.forEach(t=>{e[t.verification_status]!==void 0&&e[t.verification_status]++}),h.innerHTML=`
    <span class="pill warn" style="font-size:.9rem">Pending: ${e.PENDING}</span>
    <span class="pill ok" style="font-size:.9rem">Verified: ${e.VERIFIED}</span>
    <span class="pill bad" style="font-size:.9rem">Rejected: ${e.REJECTED}</span>
    <span class="pill info" style="font-size:.9rem">Clarification: ${e.CLARIFICATION_REQUIRED}</span>
    <span class="pill" style="font-size:.9rem;background:var(--muted-bg);color:var(--muted)">Total: ${r.length}</span>
  `}function D(r){if(r.length===0){l.style.display="none",m.style.display="block";return}m.style.display="none",l.style.display="grid",l.innerHTML=r.map(e=>`
    <div class="card" style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <h3 style="margin:0 0 4px;font-size:1rem">${i(e.business_name)}</h3>
          <span class="muted" style="font-size:.8rem">${e.trn_code}</span>
        </div>
        ${N(e.verification_status)}
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${i(y[e.trade_category]||e.trade_category)} • ${i(e.barangay)}, ${i(e.purok||"—")}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${i(e.proprietor_name)} • ${i(e.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(e.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</p>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:.85rem;padding:8px 12px" data-review="${e.id}">Review</button>
        <button class="btn alt" style="flex:1;font-size:.85rem;padding:8px 12px" data-view="${e.id}">View</button>
      </div>
    </div>
  `).join(""),l.querySelectorAll("[data-review]").forEach(e=>{e.addEventListener("click",()=>v(e.dataset.review,!0))}),l.querySelectorAll("[data-view]").forEach(e=>{e.addEventListener("click",()=>v(e.dataset.view,!1))})}function N(r){const e={PENDING:"warn",VERIFIED:"ok",REJECTED:"bad",CLARIFICATION_REQUIRED:"info"},t={PENDING:"Pending",VERIFIED:"Verified",REJECTED:"Rejected",CLARIFICATION_REQUIRED:"Clarification"};return`<span class="pill ${e[r]||"warn"}">${t[r]||r}</span>`}function v(r,e=!1){const t=E.find(a=>a.id===r);if(!t)return;const n=(t.accepted_payments||[]).filter(a=>Object.prototype.hasOwnProperty.call(u,a)).map(a=>u[a]).join(", ")||"—",d=w(t);f.innerHTML=`
    <div style="display:grid;gap:20px">
      <!-- Basic Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><strong>Business name:</strong> ${i(t.business_name)}</div>
        <div><strong>TRN Code:</strong> ${i(t.trn_code)}</div>
        <div><strong>Category:</strong> ${i(y[t.trade_category]||t.trade_category)}</div>
        <div><strong>Proprietor:</strong> ${i(t.proprietor_name)}</div>
        <div><strong>Contact:</strong> ${i(t.contact_number)}</div>
        <div><strong>Barangay:</strong> ${i(t.barangay)}, ${i(t.purok||"—")}</div>
        <div><strong>Landmark:</strong> ${i(t.landmark_reference)}</div>
        <div><strong>Coordinates:</strong> ${t.lat}, ${t.lng}</div>
        <div><strong>Hours:</strong> ${t.open_time} – ${t.close_time}</div>
        <div><strong>Payments:</strong> ${i(n)}</div>
      </div>

      ${d?`<div>${d}</div>`:""}

      <!-- Images -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <strong>Storefront:</strong><br>
          ${t.storefront_image_url?`<img src="${i(t.storefront_image_url)}" alt="Storefront" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">`:'<span class="muted">Not provided</span>'}
        </div>
        <div>
          <strong>Permits:</strong><br>
          ${t.permits_image_url?`<img src="${i(t.permits_image_url)}" alt="Permits" style="max-width:100%;border-radius:var(--r-lg);margin-top:8px">`:'<span class="muted">Not provided</span>'}
        </div>
      </div>

      <!-- Verification Actions -->
      ${e?`
        <div style="border-top:1px solid var(--line);padding-top:20px">
          <strong>Verification Action:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn ok" data-action="VERIFIED" data-id="${t.id}">Approve (Verified)</button>
            <button class="btn warn" data-action="CLARIFICATION_REQUIRED" data-id="${t.id}">Needs Clarification</button>
            <button class="btn bad" data-action="REJECTED" data-id="${t.id}">Reject</button>
          </div>
          <div style="margin-top:12px">
            <label for="admin-notes">Notes (sent to owner)</label>
            <textarea id="admin-notes" rows="3" style="width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-md)"></textarea>
          </div>
        </div>
      `:""}
    </div>
  `,p.style.display="flex",f.querySelectorAll("[data-action]").forEach(a=>{a.addEventListener("click",()=>T(a.dataset.id,a.dataset.action))})}async function T(r,e){const t=o("#admin-notes")?.value||"",n=f.querySelector(`[data-action="${e}"]`),d=n.textContent;n.disabled=!0,n.textContent="Updating...";try{const{error:a}=await b.from("stores").update({verification_status:e,admin_notes:t}).eq("id",r);if(a)throw a;g(),await c()}catch(a){console.error("Update error:",a),alert("Failed to update. Please try again.")}finally{n.disabled=!1,n.textContent=d}}function g(){p.style.display="none"}R();
