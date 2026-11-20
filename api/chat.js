const crypto = require("crypto");
const { requireCentralAdmin } = require("./_lib/central-admin");
const BUCKET = "yscmt-chat-media";
const MAX_MEDIA = 25 * 1024 * 1024;
const MIME_TYPES = new Set([
  "image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif",
  "video/mp4","video/webm","video/quicktime",
  "audio/mpeg","audio/mp4","audio/m4a","audio/x-m4a","audio/aac","audio/ogg","audio/webm","audio/wav","audio/x-wav"
]);
function send(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").setHeader("Cache-Control","no-store").send(JSON.stringify(body));}
function cleanText(value,max){return typeof value==="string"?value.trim().slice(0,max):"";}
function hash(value){return crypto.createHash("sha256").update(value).digest("hex");}
function sameHash(a,b){const x=Buffer.from(String(a||""),"hex"),y=Buffer.from(String(b||""),"hex");return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);}
function safePath(path){return String(path||"").split("/").map(encodeURIComponent).join("/");}
async function db(root,key,path,options={}){const response=await fetch(root+"/rest/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(options.headers||{})}});const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}if(!response.ok)throw new Error("Database request failed ("+response.status+").");return data;}
async function storage(root,key,path,options={}){const response=await fetch(root+"/storage/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+key,...(options.headers||{})}});const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}if(!response.ok)throw new Error((data&& (data.message||data.error))||"Media storage request failed ("+response.status+").");return data;}
async function getConversation(root,key,id){const rows=await db(root,key,"store_chat_conversations?select=id,visitor_token_hash,visitor_name,visitor_email,status,created_at,last_message_at&id=eq."+encodeURIComponent(id)+"&limit=1");return rows&&rows[0]||null;}
async function getMessages(root,key,id){return await db(root,key,"store_chat_messages?select=id,sender_type,message,message_type,media_path,media_name,media_mime,media_size,created_at&conversation_id=eq."+encodeURIComponent(id)+"&order=created_at.asc&limit=300");}
async function requireAdmin(req,permission="chat.read"){const auth=await requireCentralAdmin(req,permission);if(auth.error)throw Object.assign(new Error(auth.error),{status:auth.status});return auth.user;}
async function authorize(req,root,anon,key,conversation,bodyOrQuery,permission="chat.read"){const token=cleanText(bodyOrQuery&&(bodyOrQuery.visitor_token||bodyOrQuery.token),128);if(token&&/^[a-f0-9]{64}$/i.test(token)&&sameHash(conversation.visitor_token_hash,hash(token)))return "visitor";await requireAdmin(req,permission);return "admin";}
async function signMedia(root,service,path,downloadName){const data=await storage(root,service,"object/sign/"+BUCKET+"/"+safePath(path),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600,...(downloadName?{download:downloadName}:{})})});const url=data&&data.signedURL;if(!url)throw new Error("Could not create a private media link.");return url.startsWith("http")?url:root+"/storage/v1"+url;}
async function addCallEvent(root,service,callId,sender,eventType,payload={}){return await db(root,service,"store_chat_call_events",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({call_id:callId,sender_type:sender,event_type:eventType,payload})});}
async function getCall(root,service,id){const rows=await db(root,service,"store_chat_calls?select=id,conversation_id,caller_type,call_type,status,created_at,updated_at,ended_at&id=eq."+encodeURIComponent(id)+"&limit=1");return rows&&rows[0]||null;}
async function verifyCallParticipant(req,root,anon,service,call,bodyOrQuery){const conversation=await getConversation(root,service,call.conversation_id);if(!conversation)throw Object.assign(new Error("Conversation not found."),{status:404});const side=await authorize(req,root,anon,service,conversation,bodyOrQuery);return {side,conversation};}
async function getActiveCall(root,service,conversationId){const rows=await db(root,service,"store_chat_calls?select=id,conversation_id,caller_type,call_type,status,created_at&conversation_id=eq."+encodeURIComponent(conversationId)+"&status=in.(ringing,active)&order=created_at.desc&limit=1");const call=rows&&rows[0]||null;if(call&&call.status==="ringing"&&Date.now()-new Date(call.created_at).getTime()>45000){await db(root,service,"store_chat_calls?id=eq."+call.id,{method:"PATCH",body:JSON.stringify({status:"missed",ended_at:new Date().toISOString(),updated_at:new Date().toISOString()})});return null;}return call;}
function mediaKind(mime,requested){if(requested==="voice_note"&&mime.startsWith("audio/"))return "voice_note";if(mime.startsWith("image/"))return "image";if(mime.startsWith("video/"))return "video";if(mime.startsWith("audio/"))return "audio";return null;}
module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return send(res,405,{error:"Method not allowed"});}
 const root=(process.env.SUPABASE_URL||"").replace(/\/$/,""),anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!root||!anon||!service)return send(res,503,{error:"Live chat service is not configured."});
 try{
  if(req.method==="GET"){
   const action=cleanText(req.query&&req.query.action,40);
   if(action==="admin_list"){
    await requireAdmin(req,"chat.read");
    const conversations=await db(root,service,"store_chat_conversations?select=id,visitor_name,visitor_email,status,created_at,last_message_at&order=last_message_at.desc&limit=100");
    const incoming_calls=await db(root,service,"store_chat_calls?select=id,conversation_id,caller_type,call_type,status,created_at&status=in.(ringing,active)&order=created_at.desc&limit=30");
    return send(res,200,{conversations,incoming_calls});
   }
   if(action==="admin_thread"||action==="visitor_thread"){
    const id=cleanText(req.query&&req.query.id,36);if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Invalid conversation ID."});
    const conversation=await getConversation(root,service,id);if(!conversation)return send(res,404,{error:"Conversation not found."});
    if(action==="admin_thread"){
      await requireAdmin(req,"chat.read");
      const {visitor_token_hash,...safeConversation}=conversation;
      return send(res,200,{conversation:safeConversation,messages:await getMessages(root,service,id),active_call:await getActiveCall(root,service,id)});
    }
    const token=cleanText(req.query&&req.query.token,128);
    if(!/^[a-f0-9]{64}$/i.test(token)||!sameHash(conversation.visitor_token_hash,hash(token)))return send(res,403,{error:"This chat session could not be verified."});
    return send(res,200,{conversation:{id:conversation.id,status:conversation.status},messages:await getMessages(root,service,id),active_call:await getActiveCall(root,service,id)});
   }
   if(action==="media_url"){
    const messageId=cleanText(req.query&&req.query.id,36);if(!/^[0-9a-f-]{36}$/i.test(messageId))return send(res,400,{error:"Invalid media message."});
    const rows=await db(root,service,"store_chat_messages?select=id,conversation_id,media_path&id=eq."+encodeURIComponent(messageId)+"&limit=1");
    const message=rows&&rows[0];if(!message||!message.media_path)return send(res,404,{error:"Media not found."});
    const conversation=await getConversation(root,service,message.conversation_id);if(!conversation)return send(res,404,{error:"Conversation not found."});
    await authorize(req,root,anon,service,conversation,req.query);
    return send(res,200,{url:await signMedia(root,service,message.media_path)});
   }
   if(action==="media_download"){
    const messageId=cleanText(req.query&&req.query.id,36);if(!/^[0-9a-f-]{36}$/i.test(messageId))return send(res,400,{error:"Invalid media message."});
    const rows=await db(root,service,"store_chat_messages?select=id,conversation_id,media_path,media_name&id=eq."+encodeURIComponent(messageId)+"&limit=1");
    const message=rows&&rows[0];if(!message||!message.media_path)return send(res,404,{error:"Media not found."});
    const conversation=await getConversation(root,service,message.conversation_id);if(!conversation)return send(res,404,{error:"Conversation not found."});
    await authorize(req,root,anon,service,conversation,req.query);
    return send(res,200,{url:await signMedia(root,service,message.media_path,cleanText(message.media_name,160)||"attachment")});
   }
   if(action==="call_config"){
    const id=cleanText(req.query&&req.query.id,36);
    if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Invalid conversation."});
    const conversation=await getConversation(root,service,id);
    if(!conversation)return send(res,404,{error:"Conversation not found."});
    await authorize(req,root,anon,service,conversation,req.query);
    const ice_servers=[{urls:"stun:stun.cloudflare.com:3478"},{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}];
    const turnKeyId=String(process.env.YSCMT_TURN_KEY_ID||"").trim();
    const turnApiToken=String(process.env.YSCMT_TURN_API_TOKEN||"").trim();
    let turn_configured=false;
    if(turnKeyId&&turnApiToken){
      if(!/^[a-f0-9]{32}$/i.test(turnKeyId))return send(res,503,{error:"TURN service configuration is invalid."});
      try{
        const turnResponse=await fetch("https://rtc.live.cloudflare.com/v1/turn/keys/"+encodeURIComponent(turnKeyId)+"/credentials/generate-ice-servers",{
          method:"POST",
          headers:{"Authorization":"Bearer "+turnApiToken,"Content-Type":"application/json"},
          body:JSON.stringify({ttl:86400}),
          signal:AbortSignal.timeout(8000)
        });
        if(!turnResponse.ok){
          console.error("Cloudflare TURN credential request failed:",turnResponse.status);
        }else{
          const turnData=await turnResponse.json();
          const turnIce=turnData&&turnData.iceServers;
          if(Array.isArray(turnIce)&&turnIce.length){
            for(const server of turnIce){
              if(!server||!server.urls)continue;
              const urls=(Array.isArray(server.urls)?server.urls:[server.urls]).filter(url=>typeof url==="string"&&/^turns?:/i.test(url));
              if(urls.length&&typeof server.username==="string"&&typeof server.credential==="string"){
                ice_servers.push({urls,username:server.username,credential:server.credential});
              }
            }
            turn_configured=ice_servers.some(server=>server.username&&server.credential);
          }else{
            console.error("Cloudflare TURN credential response did not contain ICE servers.");
          }
        }
      }catch(error){
        console.error("Cloudflare TURN credential request could not be completed:",error&&error.name||"unknown error");
      }
    }
    return send(res,200,{ice_servers,turn_configured});
   }
   if(action==="call_poll"){
    const callId=cleanText(req.query&&req.query.id,36);if(!/^[0-9a-f-]{36}$/i.test(callId))return send(res,400,{error:"Invalid call."});
    const call=await getCall(root,service,callId);if(!call)return send(res,404,{error:"Call not found."});
    const {side}=await verifyCallParticipant(req,root,anon,service,call,req.query);
    if(call.status==="ringing"&&Date.now()-new Date(call.created_at).getTime()>45000){await db(root,service,"store_chat_calls?id=eq."+callId,{method:"PATCH",body:JSON.stringify({status:"missed",ended_at:new Date().toISOString(),updated_at:new Date().toISOString()})});call.status="missed";}
    if(call.status==="missed")return send(res,200,{call,side,events:[]});
    const cursor=Math.max(0,Number.parseInt(req.query&&req.query.after,10)||0);
    const events=await db(root,service,"store_chat_call_events?select=id,sender_type,event_type,payload,created_at&call_id=eq."+encodeURIComponent(callId)+"&id=gt."+cursor+"&order=id.asc&limit=100");
    return send(res,200,{call,side,events});
   }
   return send(res,400,{error:"Unknown chat action."});
  }
  const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
  const action=cleanText(body.action,40),message=cleanText(body.message,2000);
  if(body.website)return send(res,200,{ok:true});
  if(action==="start"){
    const name=cleanText(body.name,80),email=cleanText(body.email,160);
    if(name.length<2)return send(res,400,{error:"Please enter your name."});
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,400,{error:"Please enter a valid email address."});
    const token=crypto.randomBytes(32).toString("hex");
    const rows=await db(root,service,"store_chat_conversations",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({visitor_token_hash:hash(token),visitor_name:name,visitor_email:email||null})});
    const conversation=rows&&rows[0];if(!conversation)throw new Error("Could not create chat conversation.");
    if(message){
      await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:conversation.id,sender_type:"visitor",message})});
      await db(root,service,"store_chat_conversations?id=eq."+conversation.id,{method:"PATCH",body:JSON.stringify({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    }
    return send(res,201,{conversation_id:conversation.id,visitor_token:token});
  }
  const conversationId=cleanText(body.conversation_id,36);
  if(!/^[0-9a-f-]{36}$/i.test(conversationId))return send(res,400,{error:"Invalid conversation ID."});
  const conversation=await getConversation(root,service,conversationId);if(!conversation)return send(res,404,{error:"Conversation not found."});
  const adminPermission=["admin_reply","media_upload","media_message"].includes(action)?"chat.reply":"chat.read";
  const side=await authorize(req,root,anon,service,conversation,body,adminPermission);
  if(conversation.status==="closed"&&side==="visitor")return send(res,409,{error:"This conversation has been closed."});
  if(action==="visitor_reply"||action==="admin_reply"){
    if(!message)return send(res,400,{error:"Please enter a message."});
    if(action==="admin_reply"&&side!=="admin")return send(res,403,{error:"Administrator access required."});
    if(action==="visitor_reply"&&side!=="visitor")return send(res,403,{error:"Visitor session required."});
    if(side==="visitor"){
      const recent=await db(root,service,"store_chat_messages?select=id&conversation_id=eq."+conversationId+"&sender_type=eq.visitor&created_at=gte."+encodeURIComponent(new Date(Date.now()-10*60*1000).toISOString()));
      if((recent||[]).length>=10)return send(res,429,{error:"Please wait a few minutes before sending more messages."});
    }
    await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:conversationId,sender_type:side,message})});
    const now=new Date().toISOString();await db(root,service,"store_chat_conversations?id=eq."+conversationId,{method:"PATCH",body:JSON.stringify({last_message_at:now,updated_at:now,...(side==="admin"?{status:"open"}:{})})});
    return send(res,201,{ok:true});
  }
  if(action==="media_upload"){
    const name=cleanText(body.file_name,160),mime=cleanText(body.file_mime,100).toLowerCase(),size=Number(body.file_size),kind=mediaKind(mime,body.kind);
    if(!name||!MIME_TYPES.has(mime)||!kind)return send(res,400,{error:"This file type is not supported."});
    if(!Number.isFinite(size)||size<1||size>MAX_MEDIA)return send(res,413,{error:"Files must be 25 MB or smaller."});
    const ext=(name.match(/\.([a-zA-Z0-9]{1,8})$/)||[])[1]||"bin";
    const path=conversationId+"/"+crypto.randomUUID()+"."+ext.toLowerCase();
    const signed=await storage(root,service,"object/upload/sign/"+BUCKET+"/"+safePath(path),{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    if(!signed||!signed.url)throw new Error("Could not prepare secure media upload.");
    const baseUploadUrl=signed.url.startsWith("http")?signed.url:root+"/storage/v1"+signed.url;
    const uploadTarget=new URL(baseUploadUrl);uploadTarget.searchParams.set("token",signed.token);const uploadUrl=uploadTarget.toString();
    return send(res,200,{path,token:signed.token,upload_url:uploadUrl,message_type:kind});
  }
  if(action==="media_message"){
    const path=cleanText(body.media_path,500),name=cleanText(body.media_name,160),mime=cleanText(body.media_mime,100).toLowerCase(),size=Number(body.media_size),kind=mediaKind(mime,body.kind);
    if(!path.startsWith(conversationId+"/")||!name||!MIME_TYPES.has(mime)||!kind||!Number.isFinite(size)||size<1||size>MAX_MEDIA)return send(res,400,{error:"Invalid media details."});
    const head=await fetch(root+"/storage/v1/object/authenticated/"+BUCKET+"/"+safePath(path),{method:"HEAD",headers:{apikey:service,Authorization:"Bearer "+service}});
    if(!head.ok)return send(res,400,{error:"The uploaded file could not be verified."});
    const label=kind==="voice_note"?"Voice note":kind==="image"?"Photo":kind==="video"?"Video":"Audio";
    await db(root,service,"store_chat_messages",{method:"POST",body:JSON.stringify({conversation_id:conversationId,sender_type:side,message:label+" · "+name,message_type:kind,media_path:path,media_name:name,media_mime:mime,media_size:size})});
    const now=new Date().toISOString();await db(root,service,"store_chat_conversations?id=eq."+conversationId,{method:"PATCH",body:JSON.stringify({last_message_at:now,updated_at:now,...(side==="admin"?{status:"open"}:{})})});
    return send(res,201,{ok:true});
  }
  if(action==="call_start"){
    const callType=body.call_type==="video"?"video":body.call_type==="voice"?"voice":null,offer=body.offer;
    if(!callType||!offer||typeof offer.sdp!=="string"||offer.sdp.length>100000)return send(res,400,{error:"A valid call offer is required."});
    const active=await getActiveCall(root,service,conversationId);if(active)return send(res,409,{error:"There is already an active or ringing call in this chat."});
    const rows=await db(root,service,"store_chat_calls",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({conversation_id:conversationId,caller_type:side,call_type:callType,status:"ringing"})});
    const call=rows&&rows[0];if(!call)throw new Error("Could not start the call.");
    await addCallEvent(root,service,call.id,side,"offer",offer);
    return send(res,201,{call});
  }
  if(action==="call_event"){
    const callId=cleanText(body.call_id,36),eventType=cleanText(body.event_type,20),payload=body.payload&&typeof body.payload==="object"?body.payload:{};
    const allowed=["answer","ice","accepted","rejected","ended"];
    if(!/^[0-9a-f-]{36}$/i.test(callId)||!allowed.includes(eventType))return send(res,400,{error:"Invalid call event."});
    const call=await getCall(root,service,callId);if(!call||call.conversation_id!==conversationId)return send(res,404,{error:"Call not found."});
    if(["answer","accepted","rejected"].includes(eventType)&&side===call.caller_type)return send(res,403,{error:"Only the other participant can answer this call."});
    if(eventType==="ice"&&(!payload.candidate||typeof payload.candidate!=="object"))return send(res,400,{error:"Invalid ICE candidate."});
    if(eventType==="answer"&&(!payload.sdp||typeof payload.sdp!=="string"))return send(res,400,{error:"Invalid call answer."});
    await addCallEvent(root,service,callId,side,eventType,payload);
    if(eventType==="answer"||eventType==="accepted")await db(root,service,"store_chat_calls?id=eq."+callId,{method:"PATCH",body:JSON.stringify({status:"active",updated_at:new Date().toISOString()})});
    if(eventType==="rejected"||eventType==="ended")await db(root,service,"store_chat_calls?id=eq."+callId,{method:"PATCH",body:JSON.stringify({status:eventType==="rejected"?"rejected":"ended",ended_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    return send(res,201,{ok:true});
  }
  return send(res,400,{error:"Unknown chat action."});
 }catch(error){return send(res,error.status||502,{error:error.message||"Live chat is temporarily unavailable."});}
};
