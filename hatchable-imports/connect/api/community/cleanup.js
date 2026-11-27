import { db, storage } from "hatchable";

export const access = "scheduler";
export const schedule = "15 3 * * *";

export default async function(req,res){
 const expired=await db.query("DELETE FROM community_stories WHERE expires_at<=now() RETURNING media_id");
 let removedFiles=0;
 for(const row of expired.rows){
  const used=await db.query(
   `SELECT
     EXISTS(SELECT 1 FROM community_posts WHERE media_id=$1::uuid) OR
     EXISTS(SELECT 1 FROM community_messages WHERE media_id=$1::uuid) OR
     EXISTS(SELECT 1 FROM community_group_posts WHERE media_id=$1::uuid) OR
     EXISTS(SELECT 1 FROM community_stories WHERE media_id=$1::uuid)
     AS used`,[row.media_id]);
  if(!used.rows[0].used){
   const media=await db.query("DELETE FROM community_media WHERE id=$1::uuid RETURNING storage_key",[row.media_id]);
   if(media.rows[0]){
    await storage.del(media.rows[0].storage_key);
    removedFiles++;
   }
  }
 }
 await db.query("DELETE FROM community_notifications WHERE created_at<now()-interval '180 days'");
 return res.json({ok:true,expired_stories:expired.rows.length,removed_files:removedFiles});
}