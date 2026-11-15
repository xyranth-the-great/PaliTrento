import"./modulepreload-polyfill-B5Qt9EMX.js";import{$ as d,r as f,e as o}from"./ui-RYbaGHoh.js";import{checkAuthErrorParams as h,getSessionWithStatus as g}from"./auth-_FXb4y8X.js";import{supabase as u}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const l=d("#report-form"),c=d("#submit-btn"),m=d("#product-info"),p=d("#back-link");let a=null,b=null;async function v(){if(a=new URLSearchParams(window.location.search).get("productId"),!a){n("No product specified");return}const t=h();if(t){window.location.replace(t);return}const{session:e,profile:i,redirectUrl:s}=await g();if(s){window.location.replace(s);return}if(!e){window.location.href="/login/";return}f("/report-product/",e,i),await w(),l.addEventListener("submit",y)}async function w(){try{const{data:r,error:t}=await u.from("products").select("name, current_price, unit, image_url, store_id, stores(business_name, trn_code)").eq("id",a).maybeSingle();if(t||!r){n("Product not found");return}b=r;const e=r.stores;m.innerHTML=`
      ${r.image_url?`<img src="${o(r.image_url)}" alt="${o(r.name)}">`:'<div style="width:60px;height:60px;border-radius:var(--r-md);background:var(--line);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.75rem">No image</div>'}
      <div class="text">
        <h3>${o(r.name)}</h3>
        <p>${o(r.current_price)} / ${r.unit} · ${o(e?.business_name||"Unknown Store")}</p>
      </div>
    `,p.href=`/product-detail/?id=${encodeURIComponent(a)}`,p.textContent=`← Back to ${o(r.name)}`}catch(r){console.error("Load product error:",r),n("Failed to load product")}}async function y(r){r.preventDefault();const t=l.reason.value,e=l.description.value.trim();if(!t){n("Please select a reason");return}if(!e){n("Please provide additional details");return}c.disabled=!0,c.textContent="Submitting...";try{const{data:i,error:s}=await u.rpc("create_product_report",{p_product_id:a,p_reason:t,p_description:e});if(s)throw s;document.body.innerHTML=`
      <div class="report-card" style="text-align:center">
        <div class="report-header">
          <div style="width:64px;height:64px;margin:0 auto 16px;background:var(--ok-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ok)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1>Report Submitted</h1>
          <p>Thank you for reporting this product. Our administrators will review your report.</p>
        </div>
        <p class="muted" style="margin-top:24px">Report ID: <code>${i.report_id}</code></p>
        <a href="/product-detail/?id=${encodeURIComponent(a)}" class="btn" style="margin-top:16px;display:inline-block">Return to Product</a>
      </div>
    `}catch(i){console.error("Submit report error:",i),n(i.message||"Failed to submit report. Please try again."),c.disabled=!1,c.textContent="Submit Report"}}function n(r){m.innerHTML=`<p class="pill bad" style="text-align:center">${o(r)}</p>`}v();
