(function(){
  const path=window.location.pathname;
  const placement=path.startsWith("/business-directory")?"business-directory":path.startsWith("/jobs")?"jobs":path.startsWith("/services")?"services":path.startsWith("/marketplace")?"marketplace":"homepage";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function mount(){
    if(document.getElementById("yscmt-sponsored-slot"))return document.getElementById("yscmt-sponsored-slot");
    const slot=document.createElement("section");slot.id="yscmt-sponsored-slot";slot.setAttribute("aria-label","Sponsored placement");slot.style.cssText="display:none;max-width:1120px;margin:18px auto;padding:0 16px";
    const anchor=document.querySelector(".hero,.slides,main > .intro,main > section,main");
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(slot,anchor.nextSibling);else document.body.insertBefore(slot,document.body.firstChild);
    return slot;
  }
  async function init(){
    const slot=mount();
    try{
      const response=await fetch("/api/advertising?placement="+encodeURIComponent(placement),{cache:"no-store"});
      const data=await response.json();if(!response.ok||!Array.isArray(data.campaigns)||!data.campaigns.length)return;
      slot.style.display="block";
      slot.innerHTML=data.campaigns.map(c=>'<article style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#fff;border:1px solid #dce5ed;border-left:4px solid #f0b84b;border-radius:12px;padding:14px 18px;box-shadow:0 6px 18px #08213b0b">'+(c.image_url?'<img src="'+esc(c.image_url)+'" alt="" loading="lazy" style="width:88px;height:70px;object-fit:cover;border-radius:8px">':'')+'<div style="flex:1;min-width:180px"><small style="font-weight:800;color:#8a5a00;letter-spacing:1px">SPONSORED</small><h2 style="font-size:17px;margin:3px 0;color:#08213b">'+esc(c.headline)+'</h2><p style="font-size:13px;color:#64748b;margin:0">'+esc(c.description)+'</p></div><button type="button" data-ad-id="'+esc(c.id)+'" data-dest="'+esc(c.destination_url)+'" style="border:0;border-radius:8px;background:#0d83b6;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer">Learn more</button></article>').join("");
      slot.addEventListener("click",async e=>{const button=e.target.closest("button[data-ad-id]");if(!button)return;button.disabled=true;const id=button.dataset.adId,dest=button.dataset.dest;try{await fetch("/api/advertising",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"click",campaign_id:id}),keepalive:true});}catch(_){}try{const u=new URL(dest,window.location.href);if(["http:","https:"].includes(u.protocol))window.location.assign(u.href);}catch(_){}});
    }catch(_){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
