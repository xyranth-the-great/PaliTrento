import"./modulepreload-polyfill-B5Qt9EMX.js";import{r as w,s as C,$ as e,e as m,o as M}from"./ui-BQtFlIep.js";import{getSession as E,getCachedProfile as S}from"./auth-BNd5RyvG.js";import{supabase as h}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const l=await E();let b=null;l&&(b=await S(l.user.id));w("/advisories/",l,b);l&&C();l?T():(e("#list").innerHTML=`
    <div class="empty" style="grid-column:1/-1;text-align:center;padding:48px 24px">
      <h3>Please log in to view notifications</h3>
      <p class="muted" style="margin-top:8px">You need to be logged in to see your notifications.</p>
      <a href="/login/" class="btn" style="margin-top:16px;display:inline-block">Log in</a>
    </div>
  `,e("#count").textContent="",e("#pagination").innerHTML="");const y=20;let r=1,u=1,g=[],d=[];async function T(){await P(),_(),v()}async function P(){if(!h||!l)return;const a=l.user.id;e("#list").innerHTML='<div class="muted" style="padding:16px;text-align:center;grid-column:1/-1">Loading...</div>';try{const{data:i,error:s}=await h.from("advisories").select("id, title, body, category, priority, published_at, barangay").lte("published_at",new Date().toISOString()).or("expires_at.is.null,expires_at.gt."+new Date().toISOString()).order("published_at",{ascending:!1});if(s)throw s;if(!i?.length){g=[],d=[];return}const{data:o}=await h.from("notification_reads").select("advisory_id").eq("user_id",a).in("advisory_id",i.map(n=>n.id)),t=new Set((o||[]).map(n=>n.advisory_id));g=i.map(n=>({...n,isRead:t.has(n.id)})),d=[...g]}catch(i){console.error("Load all advisories error:",i),e("#list").innerHTML='<div class="pill bad" style="padding:16px;text-align:center;grid-column:1/-1">Failed to load notifications</div>',e("#count").textContent="",e("#pagination").innerHTML=""}}function _(){const a=e("#q"),i=e("#cat"),s=e("#status");function o(){const n=a.value.trim().toLowerCase(),c=i.value,f=s.value;d=g.filter(p=>{const x=!n||p.title.toLowerCase().includes(n)||p.body.toLowerCase().includes(n),L=!c||p.category===c,$=!f||(f==="unread"?!p.isRead:p.isRead);return x&&L&&$}),r=1,v()}let t=null;a.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(o,200)}),i.addEventListener("change",o),s.addEventListener("change",o)}function v(){u=Math.ceil(d.length/y)||1,r=Math.min(r,u);const a=(r-1)*y,i=a+y,s=d.slice(a,i),o=d.filter(t=>!t.isRead).length;if(e("#count").textContent=`${d.length} notification${d.length!==1?"s":""} ${o>0?`(${o} unread)`:""}`,s.length===0){e("#list").innerHTML="",e("#empty").hidden=!1,e("#pagination").innerHTML="";return}e("#empty").hidden=!0,e("#list").innerHTML=s.map(t=>{const n={PRICE_CAP:"ok",ANNOUNCEMENT:"info",EMERGENCY:"bad",GENERAL:"warn"}[t.category]||"warn";return`
      <button class="notification-item ${t.isRead?"read":"unread"}" data-id="${t.id}" role="option" tabindex="0">
        <span class="notification-cat pill ${n}">${t.category.replace("_"," ")}</span>
        <div class="notification-content">
          <strong>${m(t.title)}</strong>
          <p class="muted">${m(t.body)}</p>
          <span class="muted">${new Date(t.published_at).toLocaleString("en-PH")}${t.barangay?` • ${m(t.barangay)}`:""}</span>
        </div>
        ${t.isRead?"":'<span class="notification-dot" aria-hidden="true"></span>'}
      </button>
    `}).join(""),e("#list").querySelectorAll(".notification-item").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.id,c=g.find(f=>f.id===n);c&&(await M(c),c.isRead=!0,t.classList.remove("unread"),t.classList.add("read"),t.querySelector(".notification-dot")?.remove(),A())})}),H()}function A(){const a=d.filter(i=>!i.isRead).length;e("#count").textContent=`${d.length} notification${d.length!==1?"s":""} ${a>0?`(${a} unread)`:""}`}function H(){const a=e("#pagination");if(u<=1){a.innerHTML="";return}let i="";i+=`
    <button class="btn alt" ${r===1?"disabled":""} data-page="${r-1}" style="padding:8px 16px;font-size:.9rem">
      Previous
    </button>
  `;let s=Math.max(1,r-2),o=Math.min(u,s+4);o-s<4&&(s=Math.max(1,o-4));for(let t=s;t<=o;t++)i+=`
      <button class="${t===r?"btn":"btn alt"}" data-page="${t}" style="padding:8px 16px;font-size:.9rem;min-width:44px">
        ${t}
      </button>
    `;i+=`
    <button class="btn alt" ${r===u?"disabled":""} data-page="${r+1}" style="padding:8px 16px;font-size:.9rem">
      Next
    </button>
  `,a.innerHTML=i,a.querySelectorAll("button[data-page]").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.page,10);n>=1&&n<=u&&n!==r&&(r=n,v(),e("#list").scrollIntoView({behavior:"smooth",block:"start"}))})})}
