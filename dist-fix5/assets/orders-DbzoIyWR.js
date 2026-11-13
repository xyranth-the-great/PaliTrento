import{$ as l,r as f,e as a,a as c}from"./ui-BUvbi_9T.js";import{i as y,a as h,b as C,f as b,g as x}from"./auth-DXDSwYss.js";const n=l("#orders-history"),o=l("#orders-message");let p=null,i=[];async function w(){if(!y()){m(x(),"warn");return}const t=await h();if(!t){window.location.href="login.html";return}p=t;const s=await C(t.user.id);f("orders.html",t,s);try{const{data:e,error:r}=await b.from("orders").select(`
        *,
        products (name, unit, current_price),
        stores (business_name, trn_code, barangay)
      `).eq("buyer_id",p.user.id).order("created_at",{ascending:!1});if(r)throw r;console.log("Customer orders loaded:",e?.length),i=e||[],E()}catch(e){console.error("Load orders error:",e),m("Failed to load orders. Please try again.","bad")}l("#orders-content").style.display="block"}function E(){if(!n)return;if(i.length===0){n.innerHTML='<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="products.html">Start shopping</a></p>';return}const t={PENDING:"warn",CONFIRMED:"info",READY_FOR_PICKUP:"ok",COMPLETED:"ok",CANCELLED:"bad"},s={PENDING:"Pending",CONFIRMED:"Confirmed",READY_FOR_PICKUP:"Ready for pickup",COMPLETED:"Completed",CANCELLED:"Cancelled"};n.innerHTML=i.map(e=>{const r=e.products,d=e.stores,u=t[e.status]||"warn",g=s[e.status]||e.status;return`
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${a(r?.name||"Product")}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${a(d?.business_name||"Store")} • ${a(d?.barangay||"")}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${e.quantity} × ${c(r?.current_price||0)} = <strong>${c(e.total_price)}</strong></p>
          </div>
          <span class="pill ${u}" style="font-size:.75rem;white-space:nowrap">${g}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="chat.html?orderId=${e.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(e.created_at).toLocaleString("en-PH")}</p>
        ${e.notes?`<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${a(e.notes)}</p>`:""}
      </div>
    `}).join("")}function m(t,s){o.textContent=t,o.className=`pill ${s}`,o.style.display="block"}w();
