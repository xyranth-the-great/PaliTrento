import"./modulepreload-polyfill-B5Qt9EMX.js";import{r as o,s as c,$ as s,e as a,C as d}from"./ui-BQtFlIep.js";import{isSupabaseConfigured as l,getSession as m,getCachedProfile as f}from"./auth-BNd5RyvG.js";import{supabase as r}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";async function p(){if(!l())return;const e=await m();if(!e){window.location.href="/login/";return}const i=await f(e.user.id);if(!i||i.role!=="admin"){window.location.href="/";return}o("/admin/",e,i),c(),await u(),await g()}async function u(){const{data:e,error:i}=await r.from("stores").select("verification_status");if(i||!e)return;const n={PENDING:0,VERIFIED:0,REJECTED:0,CLARIFICATION_REQUIRED:0};e.forEach(t=>{n[t.verification_status]!==void 0&&n[t.verification_status]++}),s("#stat-pending").textContent=n.PENDING,s("#stat-verified").textContent=n.VERIFIED,s("#stat-rejected").textContent=n.REJECTED+n.CLARIFICATION_REQUIRED,s("#stat-total-stores").textContent=e.length}async function g(){const{data:e,error:i}=await r.from("stores").select("*").eq("verification_status","PENDING").order("created_at",{ascending:!1}).limit(6);if(i||!e||e.length===0){s("#no-pending").style.display="block";return}const n=s("#recent-pending");n.style.display="grid",n.innerHTML=e.map(t=>`
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
