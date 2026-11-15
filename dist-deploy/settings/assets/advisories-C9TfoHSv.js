import"./modulepreload-polyfill-B5Qt9EMX.js";import{r as E,s as M,$ as e,e as m,o as C}from"./ui-RYbaGHoh.js";import{checkAuthErrorParams as S,getSessionWithStatus as T}from"./auth-_FXb4y8X.js";import{supabase as h}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const b=S();b&&window.location.replace(b);const{session:g,profile:P,redirectUrl:x}=await T();x&&window.location.replace(x);E("/advisories/",g,P);g&&M();g?_():(e("#list").innerHTML=`
    <div class="empty" style="grid-column:1/-1;text-align:center;padding:48px 24px">
      <h3>Please log in to view notifications</h3>
      <p class="muted" style="margin-top:8px">You need to be logged in to see your notifications.</p>
      <a href="/login/" class="btn" style="margin-top:16px;display:inline-block">Log in</a>
    </div>
  `,e("#count").textContent="",e("#pagination").innerHTML="");const y=20;let r=1,c=1,p=[],d=[];async function _(){await A(),R(),v()}async function A(){if(!h||!g)return;const a=g.user.id;e("#list").innerHTML='<div class="muted" style="padding:16px;text-align:center;grid-column:1/-1">Loading...</div>';try{const{data:i,error:o}=await h.from("advisories").select("id, title, body, category, priority, published_at, barangay").lte("published_at",new Date().toISOString()).or("expires_at.is.null,expires_at.gt."+new Date().toISOString()).order("published_at",{ascending:!1});if(o)throw o;if(!i?.length){p=[],d=[];return}const{data:s}=await h.from("notification_reads").select("advisory_id").eq("user_id",a).in("advisory_id",i.map(n=>n.id)),t=new Set((s||[]).map(n=>n.advisory_id));p=i.map(n=>({...n,isRead:t.has(n.id)})),d=[...p]}catch(i){console.error("Load all advisories error:",i),e("#list").innerHTML='<div class="pill bad" style="padding:16px;text-align:center;grid-column:1/-1">Failed to load notifications</div>',e("#count").textContent="",e("#pagination").innerHTML=""}}function R(){const a=e("#q"),i=e("#cat"),o=e("#status");function s(){const n=a.value.trim().toLowerCase(),l=i.value,f=o.value;d=p.filter(u=>{const L=!n||u.title.toLowerCase().includes(n)||u.body.toLowerCase().includes(n),$=!l||u.category===l,w=!f||(f==="unread"?!u.isRead:u.isRead);return L&&$&&w}),r=1,v()}let t=null;a.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(s,200)}),i.addEventListener("change",s),o.addEventListener("change",s)}function v(){c=Math.ceil(d.length/y)||1,r=Math.min(r,c);const a=(r-1)*y,i=a+y,o=d.slice(a,i),s=d.filter(t=>!t.isRead).length;if(e("#count").textContent=`${d.length} notification${d.length!==1?"s":""} ${s>0?`(${s} unread)`:""}`,o.length===0){e("#list").innerHTML="",e("#empty").hidden=!1,e("#pagination").innerHTML="";return}e("#empty").hidden=!0,e("#list").innerHTML=o.map(t=>{const n={PRICE_CAP:"ok",ANNOUNCEMENT:"info",EMERGENCY:"bad",GENERAL:"warn"}[t.category]||"warn";return`
      <button class="notification-item ${t.isRead?"read":"unread"}" data-id="${t.id}" role="option" tabindex="0">
        <span class="notification-cat pill ${n}">${t.category.replace("_"," ")}</span>
        <div class="notification-content">
          <strong>${m(t.title)}</strong>
          <p class="muted">${m(t.body)}</p>
          <span class="muted">${new Date(t.published_at).toLocaleString("en-PH")}${t.barangay?` • ${m(t.barangay)}`:""}</span>
        </div>
        ${t.isRead?"":'<span class="notification-dot" aria-hidden="true"></span>'}
      </button>
    `}).join(""),e("#list").querySelectorAll(".notification-item").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.id,l=p.find(f=>f.id===n);l&&(await C(l),l.isRead=!0,t.classList.remove("unread"),t.classList.add("read"),t.querySelector(".notification-dot")?.remove(),H())})}),I()}function H(){const a=d.filter(i=>!i.isRead).length;e("#count").textContent=`${d.length} notification${d.length!==1?"s":""} ${a>0?`(${a} unread)`:""}`}function I(){const a=e("#pagination");if(c<=1){a.innerHTML="";return}let i="";i+=`
    <button class="btn alt" ${r===1?"disabled":""} data-page="${r-1}" style="padding:8px 16px;font-size:.9rem">
      Previous
    </button>
  `;let o=Math.max(1,r-2),s=Math.min(c,o+4);s-o<4&&(o=Math.max(1,s-4));for(let t=o;t<=s;t++)i+=`
      <button class="${t===r?"btn":"btn alt"}" data-page="${t}" style="padding:8px 16px;font-size:.9rem;min-width:44px">
        ${t}
      </button>
    `;i+=`
    <button class="btn alt" ${r===c?"disabled":""} data-page="${r+1}" style="padding:8px 16px;font-size:.9rem">
      Next
    </button>
  `,a.innerHTML=i,a.querySelectorAll("button[data-page]").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.page,10);n>=1&&n<=c&&n!==r&&(r=n,v(),e("#list").scrollIntoView({behavior:"smooth",block:"start"}))})})}
