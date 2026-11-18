(function(){
"use strict";
const $=(tag,attrs={},text)=>{const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>{if(k==="className")e.className=v;else if(k==="style")e.style.cssText=v;else e.setAttribute(k,v)});if(text!==undefined)e.textContent=text;return e};
const allowedFiles="image/*,video/*,audio/*";
function create(options){
 const role=options.role,host=options.host,status=options.status;
 const state={conversationId:null,visitorToken:null,call:null,pc:null,local:null,remote:null,callCursor:0,pendingIce:[],seen:new Set(),poller:null,recorder:null,recordChunks:[],incoming:null,callBusy:false};
 if(!host)return {setConversation(){},renderMedia:async()=>{}};
 const bar=$("div",{className:"yscmt-chat-tools"});
 const fileInput=$("input",{type:"file",accept:allowedFiles,hidden:"hidden"});
 const choose=$("button",{type:"button",title:"Attach photo, video or audio"},"＋");
 const record=$("button",{type:"button",title:"Record voice note"},"🎙");
 const voice=$("button",{type:"button",title:"Start voice call"},"☎");
 const video=$("button",{type:"button",title:"Start video call"},"▣");
 const callBox=$("div",{className:"yscmt-call-box",hidden:"hidden"});
 const callLabel=$("div",{className:"yscmt-call-label"},"Call");
 const remoteVideo=$("video",{className:"yscmt-remote-video",autoplay:"",playsinline:""});
 const localVideo=$("video",{className:"yscmt-local-video",autoplay:"",muted:"",playsinline:""});
 const remoteAudio=$("audio",{autoplay:""});
 const accept=$("button",{type:"button"},"Accept");
 const reject=$("button",{type:"button"},"Decline");
 const end=$("button",{type:"button"},"End call");
 const callActions=$("div",{className:"yscmt-call-actions"});
 callActions.append(accept,reject,end);callBox.append(callLabel,remoteVideo,localVideo,remoteAudio,callActions);
 bar.append(choose,record,voice,video,fileInput,callBox);host.append(bar);
 function say(text){if(status)status.textContent=text}
 function visitor(){return typeof options.getVisitor==="function"?options.getVisitor():null}
 function token(){const s=visitor();return s&&s.visitor_token||null}
 function conversation(){return state.conversationId||(visitor()&&visitor().conversation_id)||null}
 async function request(action,method="POST",extra={}){
  const id=conversation();if(!id)throw new Error("Start a chat first.");
  const isVisitor=role==="visitor",s=visitor();
  const body={action,conversation_id:id,...extra};
  if(isVisitor)body.visitor_token=token();
  const headers={"Content-Type":"application/json"};
  if(role==="admin"){const t=options.getAdminToken&&options.getAdminToken();if(!t)throw new Error("Please sign in as an administrator.");headers.Authorization="Bearer "+t;}
  let url="/api/chat",payload;
  if(method==="GET"){const q=new URLSearchParams({action,id});if(isVisitor)q.set("token",token()||"");Object.entries(extra).forEach(([k,v])=>q.set(k,String(v)));url+="?"+q.toString();}
  else payload=JSON.stringify(body);
  const r=await fetch(url,{method,headers,body:payload});const d=await r.json();if(!r.ok)throw new Error(d.error||"Chat request failed.");return d;
 }
 async function ensureConversation(){
  if(conversation())return conversation();
  if(role!=="visitor"||!options.ensureVisitorSession)throw new Error("Select a conversation first.");
  const s=await options.ensureVisitorSession();state.conversationId=s.conversation_id;state.visitorToken=s.visitor_token;return state.conversationId;
 }
 async function signedMedia(message){
  const d=await request("media_url","GET",{id:message.id});
  return d.url;
 }
 async function renderMedia(message,bubble){
  if(!message||!message.media_path)return;
  const caption=$("div",{className:"yscmt-media-caption"},message.media_name||message.message_type);
  bubble.append(caption);
  try{
   const url=await signedMedia(message),kind=message.message_type;
   let media;
   if(kind==="image"){media=$("img",{src:url,alt:message.media_name||"Shared image",loading:"lazy"});}
   else if(kind==="video"){media=$("video",{src:url,controls:"",playsinline:"",preload:"metadata"});}
   else{media=$("audio",{src:url,controls:"",preload:"metadata"});}
   media.classList.add("yscmt-chat-media");bubble.append(media);
   if(kind==="voice_note")caption.textContent="🎙 Voice note";
  }catch(e){caption.textContent=(message.media_name||"Attachment")+" (could not load)";}
 }
 async function sendFile(file,kind){
  await ensureConversation();
  if(!file)return;
  if(file.size>25*1024*1024)throw new Error("Each file must be 25 MB or smaller.");
  if(!file.type||(!file.type.startsWith("image/")&&!file.type.startsWith("video/")&&!file.type.startsWith("audio/")))throw new Error("Only photos, videos and audio files are supported.");
  say("Preparing secure upload…");
  const init=await request("media_upload","POST",{file_name:file.name||("voice-note."+((file.type.split("/")[1]||"webm"))),file_mime:file.type,file_size:file.size,kind:kind||""});
  const up=await fetch(init.upload_url,{method:"PUT",headers:{"Content-Type":file.type.split(";")[0]},body:file});
  if(!up.ok)throw new Error("File upload failed. Please try again.");
  await request("media_message","POST",{media_path:init.path,media_name:file.name||"Voice note",media_mime:file.type,media_size:file.size,kind:kind||""});
  say("Attachment sent.");if(options.refresh)await options.refresh();
 }
 choose.addEventListener("click",()=>fileInput.click());
 fileInput.addEventListener("change",async()=>{const file=fileInput.files&&fileInput.files[0];fileInput.value="";if(!file)return;try{await sendFile(file,"");}catch(e){say(e.message)}});
 async function startRecording(){
  await ensureConversation();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)throw new Error("Voice recording is not supported in this browser.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  let mime="audio/webm";
  if(MediaRecorder.isTypeSupported("audio/mp4"))mime="audio/mp4";
  else if(MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))mime="audio/webm;codecs=opus";
  const recorder=new MediaRecorder(stream,{mimeType:mime});
  state.recorder=recorder;state.recordChunks=[];
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.recordChunks.push(e.data)};
  recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());record.textContent="🎙";record.title="Record voice note";const blob=new Blob(state.recordChunks,{type:recorder.mimeType||mime});if(blob.size){const ext=blob.type.includes("mp4")?"m4a":"webm";const file=new File([blob],"voice-note."+ext,{type:blob.type});try{await sendFile(file,"voice_note")}catch(e){say(e.message)}}};
  recorder.start();record.textContent="■";record.title="Stop recording";say("Recording voice note… Tap ■ to finish.");
 }
 record.addEventListener("click",async()=>{try{if(state.recorder&&state.recorder.state==="recording"){state.recorder.stop();state.recorder=null;}else await startRecording();}catch(e){say(e.message)}});
 function callApiEvent(eventType,payload={}){return request("call_event","POST",{call_id:state.call&&state.call.id,event_type:eventType,payload});}
 function showCall(show){callBox.hidden=!show;bar.classList.toggle("call-active",show)}
 function stopPoller(){if(state.poller){clearInterval(state.poller);state.poller=null}}
 function cleanupCall(message){
  stopPoller();if(state.pc){state.pc.ontrack=null;state.pc.onicecandidate=null;state.pc.close();state.pc=null;}
  if(state.local)state.local.getTracks().forEach(t=>t.stop());state.local=null;state.remote=null;
  remoteVideo.srcObject=null;localVideo.srcObject=null;remoteAudio.srcObject=null;
  state.call=null;state.callCursor=0;state.pendingIce=[];state.seen.clear();state.incoming=null;state.callBusy=false;
  accept.hidden=true;reject.hidden=true;end.hidden=true;remoteVideo.hidden=true;localVideo.hidden=true;remoteAudio.hidden=true;showCall(false);if(message)say(message);
 }
 function makePeer(callType){
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
  state.pc=pc;state.remote=new MediaStream();
  pc.ontrack=e=>{e.streams[0].getTracks().forEach(t=>state.remote.addTrack(t));remoteVideo.srcObject=state.remote;remoteAudio.srcObject=state.remote;if(callType==="video"){remoteVideo.hidden=false;remoteAudio.hidden=true;}else{remoteVideo.hidden=true;remoteAudio.hidden=false;}};
  pc.onicecandidate=e=>{if(e.candidate){if(state.call)callApiEvent("ice",{candidate:e.candidate.toJSON()}).catch(()=>{});else state.pendingIce.push(e.candidate.toJSON());}};
  pc.onconnectionstatechange=()=>{if(["failed","disconnected"].includes(pc.connectionState))say("Call connection interrupted. Check your network.");};
  return pc;
 }
 async function prepareLocal(callType){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("Your browser needs microphone/camera permission for calls.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:callType==="video"});
  state.local=stream;localVideo.srcObject=stream;localVideo.hidden=callType!=="video";return stream;
 }
 async function flushIce(){const queued=state.pendingIce.splice(0);for(const candidate of queued)await callApiEvent("ice",{candidate});}
 async function startCall(callType){
  if(state.callBusy||state.call)throw new Error("A call is already active.");
  await ensureConversation();state.callBusy=true;say("Starting "+callType+" call…");
  try{
   const stream=await prepareLocal(callType),pc=makePeer(callType);stream.getTracks().forEach(t=>pc.addTrack(t,stream));
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   const d=await request("call_start","POST",{call_type:callType,offer:pc.localDescription.toJSON()});
   state.call=d.call;state.callCursor=0;showCall(true);callLabel.textContent=(callType==="video"?"Video":"Voice")+" call · Calling…";
   accept.hidden=true;reject.hidden=true;end.hidden=false;await flushIce();beginPoll();
  }catch(e){cleanupCall();throw e;}finally{state.callBusy=false;}
 }
 async function acceptCall(){
  if(!state.incoming)return;
  const call=state.incoming;state.call=call;state.callCursor=0;
  try{
   const stream=await prepareLocal(call.call_type),pc=makePeer(call.call_type);stream.getTracks().forEach(t=>pc.addTrack(t,stream));
   showCall(true);callLabel.textContent=(call.call_type==="video"?"Video":"Voice")+" call · Connecting…";accept.hidden=true;reject.hidden=true;end.hidden=false;beginPoll();
  }catch(e){await callApiEvent("rejected",{}).catch(()=>{});cleanupCall(e.message);}
 }
 async function rejectCall(){if(!state.call)return;try{await callApiEvent("rejected",{})}catch{}cleanupCall("Call declined.");}
 async function endCall(){if(!state.call)return;try{await callApiEvent("ended",{})}catch{}cleanupCall("Call ended.");}
 accept.addEventListener("click",acceptCall);reject.addEventListener("click",rejectCall);end.addEventListener("click",endCall);
 async function processEvent(event){
  if(state.seen.has(event.id))return;state.seen.add(event.id);state.callCursor=Math.max(state.callCursor,Number(event.id)||0);
  if(event.sender_type===role)return;
  const pc=state.pc;
  if(event.event_type==="offer"&&pc&&!pc.remoteDescription){
   await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
   const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await callApiEvent("answer",pc.localDescription.toJSON());await flushIce();callLabel.textContent="Connected · "+(state.call.call_type==="video"?"Video":"Voice");
  }else if(event.event_type==="answer"&&pc&&!pc.remoteDescription){
   await pc.setRemoteDescription(new RTCSessionDescription(event.payload));await flushIce();callLabel.textContent="Connected · "+(state.call.call_type==="video"?"Video":"Voice");
  }else if(event.event_type==="ice"&&pc&&event.payload&&event.payload.candidate){
   try{await pc.addIceCandidate(new RTCIceCandidate(event.payload.candidate));}catch(e){}
  }else if(event.event_type==="rejected"){cleanupCall("The other person declined the call.");}
  else if(event.event_type==="ended"){cleanupCall("The other person ended the call.");}
 }
 async function pollCall(){
  if(!state.call)return;
  try{
   const d=await request("call_poll","GET",{id:state.call.id,after:state.callCursor});
   if(d.call.status==="rejected"){cleanupCall("Call declined.");return}
   if(d.call.status==="ended"||d.call.status==="missed"){cleanupCall("Call ended.");return}
   for(const event of d.events||[])await processEvent(event);
  }catch(e){say(e.message)}
 }
 function beginPoll(){stopPoller();pollCall();state.poller=setInterval(pollCall,1200)}
 async function setConversation(id,activeCall){
  state.conversationId=id||null;
  if(activeCall&&activeCall.status==="ringing"&&activeCall.caller_type!==role&&!state.call&&!state.incoming){
   state.incoming=activeCall;state.call=activeCall;showCall(true);callLabel.textContent="Incoming "+(activeCall.call_type==="video"?"video":"voice")+" call…";accept.hidden=false;reject.hidden=false;end.hidden=true;remoteVideo.hidden=true;localVideo.hidden=true;remoteAudio.hidden=true;
  }else if(activeCall&&state.call&&state.call.id===activeCall.id&&!state.poller)beginPoll();
 }
 choose.disabled=false;
 voice.addEventListener("click",()=>startCall("voice").catch(e=>say(e.message)));
 video.addEventListener("click",()=>startCall("video").catch(e=>say(e.message)));
 return {setConversation,renderMedia,sendFile,startCall,cleanup:cleanupCall};
}
window.YSCMTChatExtras={create};
})();
