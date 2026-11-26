import { db, storage, events } from "hatchable";

export const access="user";
export const methods=["GET","POST"];

const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default async function(req,res){
 const uid=String(req.user.id),groupId=req.query?.group_id||req.body?.group_id;
 if(!uuid(groupId))return res.status(400).json({error:"A valid group is required."});
 const membership=await db.query("SELECT role FROM community_group_members WHERE group_id=$1::uuid AND user_id=$2",[groupId,uid]);
 if(!membership.rows.length)return res.status(403).json({error:"Join this group before viewing its discussions."});
 if(req.method==="GET"){
  const {rows}=await db.query(
   `SELECT p.id,p.body,p.created_at,p.edited_at,p.user_id,u.display_name,u.username,u.avatar_url,m.storage_key,m.content_type
    FROM community_group_posts p JOIN community_profiles u ON u.user_id=p.user_id
    LEFT JOIN community_media m ON m.id=p.media_id
    WHERE p.group_id=$1::uuid ORDER BY p.created_at DESC LIMIT 50`,[groupId]);
  const posts=await Promise.all(rows.map(async p=>({...p,media_url:p.storage_key?await storage.url(p.storage_key):null})));
  return res.json({posts});
 }
 const body=clean(req.body?.body,4000),mediaId=req.body?.media_id;
 if(!body)return res.status(400).json({error:"Write a message before publishing to the group."});
 if(mediaId){if(!uuid(mediaId))return res.status(400).json({error:"Invalid media attachment."});const m=await db.query("SELECT id FROM community_media WHERE id=$1::uuid AND user_id=$2",[mediaId,uid]);if(!m.rows.length)return res.status(400).json({error:"Invalid media attachment."});}
 const {rows}=await db.query("INSERT INTO community_group_posts(group_id,user_id,body,media_id) VALUES($1::uuid,$2,$3,$4::uuid) RETURNING id,body,created_at",[groupId,uid,body,mediaId||null]);
 const others=await db.query("SELECT user_id FROM community_group_members WHERE group_id=$1::uuid AND user_id<>$2 LIMIT 100",[groupId,uid]);
 for(const member of others.rows){
  await db.query("INSERT INTO community_notifications(user_id,actor_id,notification_type,entity_id) VALUES($1,$2,'group',$3::uuid)",[member.user_id,uid,groupId]);
  await events.publish("user:"+member.user_id,"group-post",{group_id:groupId,post_id:rows[0].id});
 }
 return res.status(201).json({ok:true,post:rows[0]});
}