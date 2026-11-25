(function(){
  try{
    const params=new URLSearchParams(window.location.search);
    const code=params.get("ref");
    if(!code||!/^[A-Za-z0-9-]{6,40}$/.test(code))return;
    const key="yscmt_aff_ref_"+code;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,"1");
    fetch("/api/affiliate-click",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({referral_code:code,landing_path:window.location.pathname})})
      .then(response=>response.ok?response.json():null)
      .then(data=>{if(data&&data.tracked&&data.referral_id){sessionStorage.setItem("yscmt_affiliate_referral_id",data.referral_id);sessionStorage.setItem("yscmt_affiliate_referral_code",code);}})
      .catch(function(){});
  }catch(_){}
})();
