const crypto = require("crypto");
function send(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").setHeader("Cache-Control","no-store").send(JSON.stringify(body));}
function cleanText(value,max){return typeof value==="string"?value.trim().slice(0,max):"";}
function hash(value){return crypto.createHash("sha256").update(value).digest("hex");}
function sameHash(a,b){const x=Buffer.from(String(a||""),"hex"),y=Buffer.from(String(b||""),"hex");return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);}
function apiUrl(root,table,params={}){const u=new URL(root+"/rest/v1/"+table);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);return u;}
async function db(root,key,path,options={}){const response=await fetch(root+"/rest/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(options.headers||{})}});const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}if(!response.ok)throw new Error("Database request failed ("+response.status+").");return data;}
async function getConversation(root,key,id){const rows=await db(root,key,"store_chat_conversations?select=id,visitor_token_hash,visitor_name,visitor_email,status,created_at,last_message_at&id=eq."+encodeURIComponent(id)+"&limit=1");return rows&&rows[0]||null;}
async function getMessages(root,key,id){return await db(root,key,"store_chat_messages?select=id,sender_type,message,created_at&conversation_id=eq."+encodeURIComponent(id)+"&order=created_at.asc&limit=300");}
async function requireAdmin(req,root,anonKey){const header=req.headers.authorization||"",token=header.startsWith("Bearer ")?header.slice(7):"";if(!token)throw Object.assign(new Error("Administrator sign-in is required."),{status:401});const r=await fetch(root+"/auth/v1/user",{headers:{apikey:anonKey,Authorization:"Bearer "+token}});if(!r.ok)throw Object.assign(new Error("Your session is invalid or expired."),{status:401});const user=await r.json();if(!user.app_metadata||user.app_metadata.role!=="store_admin")throw Object.assign(new Error("Store administrator permission is required."),{status:403});return user;}
module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
 const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!root||!anon||!service)return send(res,503,{error:"Live chat service is not configured."});
 try{
  if(req.method==="GET"){
   const action=cleanText(req.query&&req.query.action,30);
   if(action==="admin_list"){
    await requireAdmin(req,root,anon);
    const conversations=await db(root,service,"store_chat_conversations?select=id,visitor_name,visitor_email,status,created_at,last_message_at&order=last_message_at.desc&limit=100");
    return send(res,200,{conversations});
   }
   if(action==="admin_thread"){
    await requireAdmin(req,root,anon);
    const id=cleanText(req.query&&req.query.id,36);if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Invalid conversation ID."});
    const conversation=await getConversation(root,service,id);if(!conversation)return send(res,404,{error:"Conversation not found."});
    const {visitor_token_hash,...safeConversation}=conversation;
    return send(res,200,{conversation:safeConversation,messages:await getMessages(root,service,id)});
   }
   if(action==="visitor_thread"){
    const id=cleanText(req.query&&req.query.id,36),token=cleanText(req.query&&req.query.token,128);
    if(!/^[0-9a-f-]{36}$/i.test(id)||! /^[a-f0-9]{64}$/i.test(token))return send(res,400,{error:"Invalid chat session."});
    const conversation=await getConversation(root,service,id);
    if(!conversation||!sameHash(conversation.visitor_token_hash,hash(token)))return send(res,403,{error:"This chat session could not be verified."});
    return send(res,200,{conversation:{id:conversation.id,status:conversation.status},messages:await getMessages(root,service,id)});
   }
   return send(res,400,{error:"Unknown chat action."});
  }
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
  const action=cleanText(body.action,30),message=cleanText(body.message,2000);
  if(body.website)return send(res,200,{ok:true});
  if(!message)return send(res,400,{error:"Please enter a message."});
  if(message.length>2000)return send(res,400,{error:"Messages must be 2,000 characters or fewer."});
  if(action==="start"){
   const name=cleanText(body.name,80),email=cleanText(body.email,160);
   if(name.length<2)return send(res,400,{error:"Please enter your name."});
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,400,{error:"Please enter a valid email address."});
   const token=crypto.randomBytes(32).toString("hex");
   const rows=await db(root,service,"store_chat_conversations",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({visitor_token_hash:hash(token),visitor_name:name,visitor_email:email||null})});
   const conversation=rows&&rows[0];if(!conversation)throw new Error("Could not create chat conversation.");
   await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:conversation.id,sender_type:"visitor",message})});
   await db(root,service,"store_chat_conversations?id=eq."+conversation.id,{method:"PATCH",body:JSON.stringify({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
   return send(res,201,{conversation_id:conversation.id,visitor_token:token});
  }
  if(action==="visitor_reply"){
   const id=cleanText(body.conversation_id,36),token=cleanText(body.visitor_token,128);
   if(!/^[0-9a-f-]{36}$/i.test(id)||! /^[a-f0-9]{64}$/i.test(token))return send(res,400,{error:"Invalid chat session."});
   const conversation=await getConversation(root,service,id);
   if(!conversation||!sameHash(conversation.visitor_token_hash,hash(token)))return send(res,403,{error:"This chat session could not be verified."});
   if(conversation.status==="closed")return send(res,409,{error:"This conversation has been closed."});
   const recent=await db(root,service,"store_chat_messages?select=id&conversation_id=eq."+id+"&sender_type=eq.visitor&created_at=gte."+encodeURIComponent(new Date(Date.now()-10*60*1000).toISOString()));
   if((recent||[]).length>=10)return send(res,429,{error:"Please wait a few minutes before sending more messages."});
   await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:id,sender_type:"visitor",message})});
   await db(root,service,"store_chat_conversations?id=eq."+id,{method:"PATCH",body:JSON.stringify({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
   return send(res,201,{ok:true});
  }
  if(action==="admin_reply"){
   await requireAdmin(req,root,anon);
   const id=cleanText(body.conversation_id,36);if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Invalid conversation ID."});
   const conversation=await getConversation(root,service,id);if(!conversation)return send(res,404,{error:"Conversation not found."});
   await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:id,sender_type:"admin",message})});
   const now=new Date().toISOString();await db(root,service,"store_chat_conversations?id=eq."+id,{method:"PATCH",body:JSON.stringify({last_message_at:now,updated_at:now,status:"open"})});
   return send(res,201,{ok:true});
  }
  return send(res,400,{error:"Unknown chat action."});
 }catch(error){return send(res,error.status||502,{error:error.message||"Live chat is temporarily unavailable."});}
};
