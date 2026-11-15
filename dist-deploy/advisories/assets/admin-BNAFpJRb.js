import"./modulepreload-polyfill-B5Qt9EMX.js";import{r as o,s as c,$ as r,e as a,C as d}from"./ui-RYbaGHoh.js";import{isSupabaseConfigured as l,checkAuthErrorParams as m,getSessionWithStatus as f}from"./auth-_FXb4y8X.js";import{supabase as s}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";async function p(){if(!l())return;const n=m();if(n){window.location.replace(n);return}const{session:i,profile:e,redirectUrl:t}=await f();if(t){window.location.replace(t);return}if(!i){window.location.href="/login/";return}if(!e||e.role!=="admin"){window.location.href="/";return}o("/admin/",i,e),c(),await u(),await g()}async function u(){const{data:n,error:i}=await s.from("stores").select("verification_status");if(i||!n)return;const e={PENDING:0,VERIFIED:0,REJECTED:0,CLARIFICATION_REQUIRED:0};n.forEach(t=>{e[t.verification_status]!==void 0&&e[t.verification_status]++}),r("#stat-pending").textContent=e.PENDING,r("#stat-verified").textContent=e.VERIFIED,r("#stat-rejected").textContent=e.REJECTED+e.CLARIFICATION_REQUIRED,r("#stat-total-stores").textContent=n.length}async function g(){const{data:n,error:i}=await s.from("stores").select("*").eq("verification_status","PENDING").order("created_at",{ascending:!1}).limit(6);if(i||!n||n.length===0){r("#no-pending").style.display="block";return}const e=r("#recent-pending");e.style.display="grid",e.innerHTML=n.map(t=>`
    <div class="card" style="display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h3 style="margin:0;font-size:1rem">${a(t.business_name)}</h3>
        <span class="pill warn">Pending</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${a(d[t.trade_category]||t.trade_category)} • ${a(t.barangay)}, ${a(t.purok||"—")}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${a(t.proprietor_name)} • ${a(t.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(t.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</p>
      <a href="/admin-verification/?trn=${encodeURIComponent(t.trn_code)}" class="btn" style="width:100%;text-align:center;font-size:.85rem;padding:8px 12px">Review</a>
    </div>
  `).join("")}p();
