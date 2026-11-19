/* StageReady page behaviour. No dependencies. Config lives in window.STAGEREADY_CONFIG (set in the page). */
(function () {
  'use strict';
  var CFG = window.STAGEREADY_CONFIG || {};
  var LIMITS = { single: 1, five: 5, ten: 10 };
  var MAX_BYTES = 15 * 1024 * 1024;
  var TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var API = '/.netlify/functions/';

  /* ---------- Package buttons: PayPal link, or honest mailto fallback ---------- */
  document.querySelectorAll('[data-pay]').forEach(function (a) {
    var key = a.getAttribute('data-pay');
    var link = (CFG.paypal && CFG.paypal[key]) || '';
    if (/^https:\/\/(www\.)?paypal\.(com|me)\//.test(link)) {
      a.href = link;
      a.rel = 'noopener';
    } else {
      var label = { single: '1 image ($4.99)', five: '5 images ($19.95)', ten: '10 images ($34.90)' }[key];
      a.href = 'mailto:hello@rynocroft.com?subject=' + encodeURIComponent('StageReady order: ' + label);
    }
  });

  /* ---------- Before / after sliders ---------- */
  document.querySelectorAll('.ba').forEach(function (box) {
    var range = box.querySelector('input[type=range]');
    var imgs = box.querySelectorAll('img');
    var failed = 0;
    imgs.forEach(function (im) {
      im.addEventListener('error', function () {
        failed++;
        box.classList.add('missing');
      });
    });
    range.addEventListener('input', function () {
      box.style.setProperty('--pos', range.value + '%');
    });
  });

  /* ---------- Forms ---------- */
  function fmtSize(n) {
    return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  function show(el, cls, text) {
    el.className = 'msg show ' + cls;
    el.textContent = text;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setupForm(form) {
    var kind = form.getAttribute('data-kind'); // order | demo
    var fileInput = form.querySelector('input[type=file]');
    var list = form.querySelector('.sr-files');
    var msg = form.querySelector('.msg');
    var bar = form.querySelector('.sr-progress');
    var barFill = bar.querySelector('span');
    var pkgSel = form.querySelector('[name=package]');
    var btn = form.querySelector('button[type=submit]');
    var chosen = [];

    function max() {
      return kind === 'demo' ? 1 : LIMITS[pkgSel && pkgSel.value] || 0;
    }
    function renderFiles() {
      list.innerHTML = '';
      chosen.forEach(function (f) {
        var li = document.createElement('li');
        var a = document.createElement('span');
        a.textContent = f.name;
        var b = document.createElement('span');
        b.textContent = fmtSize(f.size);
        li.appendChild(a);
        li.appendChild(b);
        list.appendChild(li);
      });
    }
    function problem() {
      if (kind === 'order' && !max()) return 'Please choose a package first.';
      if (!chosen.length) return 'Please add at least one photo.';
      if (chosen.length > max()) return 'Your package includes up to ' + max() + ' photo' + (max() > 1 ? 's' : '') + '. Please remove ' + (chosen.length - max()) + '.';
      for (var i = 0; i < chosen.length; i++) {
        if (TYPES.indexOf(chosen[i].type) < 0) return '"' + chosen[i].name + '" is not a JPG, PNG or WebP image.';
        if (chosen[i].size > MAX_BYTES) return '"' + chosen[i].name + '" is over 15 MB.';
      }
      return '';
    }

    fileInput.addEventListener('change', function () {
      chosen = Array.prototype.slice.call(fileInput.files);
      renderFiles();
      var p = problem();
      if (p) show(msg, 'err', p);
      else msg.className = 'msg';
    });
    if (pkgSel) pkgSel.addEventListener('change', function () { if (chosen.length) { var p = problem(); if (p) show(msg, 'err', p); else msg.className = 'msg'; } });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = problem();
      if (p) return show(msg, 'err', p);
      if (!form.reportValidity()) return;

      var fd = new FormData(form);
      var v = function (k) { return String(fd.get(k) || '').trim(); };
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      bar.classList.add('show');
      barFill.style.width = '3%';

      var pack = kind === 'demo' ? 'demo' : v('package');
      fetch(API + 'stageready-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: kind,
          package: pack === 'demo' ? 'single' : pack,
          hp: v('hp'),
          files: chosen.map(function (f) { return { name: f.name, type: f.type, size: f.size }; })
        })
      })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload could not start.'); return j; }); })
        .then(function (j) {
          var done = 0;
          return Promise.all(
            j.uploads.map(function (u, i) {
              return fetch(u.url, { method: 'PUT', headers: { 'Content-Type': u.type }, body: chosen[i] }).then(function (r) {
                if (!r.ok) throw new Error('A photo failed to upload. Please try again.');
                done++;
                barFill.style.width = Math.round(10 + (done / j.uploads.length) * 80) + '%';
              });
            })
          ).then(function () { return j; });
        })
        .then(function (j) {
          btn.textContent = 'Finishing…';
          return fetch(API + 'stageready-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: kind,
              orderId: j.orderId,
              keys: j.uploads.map(function (u) { return u.key; }),
              name: v('name'), email: v('email'), agency: v('agency'), location: v('location'),
              roomType: v('roomType'), style: v('style'), instructions: v('instructions'),
              package: pack, paymentRef: v('paymentRef'), consent: !!fd.get('consent'), hp: v('hp')
            })
          }).then(function (r) { return r.json().then(function (k) { if (!r.ok) throw new Error(k.error || 'Submission failed.'); return k; }); });
        })
        .then(function (k) {
          barFill.style.width = '100%';
          form.reset();
          chosen = [];
          renderFiles();
          show(msg, 'ok', 'Thank you. Your reference is ' + k.orderId + '. A confirmation email is on its way; check your spam folder if it does not arrive.');
          btn.textContent = 'Submitted';
        })
        .catch(function (err) {
          show(msg, 'err', err.message || 'Something went wrong. Please email hello@rynocroft.com.');
          btn.disabled = false;
          btn.textContent = btn.getAttribute('data-label');
          bar.classList.remove('show');
        });
    });
  }
  document.querySelectorAll('form.sr-form').forEach(setupForm);

  /* Pre-select package when returning from PayPal (?package=ten#order) */
  var q = /[?&]package=(single|five|ten)\b/.exec(location.search);
  var sel = document.querySelector('#order-form [name=package]');
  if (q && sel) sel.value = q[1];
})();
