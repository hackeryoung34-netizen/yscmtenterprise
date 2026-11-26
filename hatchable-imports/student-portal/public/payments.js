(function(){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(v,c)=>{const n=Number(v||0);try{return new Intl.NumberFormat('en-NG',{style:'currency',currency:c||'NGN',maximumFractionDigits:2}).format(n);}catch{return (c||'NGN')+' '+n.toFixed(2);}};
 function panel(){let el=document.getElementById('studentPaymentPanel');if(!el){el=document.createElement('section');el.id='studentPaymentPanel';el.className='card hidden';el.style.marginTop='18px';const dash=document.getElementById('dashboard');const learning=document.getElementById('learningArea');dash.insertBefore(el,learning);}return el;}
 function render(rows){
  const target=document.getElementById('myCourses');if(!target)return;
  target.innerHTML=(rows||[]).map(x=>{
   const approved=['approved','completed'].includes(x.status);
   const pay=x.payment_status||'not_submitted';
   const label=pay==='pending'?'Receipt submitted — awaiting Admin review':pay==='rejected'?'Payment receipt rejected — please submit again':pay==='verified'?'Payment verified':x.status==='pending'?'Payment required':x.status;
   return '<article class="enrol-row"><strong>'+esc(x.title)+'</strong><br><small class="muted">'+money(x.fee_amount,x.fee_currency)+'</small><br><span class="pill">'+esc(approved?x.status:label)+'</span>'+(approved?' <button class="small-btn" data-open-course="'+esc(x.course_id)+'" data-course-title="'+esc(x.title)+'">Open course</button> <button class="small-btn" data-request-certificate="'+esc(x.course_id)+'">Get certificate</button>':x.status==='rejected'?'':' <button class="small-btn" data-pay-enrol="'+esc(x.id)+'">'+(pay==='pending'?'View payment status':'Pay course fee / Upload receipt')+'</button>')+'</article>';
  }).join('')||'You have not enrolled in a course yet.';
  target.querySelectorAll('[data-pay-enrol]').forEach(b=>b.onclick=()=>open(b.dataset.payEnrol));
  target.querySelectorAll('[data-open-course]').forEach(b=>b.onclick=()=>document.dispatchEvent(new CustomEvent('yscmt:open-course',{detail:{courseId:b.dataset.openCourse,title:b.dataset.courseTitle}})));
  target.querySelectorAll('[data-request-certificate]').forEach(b=>b.onclick=()=>document.dispatchEvent(new CustomEvent('yscmt:request-certificate',{detail:{courseId:b.dataset.requestCertificate}})));
 }
 async function open(id){
  const el=panel();el.classList.remove('hidden');el.innerHTML='<h3>Loading payment details…</h3>';el.scrollIntoView({behavior:'smooth',block:'start'});
  try{
   const r=await fetch('/api/student/payment?enrolment_id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load payment details.');
   const e=d.enrolment,b=d.bank||{},p=d.payment;
   const submitted=p&&p.status==='pending';
   el.innerHTML='<div class="section-head"><div><div class="eyebrow">YSCMT SECURE PAYMENTS</div><h2>Pay course fee</h2><p class="muted">'+esc(e.title)+'</p></div><button type="button" class="secondary" id="closeStudentPayment">Close</button></div>'+
    '<article class="card" style="margin-bottom:16px"><p class="muted">Course fee</p><h2>'+money(e.fee_amount,e.fee_currency)+'</h2><p class="muted">Pay online securely through Paystack. Your course is activated only after the payment is verified.</p><button type="button" id="payWithPaystack" '+(Number(e.fee_amount)<=0?'disabled':'')+'>Pay securely with Paystack</button><p id="paystackMessage" class="msg" role="status"></p></article>'+
    '<div class="grid"><article class="card"><p class="muted">Amount to pay by bank transfer</p><h2>'+money(e.fee_amount,e.fee_currency)+'</h2></article><article class="card"><p class="muted">Bank name</p><h3>'+esc(b.bank_name||'Not configured yet')+'</h3><p>Account name: <strong>'+esc(b.account_name||'—')+'</strong></p><p>Account number: <strong>'+esc(b.account_number||'—')+'</strong></p><p class="muted">'+esc(b.instructions||'Transfer the exact course fee, then upload your receipt below.')+'</p></article></div>'+
    (submitted?'<p class="msg">Your receipt was received on '+esc(new Date(p.submitted_at).toLocaleString())+'. Admin review is pending. You do not need to submit again.</p>':'')+
    (p&&p.status==='verified'?'<p class="msg">Payment verified. Refresh your enrolments to access the course.</p>':'')+
    (p&&p.status==='rejected'?'<p class="msg err">Receipt rejected: '+esc(p.admin_note||'Please upload a clear receipt and check the transfer reference.')+'</p>':'')+
    ((!b.account_number||Number(e.fee_amount)<=0)?'<p class="msg err">Payment instructions are not ready yet. Please contact YSCMT Admin.</p>':submitted?'':'<form id="studentReceiptForm" class="card" style="margin-top:16px"><h3>Submit payment proof</h3><label for="transferReference">Bank transfer reference / narration</label><input id="transferReference" name="transfer_reference" maxlength="120" required placeholder="Enter your transfer reference"><label for="receiptFile">Receipt (JPG, PNG or PDF; max 5 MB)</label><input id="receiptFile" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" required><button type="submit" style="margin-top:14px">Upload receipt</button><p id="receiptMessage" class="msg" role="status"></p></form>')+
    '<p class="muted">Your course will open only after an Admin verifies the transfer. Keep your bank transaction confirmation.</p>';
   document.getElementById('closeStudentPayment').onclick=()=>el.classList.add('hidden');
   const payBtn=document.getElementById('payWithPaystack');
   if(payBtn)payBtn.onclick=async()=>{payBtn.disabled=true;const msg=document.getElementById('paystackMessage');msg.textContent='Connecting securely to Paystack…';try{const pr=await fetch('/api/student/paystack/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enrolment_id:id})});const pd=await pr.json();if(!pr.ok)throw new Error(pd.error||'Could not start payment.');if(!pd.authorization_url)throw new Error('Paystack did not return a checkout link.');location.href=pd.authorization_url;}catch(err){msg.textContent=err.message;payBtn.disabled=false;}};
   const form=document.getElementById('studentReceiptForm');if(form)form.onsubmit=async ev=>{ev.preventDefault();const btn=form.querySelector('button[type=submit]');const msg=document.getElementById('receiptMessage');const file=document.getElementById('receiptFile').files[0];if(!file)return;btn.disabled=true;msg.textContent='Uploading receipt…';const fd=new FormData();fd.append('enrolment_id',id);fd.append('transfer_reference',document.getElementById('transferReference').value.trim());fd.append('receipt',file);try{const rr=await fetch('/api/student/payment',{method:'POST',body:fd});const rd=await rr.json();if(!rr.ok)throw new Error(rd.error||'Upload failed.');msg.textContent=rd.message;setTimeout(()=>open(id),700);window.dispatchEvent(new Event('yscmt:payments-updated'));}catch(err){msg.textContent=err.message;btn.disabled=false;}};
  }catch(err){el.innerHTML='<p class="msg err">'+esc(err.message)+'</p>';}
 }
 window.YSCMTPayments={render,open};
})();