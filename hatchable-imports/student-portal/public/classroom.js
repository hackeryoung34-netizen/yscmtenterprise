(function () {
  const $ = (id) => document.getElementById(id);
  const auth = window.hatchable && window.hatchable.auth;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const api = (path, options={}) => fetch('/api/' + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const studyGuides = {
    'computer fundamentals': '/materials/computer-fundamentals-study-guide.pdf',
    'cybersecurity fundamentals': '/materials/cybersecurity-fundamentals-study-guide.pdf',
    'python programming': '/materials/python-programming-study-guide.pdf',
    'web development': '/materials/web-development-study-guide.pdf'
  };
  let myCourses = [];

  function showMessage(message, isError) {
    $('classroomMessage').hidden = false;
    $('classroomMessage').innerHTML = '<p class="' + (isError ? 'classroom-error' : 'classroom-muted') + '">' + escapeHtml(message) + '</p>';
  }
  function formatDate(value) {
    try { return new Date(value).toLocaleString(); } catch { return String(value || ''); }
  }
  function renderCourse(enrolment, lessons) {
    const title = enrolment.title || 'Your course';
    const guide = studyGuides[String(title).toLowerCase()];
    const lessonMarkup = lessons.length ? lessons.map((lesson, index) => {
      const safeUrl = /^https:\/\//i.test(String(lesson.video_url || '')) ? String(lesson.video_url) : '';
      return '<article class="lesson-row"><div class="classroom-small classroom-muted">LESSON ' + (index + 1) + (lesson.completed ? ' · COMPLETED' : '') + '</div><h3 style="margin:5px 0">' + escapeHtml(lesson.title) + '</h3>' +
        (lesson.content ? '<div class="lesson-content">' + escapeHtml(lesson.content) + '</div>' : '<p class="classroom-muted classroom-small">No written notes have been added to this lesson yet.</p>') +
        (safeUrl ? '<a class="classroom-btn secondary classroom-small" href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">Open lesson video ↗</a>' : '') + '</article>';
    }).join('') : '<div class="classroom-empty classroom-small">Your instructor has not published lessons for this course yet.</div>';
    return '<article class="course-card"><span class="classroom-status">' + escapeHtml(enrolment.status) + '</span><h3 style="margin:12px 0 5px">' + escapeHtml(title) + '</h3><p class="classroom-muted classroom-small">Online course materials and lessons</p>' +
      (guide ? '<p><a href="' + guide + '" target="_blank" rel="noopener">Download course study guide ↗</a></p>' : '') +
      '<div><strong>' + lessons.length + '</strong> published lesson(s)</div>' + lessonMarkup + '</article>';
  }
  async function loadCommunity(){
    const r=await api('student/classroom');
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Classroom schedule could not load.');
    const sessions=d.sessions||[], announcements=d.announcements||[], messages=d.messages||[];
    $('classroomApp').insertAdjacentHTML('beforeend',
      '<section class="classroom-panel"><div class="classroom-kicker">SCHOOL NOTICES</div><h2>Announcements</h2><div id="studentAnnouncements"></div></section>'+
      '<section class="classroom-panel"><div class="classroom-kicker">STUDENT COMMUNITY</div><h2>Class discussion and questions</h2><form id="studentMessageForm"><label for="discussionCourse">Course</label><select id="discussionCourse" required></select><label for="discussionMessage">Your question or message</label><textarea id="discussionMessage" rows="3" maxlength="3000" required placeholder="Ask your instructor or discuss the lesson…"></textarea><button class="classroom-btn" type="submit">Send message</button><p id="discussionStatus" class="classroom-small" role="status"></p></form><div id="studentMessages" style="margin-top:16px"></div></section>'
    );
    $('studentSessions').innerHTML=sessions.length?sessions.map(s=>'<article class="lesson-row"><span class="classroom-status">'+escapeHtml(s.status)+'</span><h3>'+escapeHtml(s.title)+'</h3><p class="classroom-muted classroom-small">'+escapeHtml(s.course_title)+' · '+formatDate(s.starts_at)+' – '+formatDate(s.ends_at)+'</p><p>'+escapeHtml(s.description||'')+'</p><button class="classroom-btn" data-join="'+escapeHtml(s.id)+'" '+(['completed','cancelled'].includes(s.status)?'disabled':'')+'>'+(s.attended?'Join class again':'Join class & record attendance')+'</button>'+(s.attended?'<span class="classroom-small classroom-muted"> · Attendance recorded</span>':'')+'</article>').join(''):'<div class="classroom-empty">No live classes have been scheduled for your approved courses yet.</div>';
    $('studentAnnouncements').innerHTML=announcements.length?announcements.map(a=>'<article class="lesson-row"><h3>'+escapeHtml(a.title)+'</h3><p class="classroom-muted classroom-small">'+escapeHtml(a.course_title||'All courses')+' · '+formatDate(a.created_at)+'</p><div class="lesson-content">'+escapeHtml(a.body)+'</div></article>').join(''):'<p class="classroom-muted">There are no new announcements.</p>';
    $('discussionCourse').innerHTML=myCourses.map(c=>'<option value="'+escapeHtml(c.course_id)+'">'+escapeHtml(c.title)+'</option>').join('');
    $('studentMessages').innerHTML=messages.length?messages.map(m=>'<article class="lesson-row"><strong>'+(m.author_role==='teacher'?'Instructor':'Student')+'</strong><span class="classroom-muted classroom-small"> · '+formatDate(m.created_at)+'</span><div class="lesson-content">'+escapeHtml(m.message)+'</div></article>').join(''):'<p class="classroom-muted">No discussion messages yet. You can start the conversation.</p>';
    document.querySelectorAll('[data-join]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;button.textContent='Connecting…';
      try{const jr=await api('student/classroom',{method:'POST',body:JSON.stringify({action:'join',session_id:button.dataset.join})});const jd=await jr.json().catch(()=>({}));if(!jr.ok)throw new Error(jd.error||'Could not join this class.');window.location.href=jd.meeting_url;}
      catch(e){button.disabled=false;button.textContent='Try joining again';alert(e.message);}
    }));
    $('studentMessageForm').addEventListener('submit',async e=>{
      e.preventDefault();const status=$('discussionStatus');status.textContent='Sending…';
      try{const mr=await api('student/classroom',{method:'POST',body:JSON.stringify({action:'message',course_id:$('discussionCourse').value,message:$('discussionMessage').value})});const md=await mr.json().catch(()=>({}));if(!mr.ok)throw new Error(md.error||'Message could not be sent.');$('discussionMessage').value='';status.textContent='Your message has been sent.';await loadCommunityRefresh();}
      catch(err){status.textContent=err.message;}
    });
  }
  async function loadCommunityRefresh(){
    const r=await api('student/classroom');const d=await r.json().catch(()=>({}));if(!r.ok)return;
    $('studentMessages').innerHTML=(d.messages||[]).map(m=>'<article class="lesson-row"><strong>'+(m.author_role==='teacher'?'Instructor':'Student')+'</strong><span class="classroom-muted classroom-small"> · '+formatDate(m.created_at)+'</span><div class="lesson-content">'+escapeHtml(m.message)+'</div></article>').join('')||'<p class="classroom-muted">No discussion messages yet.</p>';
  }
  async function init() {
    if (!auth || typeof auth.getSession !== 'function') {
      showMessage('Student sign-in could not be checked. Please open the Student Portal and sign in first.', true); return;
    }
    try {
      const session = await auth.getSession();
      if (!session || !session.user) {
        $('loginNotice').hidden = false;
        showMessage('You are not signed in. Sign in with your existing student account to view your courses.'); return;
      }
      $('classroomMessage').hidden = true;$('classroomApp').hidden = false;
      const response = await api('student/enrolments');const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load your enrolments.');
      myCourses = (data.enrolments || []).filter(item => ['approved','completed'].includes(String(item.status).toLowerCase()));
      if (!myCourses.length) {
        $('courseList').innerHTML = '<div class="classroom-empty">You do not have an approved course enrolment yet. Once your enrolment is approved, your online course will appear here.</div>';return;
      }
      const cards = await Promise.all(myCourses.map(async enrolment => {
        try {const lr=await api('student/lessons?course_id='+encodeURIComponent(enrolment.course_id));const ld=await lr.json().catch(()=>({}));if(!lr.ok)throw new Error(ld.error||'Lessons are temporarily unavailable.');return renderCourse(enrolment,ld.lessons||[]);}
        catch(error){return '<article class="course-card"><h3>'+escapeHtml(enrolment.title||'Your course')+'</h3><p class="classroom-error">'+escapeHtml(error.message)+'</p></article>';}
      }));
      $('courseList').innerHTML=cards.join('');
      await loadCommunity();
    } catch (error) {showMessage(error.message || 'The classroom is temporarily unavailable. Please try again.', true);}
  }
  init();
})();