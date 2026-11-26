import { db, storage, events } from "hatchable";

export const access="user";
export const methods=["GET","POST","DELETE"];

const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default async function(req,res){
 const uid=String(req.user.id);
 if(req.method==="GET"){
  const {rows}=await db.query(
   `SELECT s.id,s.user_id,s.caption,s.created_at,s.expires_at,p.display_name,p.username,p.avatar_url,m.storage_key,m.media_type
    FROM community_stories s JOIN community_profiles p ON p.user_id=s.user_id
    JOIN community_media m ON m.id=s.media_id
    WHERE s.expires_at>now() AND (s.user_id=$1 OR p.profile_visibility='public')
      AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=$1))
    ORDER BY s.created_at DESC LIMIT 80`,[uid]);
  const stories=await Promise.all(rows.map(async s=>({...s,media_url:await storage.url(s.storage_key),storage_key:undefined})));
  return res.json({stories});
 }
 if(req.method==="POST"){
  const mediaId=req.body?.media_id,caption=clean(req.body?.caption,300);
  if(!uuid(mediaId))return res.status(400).json({error:"Upload an image or video for your story first."});
  const media=await db.query("SELECT id FROM community_media WHERE id=$1::uuid AND user_id=$2",[mediaId,uid]);
  if(!media.rows.length)return res.status(400).json({error:"Media not found or not owned by you."});
  const {rows}=await db.query("INSERT INTO community_stories(user_id,media_id,caption) VALUES($1,$2::uuid,$3) RETURNING id,created_at,expires_at",[uid,mediaId,caption]);
  await events.publish("community","story-created",{story_id:rows[0].id});
  return res.status(201).json({ok:true,story:rows[0]});
 }
 const id=req.body?.id;if(!uuid(id))return res.status(400).json({error:"Invalid story."});
 const {rows}=await db.query("DELETE FROM community_stories WHERE id=$1::uuid AND user_id=$2 RETURNING id",[id,uid]);
 if(!rows.length)return res.status(404).json({error:"Story not found."});
 return res.json({ok:true});
}