(() => {
 const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
 toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
 nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}));
 const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
 // Replace with the official YSCMT contact email before publishing.
 const contactEmail='your-email@example.com';
 document.querySelectorAll('[data-email-link]').forEach(a=>{a.href='mailto:'+contactEmail;a.textContent=contactEmail+' ↗'});
 document.getElementById('contact-form')?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.currentTarget),note=document.getElementById('form-note');if(contactEmail==='your-email@example.com'){note.textContent='Demo mode: configure the official YSCMT contact email in script.js before publishing.';return}const subject=encodeURIComponent('YSCMT website enquiry from '+d.get('name'));const body=encodeURIComponent('Name: '+d.get('name')+'\nEmail: '+d.get('email')+'\n\n'+d.get('message'));window.location.href='mailto:'+contactEmail+'?subject='+subject+'&body='+body;note.textContent='Your email app should open with the enquiry ready to send.'});
})();