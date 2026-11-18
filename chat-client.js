(function(){
"use strict";
const $=(tag,attrs={},content)=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>{if(key==="className")el.className=value;else if(key==="style")el.style.cssText=value;else if(value!==false&&value!=null)el.setAttribute(key,value)});if(content!==undefined)el.textContent=content;return el};
function callIcon(kind){
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("width","21");svg.setAttribute("height","21");
 svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","2");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");svg.setAttribute("aria-hidden","true");
 const shape=document.createElementNS("http://www.w3.org/2000/svg",kind==="video"?"path":"path");
 shape.setAttribute("d",kind==="video"?"M15 10l5-3v10l-5-3z M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z":"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.14 4.2 2 2 0 0 1 4.13 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.58 2.8.7A2 2 0 0 1 22 16.92z");
 svg.append(shape);return svg;
}
const fmtSize=n=>n<1024*1024?(n/1024).toFixed(0)+" KB":(n/1024/1024).toFixed(1)+" MB";
const uid=()=>Math.random().toString(36).slice(2,10);
function create(options){
 const role=options.role,host=options.host,status=options.status,callHost=options.callHost;
 const state={conversationId:null,call:null,pc:null,local:null,remote:null,callCursor:0,pendingIce:[],remoteIceQueue:[],seen:new Set(),poller:null,callTimer:null,callStartedAt:0,recorder:null,recordChunks:[],recordStarted:0,recordTimer:null,recordFile:null,queue:[],callBusy:false,incoming:null};
 if(!host)return {setConversation(){},renderMedia:async()=>{}};

 const bar=$("div",{className:"yscmt-chat-tools"});
 const callBar=$("div",{className:"yscmt-chat-call-tools","aria-label":"Call actions"});
 const attachWrap=$("div",{className:"yscmt-attach-wrap"});
 const attach=$("button",{type:"button",className:"yscmt-tool yscmt-attach",title:"Attach photo, video or audio","aria-label":"Attach media"},"＋");
 const menu=$("div",{className:"yscmt-attach-menu",hidden:true});
 const pickers=[
  {label:"Photo",accept:"image/*",icon:"▧"},
  {label:"Video",accept:"video/*",icon:"▶"},
  {label:"Audio file",accept:"audio/*",icon:"♫"}
 ];
 const fileInput=$("input",{type:"file",accept:"image/*,video/*,audio/*",multiple:true,hidden:true});
 const record=$("button",{type:"button",className:"yscmt-tool",title:"Record a voice note","aria-label":"Record voice note"},"🎙");
 const voice=$("button",{type:"button",className:"yscmt-tool yscmt-call-icon",title:"Start voice call","aria-label":"Voice call"});
 const video=$("button",{type:"button",className:"yscmt-tool yscmt-call-icon",title:"Start video call","aria-label":"Video call"});
 voice.append(callIcon("voice"));video.append(callIcon("video"));
 const preview=$("div",{className:"yscmt-upload-preview",hidden:true});
 const previewTitle=$("div",{className:"yscmt-preview-title"},"Attachments");
 const queueList=$("div",{className:"yscmt-queue-list"});
 const uploadProgress=$("div",{className:"yscmt-upload-progress",hidden:true});
 const progressBar=$("div",{className:"yscmt-upload-progress-bar"});
 uploadProgress.append(progressBar);
 const previewActions=$("div",{className:"yscmt-preview-actions"});
 const clearQueue=$("button",{type:"button",className:"yscmt-secondary"},"Cancel");
 const sendQueue=$("button",{type:"button",className:"yscmt-primary"},"Send files");
 previewActions.append(clearQueue,sendQueue);
 preview.append(previewTitle,queueList,uploadProgress,previewActions);

 const recorderPanel=$("div",{className:"yscmt-recorder-panel",hidden:true});
 const recorderTitle=$("div",{className:"yscmt-recorder-title"},"Voice note");
 const recorderClock=$("span",{className:"yscmt-recorder-clock"},"00:00");
 const recorderAudio=$("audio",{controls:true,hidden:true});
 const discardRecording=$("button",{type:"button",className:"yscmt-secondary"},"Discard");
 const sendRecording=$("button",{type:"button",className:"yscmt-primary",disabled:true},"Send voice note");
 const recorderActions=$("div",{className:"yscmt-preview-actions"});
 recorderActions.append(discardRecording,sendRecording);
 recorderPanel.append(recorderTitle,recorderClock,recorderAudio,recorderActions);

 const callBox=$("section",{className:"yscmt-call-box yscmt-call-screen",hidden:true,"aria-label":"Call screen"});
 const callBackdrop=$("div",{className:"yscmt-call-backdrop"});
 const callHeader=$("div",{className:"yscmt-call-header"},"YSCMT CALL");
 const callIdentity=$("div",{className:"yscmt-call-identity"});
 const callAvatar=$("div",{className:"yscmt-call-avatar"},"Y");
 const callName=$("div",{className:"yscmt-call-name"},role==="visitor"?"YSCMT Enterprise":"YSCMT Customer");
 const callLabel=$("div",{className:"yscmt-call-label"},"Calling…");
 const callTimer=$("div",{className:"yscmt-call-timer"},"");
 const remoteVideo=$("video",{className:"yscmt-remote-video",autoplay:true,playsinline:true});
 const localVideo=$("video",{className:"yscmt-local-video",autoplay:true,muted:true,playsinline:true});
 const remoteAudio=$("audio",{autoplay:true});
 const callActions=$("div",{className:"yscmt-call-actions"});
 const accept=$("button",{type:"button",className:"yscmt-call-control yscmt-call-accept"},"Accept");
 const reject=$("button",{type:"button",className:"yscmt-call-control yscmt-call-end yscmt-call-reject"},"Decline");
 const mute=$("button",{type:"button",className:"yscmt-call-control yscmt-call-mute"},"Mute");
 const speaker=$("button",{type:"button",className:"yscmt-call-control yscmt-call-speaker","aria-pressed":"false"},"Speaker");
 const camera=$("button",{type:"button",className:"yscmt-call-control yscmt-call-camera"},"Camera off");
 const end=$("button",{type:"button",className:"yscmt-call-control yscmt-call-end"},"End call");
 callIdentity.append(callAvatar,callName,callLabel,callTimer);
 callActions.append(accept,reject,mute,speaker,camera,end);
 callBox.append(callBackdrop,callHeader,callIdentity,remoteVideo,localVideo,remoteAudio,callActions);
 attachWrap.append(attach,menu);
 bar.append(attachWrap,record,fileInput,preview,recorderPanel);
 document.body.append(callBox);
 callBar.append(voice,video);
 host.append(bar);
 if(callHost)callHost.append(callBar);else bar.append(voice,video);

 function say(message){if(status)status.textContent=message||""}
 function visitor(){return typeof options.getVisitor==="function"?options.getVisitor():null}
 function token(){const s=visitor();return s&&s.visitor_token||null}
 function conversation(){return state.conversationId||(visitor()&&visitor().conversation_id)||null}
 async function request(action,method="POST",extra={}){
  const id=conversation();if(!id)throw new Error("Start a chat first.");
  const isVisitor=role==="visitor",body={action,conversation_id:id,...extra};
  if(isVisitor)body.visitor_token=token();
  const headers={"Content-Type":"application/json"};
  if(role==="admin"){const t=options.getAdminToken&&options.getAdminToken();if(!t)throw new Error("Please sign in as an administrator.");headers.Authorization="Bearer "+t;}
  let url="/api/chat",payload;
  if(method==="GET"){const q=new URLSearchParams({action,id});if(isVisitor)q.set("token",token()||"");Object.entries(extra).forEach(([k,v])=>q.set(k,String(v)));url+="?"+q.toString();}
  else payload=JSON.stringify(body);
  const response=await fetch(url,{method,headers,body:payload});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Chat request failed.");return data;
 }
 async function ensureConversation(){
  if(conversation())return conversation();
  if(role!=="visitor"||!options.ensureVisitorSession)throw new Error("Select a conversation first.");
  const session=await options.ensureVisitorSession();state.conversationId=session.conversation_id;return state.conversationId;
 }
 function showMenu(open){menu.hidden=!open;attach.setAttribute("aria-expanded",String(open))}
 attach.addEventListener("click",()=>showMenu(menu.hidden));
 pickers.forEach(item=>{const b=$("button",{type:"button",className:"yscmt-attach-option"},item.icon+"  "+item.label);b.addEventListener("click",()=>{fileInput.accept=item.accept;fileInput.click();showMenu(false)});menu.append(b)});
 document.addEventListener("click",event=>{if(!attachWrap.contains(event.target))showMenu(false)});
 fileInput.addEventListener("change",()=>{
  const files=Array.from(fileInput.files||[]);fileInput.value="";
  if(state.queue.length+files.length>10){say("Send up to 10 files at a time.");return}
  for(const file of files){
   if(!file.type||!(/^(image|video|audio)\//.test(file.type))){say("Choose only photos, videos or audio files.");continue}
   if(file.size>25*1024*1024){say(file.name+" is larger than 25 MB.");continue}
   state.queue.push({id:uid(),file,kind:file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":"audio"});
  }
  renderQueue();
 });
 function renderQueue(){
  queueList.replaceChildren();
  state.queue.forEach(item=>{
   const row=$("div",{className:"yscmt-queue-item"});
   const thumb=$("div",{className:"yscmt-queue-thumb"});
   if(item.kind==="image"){const img=$("img",{src:URL.createObjectURL(item.file),alt:""});thumb.append(img)}
   else thumb.textContent=item.kind==="video"?"▶":"♫";
   const details=$("div",{className:"yscmt-queue-details"});
   details.append($("strong",{},item.file.name||"Attachment"),$("small",{},item.kind.toUpperCase()+" · "+fmtSize(item.file.size)));
   const remove=$("button",{type:"button",className:"yscmt-remove-file","aria-label":"Remove attachment"},"×");
   remove.addEventListener("click",()=>{state.queue=state.queue.filter(x=>x.id!==item.id);renderQueue()});
   row.append(thumb,details,remove);queueList.append(row);
  });
  preview.hidden=state.queue.length===0;
  if(state.queue.length)previewTitle.textContent=state.queue.length+" attachment"+(state.queue.length===1?"":"s")+" ready";
 }
 clearQueue.addEventListener("click",()=>{state.queue=[];renderQueue();say("")});
 function uploadWithProgress(url,file,onProgress){
  return new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();xhr.open("PUT",url);xhr.setRequestHeader("Content-Type",file.type.split(";")[0]);
   xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total)};
   xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error("Upload failed ("+xhr.status+")."));
   xhr.onerror=()=>reject(new Error("Network error while uploading the file."));
   xhr.send(file);
  });
 }
 async function sendFile(file,kind,onProgress){
  await ensureConversation();
  const mime=file.type.toLowerCase().split(";")[0];
  const init=await request("media_upload","POST",{file_name:file.name||("voice-note."+(mime==="audio/mp4"?"m4a":"webm")),file_mime:mime,file_size:file.size,kind:kind||""});
  await uploadWithProgress(init.upload_url,file,onProgress||(()=>{}));
  await request("media_message","POST",{media_path:init.path,media_name:file.name||"Voice note",media_mime:mime,media_size:file.size,kind:kind||""});
 }
 sendQueue.addEventListener("click",async()=>{
  if(!state.queue.length)return;
  sendQueue.disabled=true;clearQueue.disabled=true;const files=state.queue.slice();let sent=0;
  try{
   await ensureConversation();
   for(const item of files){
    await sendFile(item.file,"",fraction=>{progressBar.style.width=Math.round(((sent+fraction)/files.length)*100)+"%"});
    sent++;progressBar.style.width=Math.round(sent/files.length*100)+"%";
   }
   state.queue=[];renderQueue();say("Files sent.");if(options.refresh)await options.refresh();
  }catch(error){say(error.message+" You can retry the remaining attachments.");}
  finally{sendQueue.disabled=false;clearQueue.disabled=false;uploadProgress.hidden=true;progressBar.style.width="0%"}
 });
 const originalSendQueue=sendQueue;
 const queueObserver=new MutationObserver(()=>{if(state.queue.length&&sendQueue.disabled)uploadProgress.hidden=false});
 queueObserver.observe(sendQueue,{attributes:true,attributeFilter:["disabled"]});

 async function startRecording(){
  await ensureConversation();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)throw new Error("Voice recording is not supported in this browser.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const mime=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
  const recorder=new MediaRecorder(stream,{mimeType:mime});
  state.recorder=recorder;state.recordChunks=[];state.recordStarted=Date.now();state.recordFile=null;
  recorder.ondataavailable=event=>{if(event.data&&event.data.size)state.recordChunks.push(event.data)};
  recorder.onstop=()=>{
   stream.getTracks().forEach(track=>track.stop());clearInterval(state.recordTimer);state.recordTimer=null;
   record.textContent="🎙";record.classList.remove("is-recording");recorderClock.textContent="Recording ready";
   const blob=new Blob(state.recordChunks,{type:recorder.mimeType||mime});
   if(blob.size){const ext=blob.type.includes("mp4")?"m4a":"webm";state.recordFile=new File([blob],"voice-note."+ext,{type:blob.type});recorderAudio.src=URL.createObjectURL(state.recordFile);recorderAudio.hidden=false;sendRecording.disabled=false;recorderTitle.textContent="Listen before sending";}
   else{recorderPanel.hidden=true;say("No audio was recorded.");}
  };
  recorder.start(250);recorderPanel.hidden=false;recorderAudio.hidden=true;sendRecording.disabled=true;record.textContent="■";record.classList.add("is-recording");recorderTitle.textContent="Recording voice note…";
  const tick=()=>{const seconds=Math.floor((Date.now()-state.recordStarted)/1000);recorderClock.textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");if(seconds>=300)stopRecording()};
  tick();state.recordTimer=setInterval(tick,250);
 }
 function stopRecording(){if(state.recorder&&state.recorder.state==="recording")state.recorder.stop();state.recorder=null}
 record.addEventListener("click",async()=>{
  try{if(state.recorder&&state.recorder.state==="recording")stopRecording();else if(!state.recordFile)await startRecording();else{recorderPanel.hidden=!recorderPanel.hidden}}
  catch(error){say(error.message)}
 });
 discardRecording.addEventListener("click",()=>{if(state.recorder&&state.recorder.state==="recording")stopRecording();state.recordFile=null;recorderAudio.pause();recorderAudio.removeAttribute("src");recorderAudio.hidden=true;recorderPanel.hidden=true;sendRecording.disabled=true;record.textContent="🎙";record.classList.remove("is-recording")});
 sendRecording.addEventListener("click",async()=>{
  if(!state.recordFile)return;sendRecording.disabled=true;
  try{await sendFile(state.recordFile,"voice_note",fraction=>{say("Uploading voice note… "+Math.round(fraction*100)+"%")});state.recordFile=null;recorderPanel.hidden=true;recorderAudio.pause();recorderAudio.removeAttribute("src");recorderAudio.hidden=true;say("Voice note sent.");if(options.refresh)await options.refresh()}
  catch(error){say(error.message);sendRecording.disabled=false}
 });

 function callApiEvent(eventType,payload={}){return request("call_event","POST",{call_id:state.call&&state.call.id,event_type:eventType,payload})}
 function showCall(open){callBox.hidden=!open;document.body.classList.toggle("yscmt-call-open",open);bar.classList.toggle("call-active",open)}
 function stopPoller(){if(state.poller){clearInterval(state.poller);state.poller=null}}
 function stopCallClock(){if(state.callTimer){clearInterval(state.callTimer);state.callTimer=null}state.callStartedAt=0;callTimer.textContent="";}
 function startCallClock(){if(state.callTimer)return;state.callStartedAt=Date.now();const tick=()=>{const seconds=Math.max(0,Math.floor((Date.now()-state.callStartedAt)/1000));const mm=String(Math.floor(seconds/60)).padStart(2,"0"),ss=String(seconds%60).padStart(2,"0");callTimer.textContent=mm+":"+ss};tick();state.callTimer=setInterval(tick,1000)}
 function cleanupCall(message){
  stopPoller();stopCallClock();
  if(state.pc){state.pc.ontrack=null;state.pc.onicecandidate=null;state.pc.close();state.pc=null}
  if(state.local)state.local.getTracks().forEach(track=>track.stop());
  state.local=null;state.remote=null;remoteVideo.srcObject=null;localVideo.srcObject=null;remoteAudio.srcObject=null;
  state.call=null;state.callCursor=0;state.pendingIce=[];state.remoteIceQueue=[];state.seen.clear();state.incoming=null;state.callBusy=false;
  accept.hidden=true;reject.hidden=true;mute.hidden=true;speaker.hidden=true;camera.hidden=true;end.hidden=true;remoteVideo.hidden=true;localVideo.hidden=true;remoteAudio.hidden=true;showCall(false);if(message)say(message);
 }
 function makePeer(callType){
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
  state.pc=pc;state.remote=new MediaStream();
  pc.ontrack=event=>{
   const incoming=event.streams&&event.streams[0];
   if(incoming)incoming.getTracks().forEach(track=>{if(!state.remote.getTracks().some(t=>t.id===track.id))state.remote.addTrack(track)});
   if(callType==="video"){remoteVideo.srcObject=state.remote;remoteVideo.hidden=false;remoteAudio.hidden=true}
   else{remoteAudio.srcObject=state.remote;remoteAudio.hidden=false;remoteVideo.hidden=true}
  };
  pc.onicecandidate=event=>{if(event.candidate){const candidate=event.candidate.toJSON();if(state.call)callApiEvent("ice",{candidate}).catch(()=>{});else state.pendingIce.push(candidate)}};
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==="connected"){callLabel.textContent="Connected";startCallClock();say("Call connected.")}
   else if(pc.connectionState==="disconnected"){callLabel.textContent="Reconnecting…";say("Trying to restore the call connection…")}
   else if(pc.connectionState==="failed"){callLabel.textContent="Connection failed";say("Call connection failed. Check your internet connection or network restrictions.")}
  };
  return pc;
 }
 async function prepareLocal(callType){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("Allow microphone and camera access in your browser.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:callType==="video"});
  state.local=stream;localVideo.srcObject=stream;localVideo.hidden=callType!=="video";return stream;
 }
 async function flushIce(){const candidates=state.pendingIce.splice(0);for(const candidate of candidates)await callApiEvent("ice",{candidate})}
 async function flushRemoteIce(){if(!state.pc||!state.pc.remoteDescription)return;const candidates=state.remoteIceQueue.splice(0);for(const candidate of candidates){try{await state.pc.addIceCandidate(new RTCIceCandidate(candidate))}catch(error){}}}
 async function startCall(callType){
  if(state.callBusy||state.call)throw new Error("A call is already active.");
  stopCallClock();
  state.callBusy=true;say("Starting "+(callType==="video"?"video":"voice")+" call…");
  callName.textContent=options.getCallName?options.getCallName():(role==="visitor"?"YSCMT Enterprise":"YSCMT Customer");callAvatar.textContent=(callName.textContent.trim()[0]||"Y").toUpperCase();callBox.classList.toggle("is-video-call",callType==="video");callLabel.textContent="Preparing call…";callTimer.textContent="";showCall(true);
  accept.hidden=true;reject.hidden=true;mute.hidden=true;speaker.hidden=true;camera.hidden=true;end.hidden=false;end.textContent="Cancel";
  try{
   await ensureConversation();
   const stream=await prepareLocal(callType),pc=makePeer(callType);stream.getTracks().forEach(track=>pc.addTrack(track,stream));
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   callLabel.textContent="Calling…";
   const result=await request("call_start","POST",{call_type:callType,offer:pc.localDescription.toJSON()});
   state.call=result.call;state.callCursor=0;callLabel.textContent="Calling…";
   accept.hidden=true;reject.hidden=true;mute.hidden=false;camera.hidden=callType!=="video";end.hidden=false;
   mute.textContent="Mute";mute.classList.remove("is-muted");speaker.textContent="Speaker";speaker.setAttribute("aria-pressed","false");camera.textContent="Camera off";camera.classList.remove("is-camera-off");end.textContent="End call";speaker.hidden=false;await flushIce();beginPoll();
  }catch(error){
   stopPoller();if(state.pc){state.pc.close();state.pc=null}
   if(state.local)state.local.getTracks().forEach(track=>track.stop());
   state.local=null;state.remote=null;localVideo.srcObject=null;remoteVideo.srcObject=null;remoteAudio.srcObject=null;
   state.call=null;state.callBusy=false;callLabel.textContent=error&&error.message?error.message:"Unable to start call";
   accept.hidden=true;reject.hidden=true;mute.hidden=true;camera.hidden=true;end.hidden=false;end.textContent="Close";showCall(true);
   throw error;
  }finally{state.callBusy=false}
 }
 async function acceptCall(){
  if(!state.incoming)return;
  try{
   const stream=await prepareLocal(state.incoming.call_type),pc=makePeer(state.incoming.call_type);stream.getTracks().forEach(track=>pc.addTrack(track,stream));
   await callApiEvent("accepted",{});callLabel.textContent="Connecting…";callTimer.textContent="";accept.hidden=true;reject.hidden=true;mute.hidden=false;speaker.hidden=false;camera.hidden=state.incoming.call_type!=="video";end.hidden=false;mute.textContent="Mute";mute.classList.remove("is-muted");speaker.textContent="Speaker";speaker.setAttribute("aria-pressed","false");camera.textContent="Camera off";camera.classList.remove("is-camera-off");beginPoll();
  }catch(error){await callApiEvent("rejected",{}).catch(()=>{});cleanupCall(error.message)}
 }
 async function rejectCall(){if(!state.call)return;try{await callApiEvent("rejected",{})}catch{}cleanupCall("Call declined.")}
 async function endCall(){if(!state.call){cleanupCall("");return}try{await callApiEvent("ended",{})}catch{}cleanupCall("Call ended.")}
 accept.addEventListener("click",acceptCall);reject.addEventListener("click",rejectCall);end.addEventListener("click",endCall);
 speaker.addEventListener("click",async()=>{
  const output=callBox.classList.contains("is-video-call")?remoteVideo:remoteAudio;
  try{
   if(typeof output.setSinkId==="function"){await output.setSinkId("");speaker.textContent="Speaker on";speaker.setAttribute("aria-pressed","true");say("Audio output set to the default speaker device.")}
   else{speaker.textContent="Speaker help";say("Choose Speaker from your phone audio output menu. On iPhone, open Control Centre, tap the audio output icon, then choose Speaker.")}
  }catch(error){speaker.textContent="Speaker help";say("Could not change audio output. Use your phone audio output menu to choose Speaker.")}
 });
 mute.addEventListener("click",()=>{if(!state.local)return;const track=state.local.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;mute.textContent=track.enabled?"Mute":"Unmute";mute.classList.toggle("is-muted",!track.enabled)});
 camera.addEventListener("click",()=>{if(!state.local)return;const track=state.local.getVideoTracks()[0];if(!track)return;track.enabled=!track.enabled;camera.textContent=track.enabled?"Camera off":"Camera on";camera.classList.toggle("is-camera-off",!track.enabled)});
 async function processEvent(event){
  if(state.seen.has(event.id))return;state.seen.add(event.id);state.callCursor=Math.max(state.callCursor,Number(event.id)||0);
  if(event.sender_type===role)return;
  const pc=state.pc;
  if(event.event_type==="offer"&&pc&&!pc.remoteDescription){
   await pc.setRemoteDescription(new RTCSessionDescription(event.payload));await flushRemoteIce();
   const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await callApiEvent("answer",pc.localDescription.toJSON());await flushIce();callLabel.textContent="Connecting…";
  }else if(event.event_type==="answer"&&pc&&!pc.remoteDescription){
   await pc.setRemoteDescription(new RTCSessionDescription(event.payload));await flushRemoteIce();await flushIce();callLabel.textContent="Connecting…";
  }else if(event.event_type==="ice"&&pc&&event.payload&&event.payload.candidate){
   if(pc.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(event.payload.candidate))}catch(error){}}else state.remoteIceQueue.push(event.payload.candidate);
  }else if(event.event_type==="accepted"){callLabel.textContent="Connecting…"}
  else if(event.event_type==="rejected"){cleanupCall("The other person declined the call.")}
  else if(event.event_type==="ended"){cleanupCall("The other person ended the call.")}
 }
 async function pollCall(){
  if(!state.call)return;
  try{
   const result=await request("call_poll","GET",{id:state.call.id,after:state.callCursor});
   if(result.call.status==="rejected"){cleanupCall("Call declined.");return}
   if(result.call.status==="ended"||result.call.status==="missed"){cleanupCall(result.call.status==="missed"?"Missed call.":"Call ended.");return}
   for(const event of result.events||[])await processEvent(event);
  }catch(error){say(error.message)}
 }
 function beginPoll(){stopPoller();pollCall();state.poller=setInterval(pollCall,1000)}
 async function setConversation(id,activeCall){
  state.conversationId=id||null;
  if(activeCall&&activeCall.status==="ringing"&&activeCall.caller_type!==role&&!state.call){
   state.incoming=activeCall;state.call=activeCall;showCall(true);callName.textContent=options.getCallName?options.getCallName():(role==="visitor"?"YSCMT Enterprise":"YSCMT Customer");callAvatar.textContent=(callName.textContent.trim()[0]||"Y").toUpperCase();callBox.classList.toggle("is-video-call",activeCall.call_type==="video");callLabel.textContent="Incoming call";callTimer.textContent="YSCMT Enterprise calling";
   accept.hidden=false;reject.hidden=false;mute.hidden=true;speaker.hidden=true;camera.hidden=true;end.hidden=true;remoteVideo.hidden=true;localVideo.hidden=true;remoteAudio.hidden=true;
  }else if(activeCall&&state.call&&state.call.id===activeCall.id&&!state.poller)beginPoll();
 }
 voice.addEventListener("click",()=>startCall("voice").catch(error=>say(error.message)));
 video.addEventListener("click",()=>startCall("video").catch(error=>say(error.message)));
 return {setConversation,renderMedia:(message,bubble)=>renderMedia(message,bubble,{request}),sendFile,cleanup:cleanupCall};
}

async function renderMedia(message,bubble,options){
 if(!message||!message.media_path)return;
 const card=$("div",{className:"yscmt-media-card"});
 const label=message.message_type==="voice_note"?"Voice note":message.message_type==="image"?"Photo":message.message_type==="video"?"Video":"Audio file";
 const heading=$("div",{className:"yscmt-media-heading"},(message.message_type==="voice_note"?"🎙 ":message.message_type==="image"?"▧ ":message.message_type==="video"?"▶ ":"♫ ")+label);
 card.append(heading);
 try{
  const data=await options.request("media_url","GET",{id:message.id});
  if(message.message_type==="image"){
   const img=$("img",{src:data.url,alt:message.media_name||"Shared photo",loading:"lazy",className:"yscmt-chat-media"});img.addEventListener("click",()=>window.open(data.url,"_blank","noopener"));card.append(img);
  }else if(message.message_type==="video"){
   card.append($("video",{src:data.url,controls:true,playsinline:true,preload:"metadata",className:"yscmt-chat-media"}));
  }else{
   const audio=$("audio",{src:data.url,controls:true,preload:"metadata",className:"yscmt-chat-audio"});card.append(audio);
  }
  const meta=$("div",{className:"yscmt-media-filename"},(message.media_name||label)+(message.media_size?" · "+fmtSize(Number(message.media_size)):""));
  card.append(meta);
  const actions=$("div",{className:"yscmt-media-actions"});
  const download=$("a",{href:"#",rel:"noopener",className:"yscmt-media-download"},"Download");
  download.addEventListener("click",async event=>{event.preventDefault();const tab=window.open("about:blank","_blank");try{const file=await options.request("media_download","GET",{id:message.id});if(tab)tab.location=file.url;else window.location.href=file.url}catch(error){if(tab)tab.close();say(error.message)}});
  actions.append(download);card.append(actions);
 }catch(error){card.append($("div",{className:"yscmt-media-filename"},"Could not load this attachment."))}
 bubble.append(card);
}
window.YSCMTChatExtras={create};
})();