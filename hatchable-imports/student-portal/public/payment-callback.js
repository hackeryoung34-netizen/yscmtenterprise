(function(){
 const status=document.getElementById('paymentStatus');
 const actions=document.getElementById('paymentActions');
 const reference=new URLSearchParams(location.search).get('reference')||'';
 const safeRef=/^[A-Za-z0-9.=-]{8,120}$/.test(reference);
 if(!safeRef){status.textContent='No valid Paystack transaction reference was found. If you completed payment, contact YSCMT Support with your Paystack receipt.';return;}
 async function verify(){
  status.textContent='Verifying your payment with Paystack…';
  try{
   const r=await fetch('/api/student/paystack/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error||'Payment is not confirmed yet.');
   status.textContent=d.message||'Payment confirmed. Your course access is active.';
   actions.innerHTML='<a href="/" class="button">Return to Student Portal</a>';
  }catch(e){
   status.textContent=e.message+' If you have already paid, sign in to the Student Portal and contact YSCMT Admin with your transaction reference.';
   const returnTo='/payment-callback.html?reference='+encodeURIComponent(reference);
   actions.innerHTML='<a href="/login?next='+encodeURIComponent(returnTo)+'" class="button">Sign in to Student Portal</a> <a href="/" class="secondary">Return to portal</a>';
  }
 }
 verify();
})();