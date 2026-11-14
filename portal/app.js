import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://wzpkfjnymsxczbkiukrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_arn5yfsit9GDc_T7Z_U1EQ_3GCTKbZH";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const app = document.querySelector("#app");
document.querySelector("#year").textContent = new Date().getFullYear();
const REGISTRATION_ENABLED = false; // Enable only after Auth and data migration are verified.
const PAYMENTS_ENABLED = false; // Enable only after migration 010 and Paystack test verification.
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
  const hasEnrollment = Boolean(course.enrollment_status);
  detail.innerHTML = `
    <div class="section-title"><h2>${esc(course.title || "Course details")}</h2><button class="small-btn" id="close-course">Close</button></div>
    <article class="panel">
      <span class="pill">${esc(course.level || "Course")}</span>
      <p>${esc(course.description || "")}</p>
      <p><strong>Fee: ${money(course.fee_amount,course.fee_currency)}</strong></p>
      ${hasEnrollment ? `<div class="notice">Enrolment status: ${esc(course.enrollment_status)}</div>` : '<button class="btn" id="enrol-course">Request enrolment</button>'}
      ${course.enrollment_status === "pending" && Number(course.fee_amount) > 0 ? `<button class="small-btn" id="pay-course" ${PAYMENTS_ENABLED ? "" : "disabled"}>Pay online with Paystack${PAYMENTS_ENABLED ? "" : " (preview only)"}</button><p class="muted">Online payments remain disabled until the secure Paystack function is deployed and tested.</p>` : ""}
      <div id="course-message"></div>
    </article>
    <div class="section-title"><h2>Lessons</h2></div>
    <div id="lessons" class="lesson-list"><div class="empty">Checking your lesson access…</div></div>
    <div id="course-progress"></div>
    <div id="exam-area"></div>`;
  document.querySelector("#close-course").addEventListener("click",()=>{detail.innerHTML="";});
  const payButton = document.querySelector("#pay-course");
  if(payButton && PAYMENTS_ENABLED) payButton.addEventListener("click",()=>initializeCoursePayment(courseId));
  const enrolButton = document.querySelector("#enrol-course");
  if(enrolButton) enrolButton.addEventListener("click",async()=>{
    enrolButton.disabled=true;enrolButton.textContent="Submitting…";
    const result=await supabase.rpc("portal_create_enrollment",{p_course_id:courseId});
    const message=document.querySelector("#course-message");
    if(result.error){message.className="error";message.textContent="Enrolment is not open yet. Please try again later.";}
    else{message.className="success";message.textContent="Your enrolment request has been submitted and is awaiting approval.";}
    enrolButton.disabled=false;enrolButton.textContent="Request enrolment";
  });
  const lessons=await supabase.rpc("portal_get_course_lessons",{p_course_id:courseId});
  const lessonBox=document.querySelector("#lessons");
  if(lessons.error){lessonBox.innerHTML='<div class="empty">Lessons will appear after your enrolment is approved.</div>';return;}
  const rows=Array.isArray(lessons.data)?lessons.data:[];
  lessonBox.innerHTML=rows.length?rows.map((lesson,i)=>`<article class="lesson"><strong>${i+1}. ${esc(lesson.title || "Lesson")}</strong><p>${esc(lesson.content || "Learning material")}</p>${lesson.completed_at ? '<span class="pill">Completed</span>' : `<button class="small-btn" data-complete-lesson="${esc(lesson.id)}">Mark complete</button>`}</article>`).join(""):'<div class="empty">No lessons are available for this course yet.</div>';
  lessonBox.querySelectorAll("[data-complete-lesson]").forEach(button=>button.addEventListener("click",async()=>{
    button.disabled=true;button.textContent="Saving…";
    const result=await supabase.rpc("portal_mark_lesson_complete",{p_lesson_id:button.dataset.completeLesson});
    if(result.error){button.disabled=false;button.textContent="Try again";return;}
    await openCourse(courseId);
  }));
  const progress=await supabase.rpc("portal_get_my_course_progress",{p_course_id:courseId});
  if(!progress.error && Array.isArray(progress.data) && progress.data[0]){
    const p=progress.data[0];
    document.querySelector("#course-progress").innerHTML=`<div class="panel" style="margin-top:16px"><strong>Course progress: ${Number(p.progress_percent)||0}%</strong><p class="muted">${Number(p.completed_lessons)||0} of ${Number(p.total_lessons)||0} lessons completed</p><div style="height:9px;background:#e5edf3;border-radius:10px;overflow:hidden"><div style="height:100%;width:${Math.max(0,Math.min(100,Number(p.progress_percent)||0))}%;background:var(--blue)"></div></div></div>`;
  }
  await loadCourseExams(courseId);
}

let examTimer = null;

async function loadCourseExams(courseId) {
  const area = document.querySelector("#exam-area");
  const result = await supabase.rpc("portal_list_course_exams", {p_course_id: courseId});
  if (result.error) {
    area.innerHTML = '<div class="section-title"><h2>Course exams</h2></div><div class="empty">Exams will appear after the secure exam service is activated and your enrolment is approved.</div>';
    return;
  }
  const exams = Array.isArray(result.data) ? result.data : [];
  if (!exams.length) {
    area.innerHTML = '<div class="section-title"><h2>Course exams</h2></div><div class="empty">No active exams are available for this course yet.</div>';
    return;
  }
  area.innerHTML = '<div class="section-title"><h2>Course exams</h2></div><div class="course-grid">' +
    exams.map(exam => '<article class="course"><span class="pill">Assessment</span><h3>' + esc(exam.title || "Course exam") +
    '</h3><p>' + esc(exam.instructions || "Complete this assessment to check your learning.") +
    '</p><p class="muted">Time: ' + Number(exam.duration_minutes || 0) + ' minutes · Pass mark: ' +
    Number(exam.pass_mark || 0) + '%</p><button class="btn" data-start-exam="' + esc(exam.id) + '">Start exam</button></article>').join("") +
    '</div>';
  area.querySelectorAll("[data-start-exam]").forEach(button => button.addEventListener("click", () => startCourseExam(button.dataset.startExam)));
}

async function startCourseExam(examId) {
  const area = document.querySelector("#exam-area");
  area.innerHTML = '<div class="empty">Starting your secure exam session…</div>';
  const started = await supabase.rpc("portal_start_exam", {p_exam_id: examId});
  const session = Array.isArray(started.data) ? started.data[0] : started.data;
  if (started.error || !session) {
    area.innerHTML = '<div class="error">The exam could not be started. Confirm that your enrolment is approved and try again.</div>';
    return;
  }
  const questionResult = await supabase.rpc("portal_get_exam_questions", {p_session_id: session.session_id});
  const questions = Array.isArray(questionResult.data) ? questionResult.data : [];
  if (questionResult.error || !questions.length) {
    area.innerHTML = '<div class="error">Exam questions are not available for this session.</div>';
    return;
  }
  renderTimedExam(session, questions);
}

function renderTimedExam(session, questions) {
  const area = document.querySelector("#exam-area");
  const expiresAt = new Date(session.expires_at).getTime();
  const questionMarkup = questions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options : [];
    return '<article class="panel" style="margin:12px 0"><strong>' + (index + 1) + '. ' +
      esc(question.question_text || "Question") + '</strong><div class="field">' +
      options.map((option, optionIndex) => '<label><input type="radio" required name="q_' +
        esc(question.id) + '" value="' + optionIndex + '"> ' + esc(option) + '</label>').join("") +
      '</div></article>';
  }).join("");
  area.innerHTML = '<div class="section-title"><h2>Timed examination</h2><span id="exam-countdown" class="pill">Time remaining</span></div>' +
    '<form id="exam-form">' + questionMarkup +
    '<button class="btn" id="submit-exam" type="submit">Submit answers</button><div id="exam-result"></div></form>';
  if (examTimer) clearInterval(examTimer);
  const updateCountdown = () => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const timer = document.querySelector("#exam-countdown");
    if (timer) timer.textContent = minutes + ":" + String(seconds).padStart(2, "0") + " remaining";
    if (remaining <= 0) {
      clearInterval(examTimer);
      const button = document.querySelector("#submit-exam");
      if (button) button.disabled = true;
      const result = document.querySelector("#exam-result");
      if (result) { result.className = "error"; result.textContent = "Time has expired. Return to the exam list to request a new session."; }
    }
  };
  updateCountdown();
  examTimer = setInterval(updateCountdown, 1000);
  document.querySelector("#exam-form").addEventListener("submit", async event => {
    event.preventDefault();
    const answers = {};
    for (const question of questions) {
      const selected = event.currentTarget.querySelector('input[name="q_' + question.id + '"]:checked');
      if (!selected) {
        const result = document.querySelector("#exam-result");
        result.className = "error"; result.textContent = "Please answer every question before submitting.";
        return;
      }
      answers[question.id] = Number(selected.value);
    }
    const button = document.querySelector("#submit-exam");
    button.disabled = true; button.textContent = "Submitting securely…";
    const submitted = await supabase.rpc("portal_submit_exam", {
      p_session_id: session.session_id,
      p_answers: answers
    });
    const result = document.querySelector("#exam-result");
    if (submitted.error || !Array.isArray(submitted.data) || !submitted.data[0]) {
      result.className = "error"; result.textContent = "Your answers could not be submitted. The exam may have expired.";
      button.disabled = false; button.textContent = "Try submission again";
      return;
    }
    clearInterval(examTimer);
    const attempt = submitted.data[0];
    result.className = "success";
    result.textContent = "Exam submitted. Score: " + attempt.score + "%. " +
      (attempt.passed ? "You passed." : "You did not reach the pass mark.");
    button.textContent = "Submitted";
  });
}

async function initializeCoursePayment(courseId) {
  if (!PAYMENTS_ENABLED) return;
  const {data:{session}} = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again before paying.");
  const {data:enrollmentRows,error:enrollmentError} = await supabase.rpc("portal_get_my_course_enrollment",{p_course_id:courseId});
  const enrollment = Array.isArray(enrollmentRows) ? enrollmentRows[0] : null;
  if (enrollmentError || !enrollment || enrollment.status !== "pending" || enrollment.fee_currency !== "NGN") {
    document.querySelector("#course-message").textContent = "This enrolment is not ready for online payment.";
    return;
  }
  const response = await fetch(SUPABASE_URL + "/functions/v1/paystack-payment", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({action:"initialize",enrollment_id:enrollment.enrollment_id})
  });
  const result = await response.json().catch(()=>null);
  if (!response.ok || !result?.authorization_url) {
    document.querySelector("#course-message").textContent = result?.error || "Payment checkout could not be started.";
    return;
  }
  const checkout = new URL(result.authorization_url);
  if (checkout.protocol !== "https:" || checkout.hostname !== "checkout.paystack.com") {
    document.querySelector("#course-message").textContent = "The payment provider returned an invalid checkout address.";
    return;
  }
  window.location.assign(checkout.href);
}

async function renderPaymentCallback() {
  app.innerHTML = '<section class="panel" style="max-width:620px;margin:60px auto;padding:38px"><span class="eyebrow">PAYMENT STATUS</span><h1 style="color:var(--navy)">Checking your payment</h1><p class="muted" id="payment-status">Please wait…</p><a class="text-btn" href="/portal/">Return to portal</a></section>';
  if (!PAYMENTS_ENABLED) {
    document.querySelector("#payment-status").textContent = "Payment verification is not open in this preview. No payment has been requested or processed.";
    return;
  }
  const reference = new URLSearchParams(window.location.search).get("reference");
  const {data:{session}} = await supabase.auth.getSession();
  if (!reference || !session) {
    document.querySelector("#payment-status").textContent = "Sign in again with the account used for this payment to verify its status.";
    return;
  }
  const response = await fetch(SUPABASE_URL + "/functions/v1/paystack-payment", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({action:"verify",reference})
  });
  const result = await response.json().catch(()=>null);
  document.querySelector("#payment-status").textContent = response.ok && result?.confirmed
    ? "Payment verified successfully. Your enrolment has been approved."
    : (result?.error || "Payment is not confirmed yet. Please contact support before trying again.");
}

async function syncSession(session) {
  activeSession=session;
  const adminPath = window.location.pathname === "/portal/admin" || window.location.pathname === "/portal/admin/";
  if(!session){renderAuth("signin");return;}
  if(window.location.pathname === "/portal/payment/callback" || window.location.pathname === "/portal/payment/callback/"){
    await renderPaymentCallback();return;
  }
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
