/* Static contact form (GitHub Pages runs no PHP). Posts to FormSubmit AJAX. */
(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form) return;
  var loading = form.querySelector('.loading');
  var errBox = form.querySelector('.error-message');
  var sentBox = form.querySelector('.sent-message');
  function show(el, on) { if (el) el.classList.toggle('d-block', !!on); }
  function stamp() {
    var ft = document.getElementById('form-time');
    if (ft) ft.value = Math.floor(Date.now() / 1000);
  }
  function done() {
    show(loading, false); show(errBox, false); show(sentBox, true);
    form.reset(); stamp();
  }
  stamp(); // open time for the too-fast bot trap (mirrors forms/contact.php)
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    show(loading, true); show(errBox, false); show(sentBox, false);
    var fd = new FormData(form);
    if ((fd.get('website') || '').toString().trim() !== '') { done(); return; } // honeypot: fake success
    var opened = parseInt(fd.get('form_time'), 10) || 0;
    if (opened && (Date.now() / 1000 - opened) < 3) { done(); return; } // too fast: fake success
    fd.append('_subject', '[Manpower Demand] ' + (((fd.get('subject') || '').toString()) || ((fd.get('name') || '').toString())));
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fetch(form.action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
      .then(done)
      .catch(function () {
        show(loading, false);
        if (errBox) { errBox.textContent = 'Something went wrong. Please email info@basmat-almawared.com directly.'; show(errBox, true); }
      });
  });
})();
