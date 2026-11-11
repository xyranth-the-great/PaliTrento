import{$ as n,r as g,B as f,e as s}from"./ui-vxAF6k0x.js";import{i as b,a as y,b as v,f as u}from"./auth-BJIzV8-u.js";const r=n("#broadcast-form"),d=n("#broadcast-msg"),o=n("#broadcasts-list"),p=n("#no-broadcasts"),w=n("#b-barangay");async function h(){if(!b())return;const a=await y();if(!a){window.location.href="login.html";return}const e=await v(a.user.id);if(!e||e.role!=="admin"){window.location.href="index.html";return}g("admin-prices.html",a,e),w.innerHTML='<option value="">All barangays</option>'+f.map(t=>`<option value="${s(t)}">${s(t)}</option>`).join(""),r.addEventListener("submit",x),await m()}async function x(a){a.preventDefault(),d.style.display="none";const e=r.querySelector('button[type="submit"]');e.disabled=!0,e.textContent="Sending...";try{const t=await y(),i={title:r.title.value.trim(),body:r.body.value.trim(),category:r.category.value,priority:r.priority.value,barangay:r.barangay.value||null,expires_at:r.expires_at.value?new Date(r.expires_at.value).toISOString():null,created_by:t.user.id};if(!i.title||!i.body){l("Title and message are required","bad");return}const{error:c}=await u.from("advisories").insert(i);if(c)throw c;l("Broadcast sent successfully!","ok"),r.reset(),await m()}catch(t){console.error("Broadcast error:",t),l("Failed to send. Please try again.","bad")}finally{e.disabled=!1,e.textContent="Send Broadcast"}}async function m(){const{data:a,error:e}=await u.from("advisories").select("*").order("published_at",{ascending:!1}).limit(50);if(e||!a||a.length===0){o.style.display="none",p.style.display="block";return}p.style.display="none",o.style.display="grid",o.innerHTML=a.map(t=>`
    <div class="card" style="border-left:4px solid ${S(t.priority)}">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h3 style="margin:0;font-size:1rem">${s(t.title)}</h3>
        <span class="pill ${$(t.category)}" style="font-size:.7rem">${t.category}</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${s(t.body)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.75rem;color:var(--muted)">
        <span>Priority: <strong>${t.priority}</strong></span>
        <span>Barangay: <strong>${t.barangay||"All"}</strong></span>
        <span>Sent: <strong>${new Date(t.published_at).toLocaleString("en-PH")}</strong></span>
        ${t.expires_at?`<span>Expires: <strong>${new Date(t.expires_at).toLocaleString("en-PH")}</strong></span>`:""}
      </div>
    </div>
  `).join("")}function $(a){return{PRICE_CAP:"ok",ANNOUNCEMENT:"info",EMERGENCY:"bad",GENERAL:"warn"}[a]||"warn"}function S(a){return{low:"var(--muted)",normal:"var(--info)",high:"var(--warn)",critical:"var(--bad)"}[a]||"var(--info)"}function l(a,e){d.textContent=a,d.className=`pill ${e}`}h();
