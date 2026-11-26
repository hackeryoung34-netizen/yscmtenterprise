import { db, events } from "hatchable";
import crypto from "node:crypto";

export const access="user";
export const methods=["GET","POST","PATCH"];

const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default async function(req,res){
 const uid=String(req.user.id);
 if(req.method==="GET"){
  const {rows}=await db.query(
   `SELECT l.id,l.host_id,l.title,l.description,l.meeting_url,l.status,l.starts_at,l.created_at,p.display_name,p.username,p.avatar_url
    FROM community_live_sessions l JOIN community_profiles p ON p.user_id=l.host_id
    WHERE l.status IN ('scheduled','live') AND l.starts_at>now()-interval '6 hours'
    ORDER BY l.starts_at ASC LIMIT 40`);
  return res.json({sessions:rows});
 }
 if(req.method==="PATCH"){
  const id=req.body?.id,status=req.body?.status;
  if(!uuid(id)||!["live","ended","cancelled"].includes(status))return res.status(400).json({error:"Invalid session update."});
  const {rows}=await db.query("UPDATE community_live_sessions SET status=$1 WHERE id=$2::uuid AND host_id=$3 AND status IN ('scheduled','live') RETURNING id,status,title",[status,id,uid]);
  if(!rows.length)return res.status(404).json({error:"Session not found or you are not its host."});
  await events.publish("community","live-session-updated",{session_id:id,status});
  return res.json({ok:true,session:rows[0]});
 }
 const title=clean(req.body?.title,120),description=clean(req.body?.description,1000),starts=Date.parse(req.body?.starts_at||"");
 if(title.length<3||!Number.isFinite(starts)||starts<Date.now()-60000||starts>Date.now()+90*86400000)return res.status(400).json({error:"Enter a title and a valid start time within the next 90 days."});
 let meeting=clean(req.body?.meeting_url,500);
 if(!meeting)meeting="https://meet.jit.si/YSCMTConnect-"+crypto.randomUUID();
 let parsed;try{parsed=new URL(meeting)}catch{return res.status(400).json({error:"Enter a valid meeting URL."})}
 const allowed=["meet.jit.si","meet.google.com","zoom.us","www.zoom.us","teams.microsoft.com"];
 if(parsed.protocol!=="https:"||!allowed.some(h=>parsed.hostname===h||parsed.hostname.endsWith("."+h)))return res.status(400).json({error:"Use a secure Jitsi, Google Meet, Zoom or Microsoft Teams meeting link."});
 const {rows}=await db.query("INSERT INTO community_live_sessions(host_id,title,description,meeting_url,starts_at) VALUES($1,$2,$3,$4,$5) RETURNING id,title,description,meeting_url,status,starts_at,created_at",[uid,title,description,meeting,new Date(starts).toISOString()]);
 await events.publish("community","live-session-created",{session_id:rows[0].id});
 const followers=await db.query("SELECT follower_id FROM community_follows WHERE following_id=$1 LIMIT 100",[uid]);
 for(const follower of followers.rows){
  await db.query("INSERT INTO community_notifications(user_id,actor_id,notification_type,entity_id) VALUES($1,$2,'live',$3::uuid)",[follower.follower_id,uid,rows[0].id]);
  await events.publish("user:"+follower.follower_id,"notification",{type:"live",session_id:rows[0].id});
 }
 return res.status(201).json({ok:true,session:rows[0]});
}