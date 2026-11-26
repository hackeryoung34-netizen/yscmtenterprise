(function(){
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(path,options={})=>{const r=await fetch('/api/'+path,{headers:{'Content-Type':'application/json'},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;};
 let courses=[];
 function msg(id,text,error=false){$(id).textContent=text;$(id).style.color=error?'#a52a2a':'';}
 function date(v){try{return new Date(v).toLocaleString();}catch{return v;}}
 async function loadCourses(){
  const d=await api('teacher/classroom');courses=d.courses||[];
  const opts='<option value="">Choose a course</option>'+courses.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('');
  $('sessionCourse').innerHTML=opts;$('announcementCourse').innerHTML='<option value="">Choose an assigned course</option>'+courses.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('');
 }
 async function refresh(){
  const d=await api('teacher/classroom');
  $('sessionList').innerHTML=(d.sessions||[]).length?d.sessions.map(s=>'<article class="teach-item"><div class="teach-top"><div><strong>'+esc(s.title)+'</strong><div class="teach-muted teach-small">'+esc(s.course_title)+' · '+date(s.starts_at)+' – '+date(s.ends_at)+'</div><div class="teach-small">Attendance: <strong>'+Number(s.attendance_count||0)+'</strong> · Status: '+esc(s.status)+'</div></div><div><a href="'+esc(s.meeting_url)+'" target="_blank" rel="noopener noreferrer">Open meeting ↗</a></div></div><div class="teach-top" style="margin-top:8px"><span class="teach-muted teach-small">'+esc(s.description||'')+'</span><select aria-label="Update class status" data-session="'+esc(s.id)+'" class="session-status" style="max-width:170px;padding:7px;border:1px solid #bbb;border-radius:8px"><option '+(s.status==='scheduled'?'selected':'')+' value="scheduled">Scheduled</option><option '+(s.status==='live'?'selected':'')+' value="live">Live now</option><option '+(s.status==='completed'?'selected':'')+' value="completed">Completed</option><option '+(s.status==='cancelled'?'selected':'')+' value="cancelled">Cancelled</option></select></div></article>').join(''):'<p class="teach-muted">No classes scheduled yet.</p>';
  document.querySelectorAll('.session-status').forEach(el=>el.addEventListener('change',async()=>{try{await api('teacher/classroom',{method:'PATCH',body:JSON.stringify({session_id:el.dataset.session,status:el.value})});await refresh();}catch(e){alert(e.message);}}));
  $('announcementList').innerHTML=(d.announcements||[]).length?d.announcements.map(a=>'<article class="teach-item"><strong>'+esc(a.title)+'</strong><div class="teach-muted teach-small">'+esc(a.course_title||'All courses')+' · '+date(a.created_at)+'</div><p>'+esc(a.body)+'</p></article>').join(''):'<p class="teach-muted">No announcements yet.</p>';
  $('messageList').innerHTML=(d.messages||[]).length?d.messages.map(m=>'<article class="teach-item"><div class="teach-top"><strong>'+esc(m.course_title)+' · '+esc(m.author_role)+'</strong><span class="teach-muted teach-small">'+date(m.created_at)+'</span></div><p>'+esc(m.message)+'</p>'+(m.author_role==='student'?'<form class="reply-form" data-course="'+esc(m.course_id)+'"><textarea rows="2" maxlength="3000" required placeholder="Reply to this course discussion"></textarea><button class="teach-btn alt" type="submit">Reply as teacher</button></form>':'')+'</article>').join(''):'<p class="teach-muted">No questions yet.</p>';
  document.querySelectorAll('.reply-form').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const field=f.querySelector('textarea');try{await api('teacher/classroom',{method:'POST',body:JSON.stringify({action:'reply',course_id:f.dataset.course,message:field.value})});await refresh();}catch(err){alert(err.message);}}));
 }
 $('sessionForm').addEventListener('submit',async e=>{
  e.preventDefault();msg('sessionMsg','Publishing class…');
  try{
   const start=new Date($('sessionStart').value),end=new Date($('sessionEnd').value);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error('End time must be after start time.');
   let link=$('meetingLink').value.trim();
   if(!link){const room='YSCMTClass-'+crypto.randomUUID();link='https://meet.jit.si/'+room;}
   if(!/^https:\/\//i.test(link))throw new Error('Meeting link must start with https://');
   const d=await api('teacher/classroom',{method:'POST',body:JSON.stringify({action:'create_session',course_id:$('sessionCourse').value,title:$('sessionTitle').value,description:$('sessionDescription').value,meeting_url:link,starts_at:start.toISOString(),ends_at:end.toISOString()})});
   msg('sessionMsg','Class published. Meeting link: '+d.session.meeting_url);
   $('sessionForm').reset();await refresh();
  }catch(err){msg('sessionMsg',err.message,true);}
 });
 $('announcementForm').addEventListener('submit',async e=>{
  e.preventDefault();msg('announcementMsg','Publishing announcement…');
  try{await api('teacher/classroom',{method:'POST',body:JSON.stringify({action:'create_announcement',course_id:$('announcementCourse').value||null,title:$('announcementTitle').value,body:$('announcementBody').value})});msg('announcementMsg','Announcement published.');$('announcementForm').reset();await refresh();}
  catch(err){msg('announcementMsg',err.message,true);}
 });
 $('refreshAll').addEventListener('click',()=>refresh().catch(e=>alert(e.message)));
 (async()=>{try{await loadCourses();await refresh();}catch(e){document.body.insertAdjacentHTML('afterbegin','<p style="padding:16px;color:#a52a2a">Teacher data could not load: '+esc(e.message)+'</p>');}})();
})();