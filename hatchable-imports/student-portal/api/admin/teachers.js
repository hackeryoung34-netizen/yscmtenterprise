import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST','DELETE'];
export default async function(req,res){
 if(req.method==='GET'){
  const {rows}=await db.query("SELECT u.id,u.email,COALESCE(NULLIF(BTRIM(u.name),''),u.email) AS name,tr.active,tr.created_at,COALESCE(json_agg(json_build_object('id',c.id,'title',c.title)) FILTER (WHERE c.id IS NOT NULL),'[]'::json) AS courses FROM teacher_roles tr JOIN users u ON u.id=tr.user_id LEFT JOIN teacher_course_assignments tca ON tca.teacher_id=tr.user_id LEFT JOIN courses c ON c.id=tca.course_id GROUP BY u.id,u.email,u.name,tr.active,tr.created_at ORDER BY tr.created_at DESC");
  return res.json({teachers:rows});
 }
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid existing user email address.'});
 const user=await db.query('SELECT id,email FROM users WHERE lower(email)=lower($1)',[email]);
 if(!user.rows.length)return res.status(404).json({error:'This person must create a Student Portal account first, then you can assign teacher access.'});
 const userId=user.rows[0].id;
 if(req.method==='DELETE'){
  await db.query('DELETE FROM teacher_roles WHERE user_id=$1',[userId]);
  return res.json({ok:true,revoked:true});
 }
 const ids=Array.isArray(req.body?.course_ids)?[...new Set(req.body.course_ids.map(String))]:[];
 if(!ids.length)return res.status(400).json({error:'Choose at least one course to assign.'});
 const valid=await db.query('SELECT id FROM courses WHERE active=true AND id=ANY($1::uuid[])',[ids]);
 if(valid.rows.length!==ids.length)return res.status(400).json({error:'One or more selected courses are invalid or inactive.'});
 await db.query("INSERT INTO teacher_roles(user_id,active,created_by) VALUES($1,true,$2) ON CONFLICT(user_id) DO UPDATE SET active=true",[userId,String(req.member?.handle||'admin')]);
 await db.query('DELETE FROM teacher_course_assignments WHERE teacher_id=$1',[userId]);
 for(const id of ids) await db.query('INSERT INTO teacher_course_assignments(teacher_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,id]);
 return res.status(201).json({ok:true,teacher:{email:user.rows[0].email,courses:valid.rows.length}});
}