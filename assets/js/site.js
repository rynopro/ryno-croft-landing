// Mobile navigation and enquiry form handling. No dependencies.
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('main-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var form = document.getElementById('enquiry-form');
  if (!form) return;
  var ok = document.getElementById('form-ok');
  var err = document.getElementById('form-err');

  // Pre-select a package or audience from the URL, e.g. /contact?package=authority&audience=dental
  var params = new URLSearchParams(window.location.search);
  [['package', 'package'], ['audience', 'topic']].forEach(function (pair) {
    var k = pair[1];
    var el = form.elements[k];
    if (el && params.get(pair[0])) el.value = params.get(pair[0]);
  });

  // Time trap: record when the form was opened (bots tend to submit instantly).
  if (form.elements.form_opened) form.elements.form_opened.value = String(Date.now());

  var LABELS = { PROSPECT: 'PROSPECT', INFORMATION: 'INFORMATION', PARTNERSHIP: 'PARTNERSHIP', SUPPLIER: 'SUPPLIER', OTHER: 'OTHER' };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ok.classList.remove('show');
    err.classList.remove('show');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var words = form.elements.message.value.trim().split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      form.elements.message.setCustomValidity('Please add a few more details so we can understand what you need.');
      form.reportValidity();
      form.elements.message.setCustomValidity('');
      return;
    }
    var kind = LABELS[form.elements.enquiry_type.value] || 'OTHER';
    form.elements.classification.value = kind;
    form.elements.subject.value = '[' + kind + '] Enquiry from ' + form.elements.name.value.trim().slice(0, 60);
    form.elements.form_opened.value = String(Math.round((Date.now() - Number(form.elements.form_opened.value || Date.now())) / 1000));
    var submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    submit.textContent = 'Sending...';
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      window.location.href = '/thank-you';
    }).catch(function () {
      err.classList.add('show');
      err.focus();
      submit.disabled = false;
      submit.textContent = 'Send enquiry';
    });
  });
})();
