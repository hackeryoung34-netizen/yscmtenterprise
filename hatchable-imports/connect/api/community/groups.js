import { db, events } from "hatchable";
import crypto from "node:crypto";

export const access="user";
export const methods=["GET","POST"];

const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const uuid=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default async function(req,res){
 const uid=String(req.user.id);
 if(req.method==="GET"){
  const q=clean(req.query?.q,60);
  const {rows}=await db.query(
   `SELECT g.id,g.name,g.slug,g.description,g.category,g.visibility,g.creator_id,g.created_at,
    (SELECT count(*)::int FROM community_group_members m WHERE m.group_id=g.id) AS members_count,
    EXISTS(SELECT 1 FROM community_group_members mine WHERE mine.group_id=g.id AND mine.user_id=$1) AS joined,
    (SELECT mine.role FROM community_group_members mine WHERE mine.group_id=g.id AND mine.user_id=$1 LIMIT 1) AS my_role
    FROM community_groups g
    WHERE (g.visibility='public' OR EXISTS(SELECT 1 FROM community_group_members mine WHERE mine.group_id=g.id AND mine.user_id=$1))
      AND ($2::text='' OR g.name ILIKE '%'||$2||'%' OR g.description ILIKE '%'||$2||'%' OR g.category ILIKE '%'||$2||'%')
    ORDER BY members_count DESC,g.created_at DESC LIMIT 60`,[uid,q]);
  return res.json({groups:rows});
 }
 const action=clean(req.body?.action,12);
 if(action==="join"||action==="leave"){
  const id=req.body?.group_id;if(!uuid(id))return res.status(400).json({error:"Choose a valid group."});
  if(action==="join"){
   const g=await db.query("SELECT id,visibility,creator_id FROM community_groups WHERE id=$1::uuid",[id]);
   if(!g.rows.length)return res.status(404).json({error:"Group not found."});
   if(g.rows[0].visibility==="private"&&g.rows[0].creator_id!==uid)return res.status(403).json({error:"This is a private group. Ask its owner for an invitation."});
   await db.query("INSERT INTO community_group_members(group_id,user_id,role) VALUES($1::uuid,$2,CASE WHEN $3=$2 THEN 'owner' ELSE 'member' END) ON CONFLICT DO NOTHING",[id,uid,g.rows[0].creator_id]);
   await events.publish("community","group-membership",{group_id:id});
   return res.json({ok:true,joined:true});
  }
  await db.query("DELETE FROM community_group_members WHERE group_id=$1::uuid AND user_id=$2 AND role<>'owner'",[id,uid]);
  return res.json({ok:true,joined:false});
 }
 if(action==="invite"){
  const id=req.body?.group_id,username=clean(req.body?.username,24).toLowerCase();
  if(!uuid(id)||! /^[a-z0-9_]{3,24}$/.test(username))return res.status(400).json({error:"Enter a valid username and group."});
  const access=await db.query("SELECT role FROM community_group_members WHERE group_id=$1::uuid AND user_id=$2",[id,uid]);
  if(!access.rows.length||!["owner","moderator"].includes(access.rows[0].role))return res.status(403).json({error:"Only group owners and moderators can invite members."});
  const target=await db.query("SELECT user_id FROM community_profiles WHERE lower(username)=lower($1)",[username]);
  if(!target.rows.length||target.rows[0].user_id===uid)return res.status(404).json({error:"Member not found."});
  const invited=await db.query("INSERT INTO community_group_members(group_id,user_id,role) VALUES($1::uuid,$2,'member') ON CONFLICT DO NOTHING RETURNING user_id",[id,target.rows[0].user_id]);
  if(!invited.rows.length)return res.status(409).json({error:"That member is already in the group."});
  await db.query("INSERT INTO community_notifications(user_id,actor_id,notification_type,entity_id) VALUES($1,$2,'group_invite',$3::uuid)",[target.rows[0].user_id,uid,id]);
  await events.publish("user:"+target.rows[0].user_id,"group-invitation",{group_id:id});
  return res.json({ok:true,message:"Member invited to the group."});
 }
 if(action==="create"){
  const name=clean(req.body?.name,80),description=clean(req.body?.description,500),category=clean(req.body?.category,40)||"General";
  const visibility=req.body?.visibility==="private"?"private":"public";
  if(name.length<3)return res.status(400).json({error:"Group name must contain at least three characters."});
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)+"-"+crypto.randomUUID().slice(0,6);
  const {rows}=await db.query("INSERT INTO community_groups(creator_id,name,slug,description,category,visibility) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,slug,description,category,visibility,created_at",[uid,name,slug,description,category,visibility]);
  await db.query("INSERT INTO community_group_members(group_id,user_id,role) VALUES($1::uuid,$2,'owner')",[rows[0].id,uid]);
  return res.status(201).json({ok:true,group:rows[0]});
 }
 return res.status(400).json({error:"Unknown group action."});
}