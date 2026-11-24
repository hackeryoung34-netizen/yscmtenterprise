const { getRevenueSql } = require("./_lib/revenue-db");
function send(res,status,body){return res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body));}
module.exports=async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Method not allowed"});}
  try{
    const sql=getRevenueSql();
    const rows=await sql`select content from public.site_content_pages where page_key='home' and status='published' limit 1`;
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
    return send(res,200,{content:rows[0]?.content||null});
  }catch(error){
    console.error("[public site content]",error&&error.message||"request failed");
    return send(res,503,{error:"Website content is temporarily unavailable."});
  }
};
