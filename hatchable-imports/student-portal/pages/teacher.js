import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function(req,res){
  const role=await db.query('SELECT user_id FROM teacher_roles WHERE user_id=$1 AND active=true',[String(req.user.id)]);
  if(!role.rows.length){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');return res.status(403).send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teacher access required</title><body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:24px"><h1>Teacher access required</h1><p>This account has not been assigned a teacher role by YSCMT Enterprise.</p><p><a href="/login">Sign in with another account</a> · <a href="/">Student Portal</a></p></body></html>');}
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  return res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Teacher Dashboard · YSCMT</title><link rel="stylesheet" href="/theme.css"><style>
  .teach-wrap{max-width:1120px;margin:auto;padding:22px 18px 60px}.teach-hero{background:linear-gradient(135deg,#102b46,#176b66);color:#fff;padding:28px;border-radius:20px;margin:18px 0}.teach-hero p{color:#dcebe9}.teach-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.teach-card{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:15px;padding:18px;margin-bottom:16px}.teach-card label{display:block;font-weight:650;margin:12px 0 5px}.teach-card input,.teach-card select,.teach-card textarea{width:100%;padding:10px;border:1px solid var(--border,#cbd5e1);border-radius:9px;background:var(--surface,#fff);color:inherit}.teach-btn{border:0;border-radius:9px;padding:10px 14px;background:#176b66;color:#fff;font-weight:700;cursor:pointer}.teach-btn.alt{background:transparent;color:inherit;border:1px solid var(--border,#cbd5e1)}.teach-muted{opacity:.7}.teach-item{padding:12px 0;border-top:1px solid var(--border,#e5e7eb)}.teach-tag{font-size:12px;padding:4px 8px;border-radius:99px;background:#eaf5f1;color:#176b55}.teach-msg{min-height:20px;font-size:13px}.teach-small{font-size:13px}.teach-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  </style></head><body><main class="teach-wrap">
  <header class="teach-top"><strong>YSCMT ENTERPRISE <span class="teach-muted">/ TEACHER CENTRE</span></strong><nav><a href="/">Student Portal</a> · <a href="/classroom.html">Student Classroom</a> · <a href="/office.html">LibreOffice Workspace</a></nav></header>
  <section class="teach-hero"><div style="font-size:11px;letter-spacing:.18em;font-weight:800">LEARN. BUILD. INNOVATE.</div><h1 style="font-size:clamp(30px,5vw,44px);margin:10px 0">Teacher Dashboard</h1><p>Schedule live lessons, publish class announcements, review attendance and answer student questions.</p><span class="teach-tag">Administrator / instructor access</span></section>
  <section class="teach-grid">
   <form id="sessionForm" class="teach-card"><h2>Schedule a live class</h2><p class="teach-muted teach-small">A free Jitsi meeting room is generated for each class. You can also paste an existing Google Meet or Zoom link.</p>
    <label for="sessionCourse">Course</label><select id="sessionCourse" required><option value="">Loading courses…</option></select>
    <label for="sessionTitle">Class title</label><input id="sessionTitle" maxlength="180" required placeholder="e.g. Python live practical lesson">
    <label for="sessionDescription">Class description</label><textarea id="sessionDescription" rows="3" maxlength="3000" placeholder="Topics and what students should prepare"></textarea>
    <label for="sessionStart">Start date and time (your device's local time)</label><input id="sessionStart" type="datetime-local" required>
    <label for="sessionEnd">End date and time</label><input id="sessionEnd" type="datetime-local" required>
    <label for="meetingLink">Meeting link (optional)</label><input id="meetingLink" type="url" placeholder="Leave blank to generate a free Jitsi room">
    <button class="teach-btn" type="submit" style="margin-top:15px">Publish class schedule</button><p id="sessionMsg" class="teach-msg" role="status"></p>
   </form>
   <form id="announcementForm" class="teach-card"><h2>Publish announcement</h2><p class="teach-muted teach-small">Send information to students enrolled in one of your assigned courses.</p>
    <label for="announcementCourse">Assigned course</label><select id="announcementCourse"><option value="">All approved students</option></select>
    <label for="announcementTitle">Announcement title</label><input id="announcementTitle" maxlength="180" required placeholder="e.g. Class materials uploaded">
    <label for="announcementBody">Message</label><textarea id="announcementBody" rows="6" maxlength="5000" required placeholder="Write your announcement…"></textarea>
    <button class="teach-btn" type="submit" style="margin-top:15px">Publish announcement</button><p id="announcementMsg" class="teach-msg" role="status"></p>
   </form>
  </section>
  <section class="teach-card"><div class="teach-top"><div><h2>Class schedule and attendance</h2><p class="teach-muted teach-small">Attendance is recorded when an approved student clicks Join Class.</p></div><button class="teach-btn alt" id="refreshAll" type="button">Refresh</button></div><div id="sessionList">Loading classes…</div></section>
  <section class="teach-card"><h2>Recent announcements</h2><div id="announcementList">Loading announcements…</div></section>
  <section class="teach-card"><h2>Student questions and class discussion</h2><p class="teach-muted teach-small">Student identity is not displayed here; messages are shown by course and role.</p><div id="messageList">Loading messages…</div></section>
  <footer class="teach-muted teach-small" style="text-align:center;padding:20px">YSCMT Enterprise · Teacher Centre</footer>
  </main><script src="/teacher.js" defer></script></body></html>`);
}