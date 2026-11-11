import{r as o,$ as s,e as i,C as c}from"./ui-6LbWuQJe.js";import{i as d,a as l,b as m,f as r}from"./auth-BJIzV8-u.js";async function f(){if(!d())return;const e=await l();if(!e){window.location.href="login.html";return}const a=await m(e.user.id);if(!a||a.role!=="admin"){window.location.href="index.html";return}o("admin.html",e,a),await p(),await u()}async function p(){const{data:e,error:a}=await r.from("stores").select("verification_status");if(a||!e)return;const n={PENDING:0,VERIFIED:0,REJECTED:0,CLARIFICATION_REQUIRED:0};e.forEach(t=>{n[t.verification_status]!==void 0&&n[t.verification_status]++}),s("#stat-pending").textContent=n.PENDING,s("#stat-verified").textContent=n.VERIFIED,s("#stat-rejected").textContent=n.REJECTED+n.CLARIFICATION_REQUIRED,s("#stat-total-stores").textContent=e.length}async function u(){const{data:e,error:a}=await r.from("stores").select("*").eq("verification_status","PENDING").order("created_at",{ascending:!1}).limit(6);if(a||!e||e.length===0){s("#no-pending").style.display="block";return}const n=s("#recent-pending");n.style.display="grid",n.innerHTML=e.map(t=>`
    <div class="card" style="display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h3 style="margin:0;font-size:1rem">${i(t.business_name)}</h3>
        <span class="pill warn">Pending</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${i(c[t.trade_category]||t.trade_category)} • ${i(t.barangay)}, ${i(t.purok||"—")}</p>
      <p class="muted" style="margin:0 0 8px;font-size:.8rem">${i(t.proprietor_name)} • ${i(t.contact_number)}</p>
      <p class="muted" style="margin:0 0 12px;font-size:.75rem">Submitted ${new Date(t.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</p>
      <a href="admin-verification.html?trn=${encodeURIComponent(t.trn_code)}" class="btn" style="width:100%;text-align:center;font-size:.85rem;padding:8px 12px">Review</a>
    </div>
  `).join("")}f();
