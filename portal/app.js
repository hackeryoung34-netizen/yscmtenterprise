import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://wzpkfjnymsxczbkiukrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_arn5yfsit9GDc_T7Z_U1EQ_3GCTKbZH";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const app = document.querySelector("#app");
document.querySelector("#year").textContent = new Date().getFullYear();
const REGISTRATION_ENABLED = false; // Enable only after Auth and data migration are verified.
let activeSession = null;
let selectedCourse = null;

const esc = (value = "") => String(value).replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const money = (amount, currency = "NGN") => {
  if (amount === null || amount === undefined || amount === "") return "Free";
  try { return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(amount)); }
  catch { return esc(amount) + " " + esc(currency); }
};
const showMessage = (message, type = "error") => {
  const box = document.querySelector("#message");
  if (box) { box.className = type; box.textContent = message; }
};

function renderAuth(mode = "signin") {
  const signup = mode === "signup";
  app.innerHTML = `
    <section class="auth-layout">
      <div class="welcome">
        <span class="eyebrow">YSCMT STUDENT PORTAL</span>
        <h1>Learn. Build.<br><span>Innovate.</span></h1>
        <p>Your learning journey, courses and progress in one secure place. Sign in to continue building practical skills with YSCMT Enterprise.</p>
        <div class="welcome-points">
          <span>Structured learning</span><span>Practical projects</span>
          <span>Track your progress</span><span>Learn at your pace</span>
        </div>
      </div>
      <div class="auth-side">
        <span class="eyebrow">STUDENT ACCESS</span>
        <h2>${signup ? "Create your account" : "Welcome back"}</h2>
        <p class="sub">${signup ? "Register with your email to begin your YSCMT learning journey." : "Enter your account details to open your student dashboard."}</p>
        <div id="message" aria-live="polite"></div>
        <form id="auth-form">
          <div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required placeholder="At least 8 characters"></div>
          <button class="btn" id="submit" type="submit">${signup ? "Create student account" : "Sign in securely"}</button>
        </form>
        <a class="text-btn" href="/portal/admin">Administrator access</a>
        <button class="text-btn" id="switch-mode" type="button">${signup ? "Already registered? Sign in" : "New student? Create an account"}</button>
        <div class="notice">Portal migration preview: course data and existing student accounts have not yet been imported. Please do not create a real account until registration is officially opened.</div>
      </div>
    </section>`;
  const switchButton = document.querySelector("#switch-mode");
  if (!REGISTRATION_ENABLED) {
    switchButton.disabled = true;
    switchButton.textContent = "New student registration opens after migration validation";
  } else {
    switchButton.addEventListener("click", () => renderAuth(signup ? "signin" : "signup"));
  }
  document.querySelector("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const button = document.querySelector("#submit");
    button.disabled = true; button.textContent = "Please wait…";
    try {
      if (signup && !REGISTRATION_ENABLED) {
        throw new Error("New student registration is temporarily closed while the migration is validated.");
      }
      if (signup) {
        const {data,error} = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/portal/" }
        });
        if (error) throw error;
        showMessage(data.session ? "Account created. Opening your portal…" : "Registration request received. Check your email to confirm the account. Registration remains in preview; please do not use a real account yet.", "success");
      } else {
        const {error} = await supabase.auth.signInWithPassword({email,password});
        if (error) throw error;
      }
    } catch (error) {
      showMessage(error?.message || "We could not complete that request. Please try again.");
      button.disabled = false; button.textContent = signup ? "Create student account" : "Sign in securely";
    }
  });
}

async function loadIdentity() {
  const {data,error} = await supabase.rpc("portal_get_my_identity");
  if (error) return null;
  return Array.isArray(data) ? data[0] || null : data;
}

async function loadCourses() {
  const {data,error} = await supabase.rpc("portal_list_courses");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function renderAccessDenied() {
  app.innerHTML = '<section class="panel" style="max-width:620px;margin:60px auto;text-align:center;padding:38px"><span class="eyebrow">YSCMT ADMINISTRATION</span><h1 style="color:var(--navy)">Access restricted</h1><p class="muted">This account does not have a verified administrator role. Admin access is controlled by the private role registry, not profile metadata.</p><a class="btn" style="display:grid;place-items:center" href="/portal/">Return to student portal</a></section>';
}

function renderAdminPreview(identity) {
  app.innerHTML = '<header class="dashboard-head"><div><span class="eyebrow">YSCMT OWNER CONTROL CENTRE</span><h1>Administrator workspace</h1><p id="admin-name"></p></div><button class="small-btn" id="signout">Sign out</button></header><section class="grid"><article class="panel"><div class="stat">Protected</div><div class="muted">Trusted admin role verified</div></article><article class="panel"><div class="stat">Pending</div><div class="muted">Admin API migration</div></article><article class="panel"><div class="stat">Legacy</div><div class="muted">Existing admin portal remains unchanged</div></article></section><div class="section-title"><h2>Administration modules</h2><span class="muted">Preview only</span></div><div class="grid"><article class="panel"><strong>Students</strong><p class="muted">Student records and access controls</p></article><article class="panel"><strong>Courses &amp; lessons</strong><p class="muted">Learning programme management</p></article><article class="panel"><strong>Enrolments</strong><p class="muted">Review and approve requests</p></article><article class="panel"><strong>Payments</strong><p class="muted">Payment reconciliation and receipts</p></article><article class="panel"><strong>Exams &amp; results</strong><p class="muted">Assessments and results</p></article><article class="panel"><strong>Certificates</strong><p class="muted">Eligibility and issuance</p></article></div><div class="notice">Admin data APIs and audit workflows are not yet enabled. No administrative action can be performed from this preview. Continue using the existing admin portal until migration approval and testing.</div><p><a class="text-btn" href="/portal/">Open student portal</a></p>';
  document.querySelector('#admin-name').textContent = 'Verified administrator: ' + (identity.full_name || activeSession?.user?.email || 'Admin');
  document.querySelector('#signout').addEventListener('click', async () => { await supabase.auth.signOut(); });
}

function renderDashboard(identity, courses = [], courseError = false) {
  const displayName = identity?.full_name || activeSession?.user?.email || "Student";
  app.innerHTML = `
    <header class="dashboard-head">
      <div><span class="eyebrow">STUDENT LEARNING SPACE</span><h1>Welcome, ${esc(displayName)}</h1><p>Your YSCMT learning dashboard.</p></div>
      <button class="small-btn" id="signout">Sign out</button>
    </header>
    <section class="grid">
      <article class="panel"><div class="stat">${courses.length}</div><div class="muted">Available courses</div></article>
      <article class="panel"><div class="stat">${esc(identity?.role || "Student")}</div><div class="muted">Portal role</div></article>
      <article class="panel"><div class="stat">Active</div><div class="muted">Account session</div></article>
    </section>
    <div class="section-title"><h2>Course catalogue</h2><span class="muted">YSCMT Enterprise</span></div>
    <div id="course-area"></div>
    <div id="course-detail"></div>
    <div class="notice">This is a migration preview. Existing Hatchable student records, payment history and certificates have not been imported. The old portal remains unchanged.</div>
  `;
  document.querySelector("#signout").addEventListener("click", async () => { await supabase.auth.signOut(); });
  const area = document.querySelector("#course-area");
  if (courseError) {
    area.innerHTML = '<div class="empty">The secure course service is being prepared. Your account session is connected, but course access will open after the remaining database functions are activated.</div>';
  } else if (!courses.length) {
    area.innerHTML = '<div class="empty">No courses are available yet. Please check again when the portal migration is complete.</div>';
  } else {
    area.innerHTML = '<div class="course-grid">' + courses.map(course => `
      <article class="course">
        <span class="pill">${esc(course.level || "Course")}</span>
        <h3>${esc(course.title || "Untitled course")}</h3>
        <p>${esc(course.description || "Explore this learning programme.")}</p>
        <p><strong>${money(course.fee_amount, course.fee_currency)}</strong></p>
        <p class="muted">Enrolment: ${esc(course.enrollment_status || "Not enrolled")}</p>
        <button class="btn" data-course="${esc(course.id)}">View course</button>
      </article>`).join("") + "</div>";
    area.querySelectorAll("[data-course]").forEach(button => button.addEventListener("click", () => openCourse(button.dataset.course)));
  }
}

async function openCourse(courseId) {
  const detail = document.querySelector("#course-detail");
  detail.innerHTML = '<div class="empty">Loading course details…</div>';
  const {data,error} = await supabase.rpc("portal_get_course_detail",{p_course_id:courseId});
  if (error || !Array.isArray(data) || !data[0]) {
    detail.innerHTML = '<div class="empty">Course details are not available yet.</div>'; return;
  }
  selectedCourse = data[0];
  const course = selectedCourse;
  detail.innerHTML = `
    <div class="section-title"><h2>${esc(course.title || "Course details")}</h2><button class="small-btn" id="close-course">Close</button></div>
    <article class="panel">
      <span class="pill">${esc(course.level || "Course")}</span>
      <p>${esc(course.description || "")}</p>
      <p><strong>Fee: ${money(course.fee_amount,course.fee_currency)}</strong></p>
      <button class="btn" id="enrol-course">Request enrolment</button>
      <div id="course-message"></div>
    </article>
    <div class="section-title"><h2>Lessons</h2></div>
    <div id="lessons" class="lesson-list"><div class="empty">Checking your lesson access…</div></div>`;
  document.querySelector("#close-course").addEventListener("click",()=>{detail.innerHTML="";});
  document.querySelector("#enrol-course").addEventListener("click",async()=>{
    const button=document.querySelector("#enrol-course");button.disabled=true;button.textContent="Submitting…";
    const result=await supabase.rpc("portal_create_enrollment",{p_course_id:courseId});
    const message=document.querySelector("#course-message");
    if(result.error){message.className="error";message.textContent="Enrolment is not open yet. Please try again later.";}
    else{message.className="success";message.textContent="Your enrolment request has been submitted and is awaiting approval.";}
    button.disabled=false;button.textContent="Request enrolment";
  });
  const lessons=await supabase.rpc("portal_get_course_lessons",{p_course_id:courseId});
  const lessonBox=document.querySelector("#lessons");
  if(lessons.error){lessonBox.innerHTML='<div class="empty">Lessons will appear after your enrolment is approved.</div>';return;}
  const rows=Array.isArray(lessons.data)?lessons.data:[];
  lessonBox.innerHTML=rows.length?rows.map((lesson,i)=>`<article class="lesson"><strong>${i+1}. ${esc(lesson.title || "Lesson")}</strong><p>${esc(lesson.content || "Learning material")}</p></article>`).join(""):'<div class="empty">No lessons are available for this course yet.</div>';
}

async function syncSession(session) {
  activeSession=session;
  const adminPath = window.location.pathname.replace(/\\/+$/, "") === "/portal/admin";
  if(!session){renderAuth("signin");return;}
  const identity=await loadIdentity();
  if(adminPath){
    if(!identity){app.innerHTML='<div class="empty">Administrator identity verification is unavailable. Access remains closed until the secure role service is enabled.</div>';return;}
    if(identity.role !== "admin"){renderAccessDenied();return;}
    renderAdminPreview(identity);return;
  }
  let courses=[],courseError=false;
  try{courses=await loadCourses();}catch{courseError=true;}
  renderDashboard(identity || {role:"Student"},courses,courseError);
}

supabase.auth.onAuthStateChange((_event,session)=>{activeSession=session;queueMicrotask(()=>syncSession(session));});
const {data:{session},error}=await supabase.auth.getSession();
if(error)renderAuth("signin");else await syncSession(session);
