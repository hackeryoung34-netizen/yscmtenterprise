import { db, storage, events } from "hatchable";

export const access = "user";
export const methods = ["GET","POST","PATCH"];

const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default async function(req,res){
 const uid=String(req.user.id);
 if(req.method==="GET"){
  const conversationId=req.query?.conversation_id;
  if(conversationId){
   if(!uuid(conversationId))return res.status(400).json({error:"Invalid conversation."});
   const member=await db.query("SELECT 1 FROM community_conversation_members WHERE conversation_id=$1::uuid AND user_id=$2",[conversationId,uid]);
   if(!member.rows.length)return res.status(404).json({error:"Conversation not found."});
   const {rows}=await db.query(
    `SELECT m.id,m.body,m.user_id,m.created_at,m.read_at,p.display_name,p.username,p.avatar_url,
      x.storage_key,x.content_type
     FROM community_messages m
     JOIN community_profiles p ON p.user_id=m.user_id
     LEFT JOIN community_media x ON x.id=m.media_id
     WHERE m.conversation_id=$1::uuid
     ORDER BY m.created_at ASC LIMIT 100`,[conversationId]);
   const messages=await Promise.all(rows.map(async m=>({id:m.id,body:m.body,user_id:m.user_id,created_at:m.created_at,read_at:m.read_at,display_name:m.display_name,username:m.username,avatar_url:m.avatar_url,media_url:m.storage_key?await storage.url(m.storage_key):null,media_type:m.content_type||null})));
   return res.json({messages});
  }
  const {rows}=await db.query(
   `SELECT c.id,c.last_message_at,
      other.user_id AS other_user_id,p.display_name,p.username,p.avatar_url,p.field,
      (SELECT body FROM community_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT count(*)::int FROM community_messages m WHERE m.conversation_id=c.id AND m.user_id<>$1 AND m.read_at IS NULL) AS unread_count
    FROM community_conversations c
    JOIN community_conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1
    JOIN community_conversation_members other ON other.conversation_id=c.id AND other.user_id<>$1
    JOIN community_profiles p ON p.user_id=other.user_id
    ORDER BY c.last_message_at DESC LIMIT 50`,[uid]);
  return res.json({conversations:rows});
 }
 if(req.method==="PATCH"){
  const id=req.body?.conversation_id;
  if(!uuid(id))return res.status(400).json({error:"Invalid conversation."});
  await db.query("UPDATE community_messages SET read_at=now() WHERE conversation_id=$1::uuid AND user_id<>$2 AND read_at IS NULL AND EXISTS(SELECT 1 FROM community_conversation_members m WHERE m.conversation_id=$1::uuid AND m.user_id=$2)",[id,uid]);
  await db.query("UPDATE community_conversation_members SET last_read_at=now() WHERE conversation_id=$1::uuid AND user_id=$2",[id,uid]);
  return res.json({ok:true});
 }
 const recipient=clean(req.body?.recipient_id,128);
 const body=clean(req.body?.body,4000);
 const mediaId=req.body?.media_id;
 if(!recipient||recipient===uid||(!body&&!uuid(mediaId)))return res.status(400).json({error:"Choose a member and write a message or attach media."});
 const target=await db.query("SELECT user_id FROM community_profiles WHERE user_id=$1 AND profile_visibility='public' AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=$1) OR (b.blocker_id=$1 AND b.blocked_id=$2))",[recipient,uid]);
 if(!target.rows.length)return res.status(404).json({error:"Member not found, private, or unavailable for messages."});
 if(mediaId){if(!uuid(mediaId))return res.status(400).json({error:"Invalid media attachment."});const own=await db.query("SELECT id FROM community_media WHERE id=$1::uuid AND user_id=$2",[mediaId,uid]);if(!own.rows.length)return res.status(400).json({error:"Invalid media attachment."});}
 let conversation=await db.query(
  `SELECT c.id FROM community_conversations c
   JOIN community_conversation_members a ON a.conversation_id=c.id AND a.user_id=$1
   JOIN community_conversation_members b ON b.conversation_id=c.id AND b.user_id=$2
   WHERE (SELECT count(*) FROM community_conversation_members z WHERE z.conversation_id=c.id)=2
   LIMIT 1`,[uid,recipient]);
 let id;
 if(conversation.rows.length)id=conversation.rows[0].id;
 else{
  const created=await db.query("INSERT INTO community_conversations(created_by) VALUES($1) RETURNING id",[uid]);
  id=created.rows[0].id;
  await db.query("INSERT INTO community_conversation_members(conversation_id,user_id) VALUES($1::uuid,$2),($1::uuid,$3)",[id,uid,recipient]);
 }
 const {rows}=await db.query("INSERT INTO community_messages(conversation_id,user_id,body,media_id) VALUES($1::uuid,$2,$3,$4::uuid) RETURNING id,body,created_at",[id,uid,body,mediaId||null]);
 await db.query("UPDATE community_conversations SET last_message_at=now() WHERE id=$1::uuid",[id]);
 await db.query("INSERT INTO community_notifications(user_id,actor_id,notification_type,entity_id) VALUES($1,$2,'message',$3::uuid)",[recipient,uid,id]);
 await events.publish("user:"+recipient,"message",{conversation_id:id,message_id:rows[0].id});
 return res.status(201).json({ok:true,conversation_id:id,message:rows[0]});
}