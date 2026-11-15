import"./modulepreload-polyfill-B5Qt9EMX.js";import{$ as d,r as f,s as y,e as a,c}from"./ui-BQtFlIep.js";import{isSupabaseConfigured as C,getSession as x,getCachedProfile as b,startOrderStatusListener as h,getLoginUnavailableMessage as w}from"./auth-BNd5RyvG.js";import{supabase as E}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const n=d("#orders-history"),o=d("#orders-message");let p=null,i=[];async function L(){if(!C()){m(w(),"warn");return}const t=await x();if(!t){window.location.href="/login/";return}p=t;const r=await b(t.user.id);f("/orders/",t,r),y(),h(t.user.id);try{const{data:e,error:s}=await E.from("orders").select(`
        *,
        products (name, unit, current_price),
        stores (business_name, trn_code, barangay)
      `).eq("buyer_id",p.user.id).order("created_at",{ascending:!1});if(s)throw s;console.log("Customer orders loaded:",e?.length),i=e||[],$()}catch(e){console.error("Load orders error:",e),m("Failed to load orders. Please try again.","bad")}d("#orders-content").style.display="block"}function $(){if(!n)return;if(i.length===0){n.innerHTML='<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="/products/">Start shopping</a></p>';return}const t={PENDING:"warn",CONFIRMED:"info",READY_FOR_PICKUP:"ok",COMPLETED:"ok",CANCELLED:"bad"},r={PENDING:"Pending",CONFIRMED:"Confirmed",READY_FOR_PICKUP:"Ready for pickup",COMPLETED:"Completed",CANCELLED:"Cancelled"};n.innerHTML=i.map(e=>{const s=e.products,l=e.stores,u=t[e.status]||"warn",g=r[e.status]||e.status;return`
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${a(s?.name||"Product")}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${a(l?.business_name||"Store")} • ${a(l?.barangay||"")}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${e.quantity} × ${c(s?.current_price||0)} = <strong>${c(e.total_price)}</strong></p>
          </div>
          <span class="pill ${u}" style="font-size:.75rem;white-space:nowrap">${g}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="/chat/?orderId=${e.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(e.created_at).toLocaleString("en-PH")}</p>
        ${e.notes?`<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${a(e.notes)}</p>`:""}
      </div>
    `}).join("")}function m(t,r){o.textContent=t,o.className=`pill ${r}`,o.style.display="block"}L();
