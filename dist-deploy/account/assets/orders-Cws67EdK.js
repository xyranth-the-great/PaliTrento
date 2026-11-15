import"./modulepreload-polyfill-B5Qt9EMX.js";import{$ as c,r as g,s as y,e as o,c as p}from"./ui-RYbaGHoh.js";import{isSupabaseConfigured as h,checkAuthErrorParams as w,getSessionWithStatus as x,startOrderStatusListener as C,getLoginUnavailableMessage as b}from"./auth-_FXb4y8X.js";import{supabase as E}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const i=c("#orders-history"),d=c("#orders-message");let u=null,l=[];async function L(){if(!h()){m(b(),"warn");return}const s=w();if(s){window.location.replace(s);return}const{session:r,profile:e,redirectUrl:n}=await x();if(n){window.location.replace(n);return}if(!r){window.location.href="/login/";return}u=r,g("/orders/",r,e),y(),C(r.user.id);try{const{data:t,error:a}=await E.from("orders").select(`
        *,
        products (name, unit, current_price),
        stores (business_name, trn_code, barangay)
      `).eq("buyer_id",u.user.id).order("created_at",{ascending:!1});if(a)throw a;console.log("Customer orders loaded:",t?.length),l=t||[],$()}catch(t){console.error("Load orders error:",t),m("Failed to load orders. Please try again.","bad")}c("#orders-content").style.display="block"}function $(){if(!i)return;if(l.length===0){i.innerHTML='<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="/products/">Start shopping</a></p>';return}const s={PENDING:"warn",CONFIRMED:"info",READY_FOR_PICKUP:"ok",COMPLETED:"ok",CANCELLED:"bad"},r={PENDING:"Pending",CONFIRMED:"Confirmed",READY_FOR_PICKUP:"Ready for pickup",COMPLETED:"Completed",CANCELLED:"Cancelled"};i.innerHTML=l.map(e=>{const n=e.products,t=e.stores,a=s[e.status]||"warn",f=r[e.status]||e.status;return`
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${o(n?.name||"Product")}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${o(t?.business_name||"Store")} • ${o(t?.barangay||"")}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${e.quantity} × ${p(n?.current_price||0)} = <strong>${p(e.total_price)}</strong></p>
          </div>
          <span class="pill ${a}" style="font-size:.75rem;white-space:nowrap">${f}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="/chat/?orderId=${e.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(e.created_at).toLocaleString("en-PH")}</p>
        ${e.notes?`<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${o(e.notes)}</p>`:""}
      </div>
    `}).join("")}function m(s,r){d.textContent=s,d.className=`pill ${r}`,d.style.display="block"}L();
