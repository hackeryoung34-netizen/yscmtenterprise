import { db, storage } from "hatchable";
import crypto from "node:crypto";

export const access = "user";
export const methods = ["GET", "POST", "DELETE"];

function sniff(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 3 && b[0]===255 && b[1]===216 && b[2]===255) return ["image","image/jpeg","jpg"];
  if (b.length >= 8 && b[0]===137 && b[1]===80 && b[2]===78 && b[3]===71) return ["image","image/png","png"];
  if (b.length >= 6 && String.fromCharCode(...b.slice(0,6)).startsWith("GIF8")) return ["image","image/gif","gif"];
  if (b.length >= 12 && String.fromCharCode(...b.slice(0,4))==="RIFF" && String.fromCharCode(...b.slice(8,12))==="WEBP") return ["image","image/webp","webp"];
  if (b.length >= 12 && String.fromCharCode(...b.slice(4,8))==="ftyp") return ["video","video/mp4","mp4"];
  if (b.length >= 4 && b[0]===0x1a && b[1]===0x45 && b[2]===0xdf && b[3]===0xa3) return ["video","video/webm","webm"];
  return null;
}

export default async function(req,res){
 const uid=String(req.user.id);
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT id,media_type,content_type,bytes,storage_key,created_at FROM community_media WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40",[uid]);
  const media=await Promise.all(rows.map(async x=>({id:x.id,type:x.media_type,content_type:x.content_type,bytes:x.bytes,url:await storage.url(x.storage_key),created_at:x.created_at})));
  return res.json({media});
 }
 if(req.method==="POST"){
  const file=(req.files||[]).find(f=>f.field==="file");
  if(!file||!file.buffer)return res.status(400).json({error:"Choose an image or video first."});
  const bytes=file.buffer.length;
  const detected=sniff(file.buffer);
  if(!detected)return res.status(415).json({error:"This file format is not supported. Use JPEG, PNG, GIF, WebP, MP4 or WebM."});
  const [type,contentType,ext]=detected;
  const max=type==="image"?8*1024*1024:10*1024*1024;
  if(bytes>max)return res.status(413).json({error:type==="image"?"Image limit is 8 MB.":"Video limit is 30 MB."});
  const count=await db.query("SELECT count(*)::int AS n FROM community_media WHERE user_id=$1 AND created_at>now()-interval '24 hours'",[uid]);
  if(count.rows[0].n>=80)return res.status(429).json({error:"Daily media upload limit reached. Try again tomorrow."});
  const key="community/"+uid+"/"+crypto.randomUUID()+"."+ext;
  const url=await storage.put(key,file.buffer,contentType);
  const publicUrl=type==="image"?await storage.urlPermanent(key):null;
  const {rows}=await db.query("INSERT INTO community_media(user_id,storage_key,media_type,content_type,bytes) VALUES($1,$2,$3,$4,$5) RETURNING id,media_type,content_type,bytes,created_at",[uid,key,type,contentType,bytes]);
  return res.status(201).json({ok:true,media:{...rows[0],url,public_url:publicUrl}});
 }
 const id=req.body?.id;
 if(typeof id!=="string"||! /^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:"Invalid media ID."});
 await db.query("DELETE FROM community_stories WHERE media_id=$1::uuid AND expires_at<=now() AND user_id=$2",[id,uid]);
 const {rows}=await db.query("SELECT id,storage_key FROM community_media WHERE id=$1::uuid AND user_id=$2",[id,uid]);
 if(!rows.length)return res.status(404).json({error:"Media not found."});
 const used=await db.query("SELECT (EXISTS(SELECT 1 FROM community_posts WHERE media_id=$1::uuid AND status='published') OR EXISTS(SELECT 1 FROM community_stories WHERE media_id=$1::uuid) OR EXISTS(SELECT 1 FROM community_messages WHERE media_id=$1::uuid) OR EXISTS(SELECT 1 FROM community_group_posts WHERE media_id=$1::uuid)) AS used",[id]);
 if(used.rows[0].used)return res.status(409).json({error:"This media is attached to published content and cannot be deleted yet."});
 await storage.del(rows[0].storage_key);
 await db.query("DELETE FROM community_media WHERE id=$1::uuid AND user_id=$2",[id,uid]);
 return res.json({ok:true});
}