import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){const {rows}=await db.query('SELECT id,title,description,level,fee_amount,fee_currency FROM courses WHERE active = true ORDER BY title');res.json({courses:rows});}