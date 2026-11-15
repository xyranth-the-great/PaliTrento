import"./modulepreload-polyfill-B5Qt9EMX.js";import{$ as l,r as f,e as i}from"./ui-RYbaGHoh.js";import{checkAuthErrorParams as h,getSessionWithStatus as g}from"./auth-_FXb4y8X.js";import{supabase as p}from"./supabase-qt0oOlL5.js";import"./styles-lfujndA6.js";const d=l("#report-form"),a=l("#submit-btn"),m=l("#business-info"),u=l("#back-link");let c=null,b=null;async function y(){if(c=new URLSearchParams(window.location.search).get("storeId"),!c){n("No business specified");return}const t=h();if(t){window.location.replace(t);return}const{session:s,profile:r,redirectUrl:o}=await g();if(o){window.location.replace(o);return}if(!s){window.location.href="/login/";return}f("/report-business/",s,r),await w(),d.addEventListener("submit",v)}async function w(){try{const{data:e,error:t}=await p.from("stores").select("business_name, trn_code, barangay, verification_status").eq("id",c).maybeSingle();if(t||!e){n("Business not found");return}b=e,m.innerHTML=`
      <h3>${i(e.business_name)}</h3>
      <p>TRN: ${i(e.trn_code)} · ${i(e.barangay)} · ${e.verification_status}</p>
    `,u.href=`/business/?trn=${encodeURIComponent(e.trn_code)}`,u.textContent=`← Back to ${i(e.business_name)}`}catch(e){console.error("Load business error:",e),n("Failed to load business")}}async function v(e){e.preventDefault();const t=d.reason.value,s=d.description.value.trim();if(!t){n("Please select a reason");return}if(!s){n("Please provide additional details");return}a.disabled=!0,a.textContent="Submitting...";try{const{data:r,error:o}=await p.rpc("create_business_report",{p_store_id:c,p_reason:t,p_description:s});if(o)throw o;document.body.innerHTML=`
      <div class="report-card" style="text-align:center">
        <div class="report-header">
          <div style="width:64px;height:64px;margin:0 auto 16px;background:var(--ok-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ok)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1>Report Submitted</h1>
          <p>Thank you for reporting this business. Our administrators will review your report.</p>
        </div>
        <p class="muted" style="margin-top:24px">Report ID: <code>${r.report_id}</code></p>
        <a href="/business/?trn=${encodeURIComponent(b?.trn_code||"")}" class="btn" style="margin-top:16px;display:inline-block">Return to Business</a>
      </div>
    `}catch(r){console.error("Submit report error:",r),n(r.message||"Failed to submit report. Please try again."),a.disabled=!1,a.textContent="Submit Report"}}function n(e){m.innerHTML=`<p class="pill bad" style="text-align:center">${i(e)}</p>`}y();
