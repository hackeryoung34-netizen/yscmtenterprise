import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){const {rows}=await db.query('SELECT id,actor_handle,action,target_type,target_id,details,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100');res.json({logs:rows});}