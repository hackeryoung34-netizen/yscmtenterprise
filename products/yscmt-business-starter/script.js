(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  // Replace this demo email with the business owner's real email.
  const contactEmail = 'hello@example.com';
  document.querySelectorAll('[data-email-link]').forEach(link => {
    link.href = 'mailto:' + contactEmail;
    link.textContent = contactEmail + ' ↗';
  });
  document.getElementById('contact-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = document.getElementById('form-note');
    if (contactEmail === 'hello@example.com') {
      note.textContent = 'Demo mode: replace hello@example.com in script.js before publishing.';
      return;
    }
    const subject = encodeURIComponent('Website enquiry from ' + data.get('name'));
    const body = encodeURIComponent('Name: ' + data.get('name') + '\nEmail: ' + data.get('email') + '\n\n' + data.get('message'));
    window.location.href = 'mailto:' + contactEmail + '?subject=' + subject + '&body=' + body;
    note.textContent = 'Your email app should open with the enquiry ready to send.';
  });
})();