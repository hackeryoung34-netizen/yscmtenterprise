function send(res,status,body){return res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body));}
module.exports=async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_ANON_KEY;
  if(!root||!key)return send(res,503,{error:"Website content is temporarily unavailable."});
  const url=new URL(root+"/rest/v1/site_content_pages");
  url.searchParams.set("page_key","eq.home");url.searchParams.set("status","eq.published");url.searchParams.set("select","content");url.searchParams.set("limit","1");
  try{
    const response=await fetch(url,{headers:{apikey:key,Authorization:"Bearer "+key}});
    if(!response.ok)return send(res,502,{error:"Website content could not be loaded."});
    const rows=await response.json();
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
    return send(res,200,{content:rows[0]?.content||null});
  }catch{return send(res,502,{error:"Website content is temporarily unavailable."});}
};
