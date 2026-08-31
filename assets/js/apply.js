/**
 * Multi-step job application form.
 * Client-side validation only improves the experience — forms/apply.php
 * revalidates everything on the server, which is the real gate.
 */
(async function () {
  "use strict";

  const form = document.querySelector('#apply-form');
  if (!form) return;

  // Wait for data/jobs.json (written by the admin panel) before building the list.
  if (window.BAM_JOBS_READY) { try { await window.BAM_JOBS_READY; } catch (e) {} }

  const jobs = (window.BAM_JOBS || []).filter(j => j.active !== false);
  const panels = Array.from(form.querySelectorAll('.form-panel'));
  const steps = Array.from(document.querySelectorAll('#form-steps .step'));
  const btnBack = document.querySelector('#btn-back');
  const btnNext = document.querySelector('#btn-next');
  const btnSubmit = document.querySelector('#btn-submit');
  const alertBox = document.querySelector('#form-alert');
  let current = 1;
  const LAST = panels.length;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- populate the position dropdown ---------------- */

  const sel = document.querySelector('#job_id');
  const byCat = {};
  jobs.forEach(j => (byCat[j.category] = byCat[j.category] || []).push(j));

  Object.keys(byCat).forEach(cat => {
    const g = document.createElement('optgroup');
    g.label = cat;
    byCat[cat].forEach(j => {
      const o = document.createElement('option');
      o.value = j.id;
      o.textContent = j.title + ' — ' + j.location + ' (Ref ' + j.id + ')';
      g.appendChild(o);
    });
    sel.appendChild(g);
  });

  const spec = document.createElement('option');
  spec.value = 'SPECULATIVE';
  spec.textContent = 'No specific role — register me for future openings';
  sel.appendChild(spec);

  // Preselect from ?job=WH-104
  const wanted = new URLSearchParams(location.search).get('job');
  if (wanted && sel.querySelector('option[value="' + CSS.escape(wanted) + '"]')) {
    sel.value = wanted;
  }

  const brief = document.querySelector('#job-brief');
  function showBrief() {
    const j = jobs.find(x => x.id === sel.value);
    document.querySelector('#job_title_hidden').value =
      j ? j.title : (sel.value === 'SPECULATIVE' ? 'Speculative Application' : '');
    if (!j) {
      if (sel.value === 'SPECULATIVE') {
        brief.hidden = false;
        brief.innerHTML =
          '<div style="background: color-mix(in srgb, var(--accent-color), transparent 95%);' +
          ' border-left: 3px solid var(--accent-color); border-radius: 6px; padding: 14px 16px;">' +
          '<div style="font-size:13.5px; line-height:1.7;">' +
          '<strong>Registering for future openings</strong><br>' +
          '<span style="color: color-mix(in srgb, var(--default-color), transparent 30%);">' +
          'Your details go into our candidate pool. When a client requirement matches your ' +
          'profile we contact you directly, usually before the role is advertised.' +
          '</span></div></div>';
      } else {
        brief.hidden = true;
      }
      return;
    }
    brief.hidden = false;
    brief.innerHTML =
      '<div style="background: color-mix(in srgb, var(--accent-color), transparent 95%);' +
      ' border-left: 3px solid var(--accent-color); border-radius: 6px; padding: 14px 16px;">' +
      '<div style="font-size:13.5px; line-height:1.7;">' +
      '<strong>' + esc(j.title) + '</strong> &middot; ' + esc(j.location) + '<br>' +
      '<span style="color: color-mix(in srgb, var(--default-color), transparent 30%);">' +
      esc(j.type) + ' &middot; ' + esc(j.experience) + ' &middot; ' + esc(j.salary) +
      '</span></div></div>';
  }
  sel.addEventListener('change', showBrief);
  showBrief();

  /* ---------------- ID validation ---------------- */

  const idType = document.querySelector('#id_type');
  const idNum = document.querySelector('#id_number');
  const idHelp = document.querySelector('#id-help');
  const idErr = document.querySelector('#id-error');

  idType.addEventListener('change', () => {
    idNum.value = '';
    if (idType.value === 'iqama') {
      idNum.placeholder = '2XXXXXXXXX';
      idHelp.textContent = 'Your Iqama number is 10 digits and starts with 2.';
    } else if (idType.value === 'national') {
      idNum.placeholder = '1XXXXXXXXX';
      idHelp.textContent = 'Your Saudi National ID is 10 digits and starts with 1.';
    } else if (idType.value === 'passport') {
      idNum.placeholder = 'Passport number';
      idHelp.textContent = 'Enter your passport number exactly as printed.';
    } else {
      idNum.placeholder = 'Select ID type first';
      idHelp.textContent = 'Saudi National ID starts with 1, Iqama starts with 2. Both are 10 digits.';
    }
  });

  // Digits only for Saudi IDs
  idNum.addEventListener('input', () => {
    if (idType.value === 'iqama' || idType.value === 'national') {
      idNum.value = idNum.value.replace(/\D/g, '').slice(0, 10);
    }
  });

  function idValid() {
    const v = idNum.value.trim();
    // ID is optional: an empty field is valid. Only a filled-in field is checked,
    // so a typo is still caught before submission.
    if (!v) { idErr.textContent = ''; return true; }
    if (idType.value === 'iqama') {
      if (!/^2\d{9}$/.test(v)) { idErr.textContent = 'An Iqama number must be 10 digits starting with 2.'; return false; }
    } else if (idType.value === 'national') {
      if (!/^1\d{9}$/.test(v)) { idErr.textContent = 'A Saudi National ID must be 10 digits starting with 1.'; return false; }
    } else if (idType.value === 'passport') {
      if (!/^[A-Za-z0-9]{5,15}$/.test(v)) { idErr.textContent = 'Please enter a valid passport number.'; return false; }
    }
    return true;
  }

  /* ---------------- file upload ---------------- */

  const zone = document.querySelector('#upload-zone');
  const fileInput = document.querySelector('#cv_file');
  const fileBox = document.querySelector('#upload-file');
  const fileErr = document.querySelector('#file-error');
  const MAXBYTES = 5 * 1024 * 1024;
  const OK_EXT = ['pdf', 'doc', 'docx'];

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  ['dragenter', 'dragover'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', e => {
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFile();
    }
  });
  fileInput.addEventListener('change', handleFile);

  function handleFile() {
    fileErr.style.display = 'none';
    const f = fileInput.files[0];
    if (!f) { fileBox.classList.remove('show'); return; }
    const ext = f.name.split('.').pop().toLowerCase();
    if (OK_EXT.indexOf(ext) === -1) {
      fileErr.textContent = 'Only PDF, DOC and DOCX files are accepted.';
      fileErr.style.display = 'block';
      fileInput.value = ''; fileBox.classList.remove('show'); return;
    }
    if (f.size > MAXBYTES) {
      fileErr.textContent = 'That file is ' + (f.size / 1048576).toFixed(1) + ' MB. The maximum is 5 MB.';
      fileErr.style.display = 'block';
      fileInput.value = ''; fileBox.classList.remove('show'); return;
    }
    document.querySelector('#file-name').textContent = f.name;
    document.querySelector('#file-size').textContent =
      f.size < 1024 * 1024
        ? (f.size / 1024).toFixed(0) + ' KB'
        : (f.size / 1048576).toFixed(2) + ' MB';
    fileBox.classList.add('show');
  }

  document.querySelector('#file-remove').addEventListener('click', () => {
    fileInput.value = '';
    fileBox.classList.remove('show');
  });

  /* ---------------- per-step validation ---------------- */

  function markError(el, on) {
    const grp = el.closest('.mb-3, .form-check, .col-md-6') || el.parentElement;
    grp.classList.toggle('has-error', on);
  }

  function validate(step) {
    const panel = panels[step - 1];
    let ok = true;
    panel.querySelectorAll('[required]').forEach(el => {
      let good = true;
      if (el.type === 'checkbox') good = el.checked;
      else if (el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      else if (el.type === 'tel') good = el.value.replace(/\D/g, '').length >= 9;
      else good = el.value.trim() !== '';

      if (el === idNum) good = idValid();

      markError(el, !good);
      if (!good && ok) { el.focus(); ok = false; }
      else if (!good) ok = false;
    });
    return ok;
  }

  /* ---------------- review panel ---------------- */

  function buildReview() {
    const v = id => (document.querySelector('#' + id) || {}).value || '';
    const txt = id => {
      const el = document.querySelector('#' + id);
      if (!el) return '';
      if (el.tagName === 'SELECT' && el.selectedIndex >= 0) return el.options[el.selectedIndex].text;
      return el.value;
    };
    const f = fileInput.files[0];

    const block = (title, rows) =>
      '<div class="review-block"><h6>' + title + '</h6>' +
      rows.filter(r => r[1]).map(r =>
        '<div class="review-row"><div class="k">' + r[0] + '</div><div class="v">' + esc(r[1]) + '</div></div>'
      ).join('') + '</div>';

    document.querySelector('#review-out').innerHTML =
      block('Position', [
        ['Applying for', txt('job_id')],
        ['Available from', v('available_from')],
        ['Current status', txt('current_location')]
      ]) +
      block('Personal Details', [
        ['Full name', v('full_name')],
        ['Nationality', v('nationality')],
        ['Email', v('email')],
        ['Mobile', v('phone')],
        ['ID type', txt('id_type')],
        ['ID number', v('id_number')],
        ['Date of birth', v('dob')],
        ['City', v('city')]
      ]) +
      block('Experience', [
        ['Years of experience', txt('years_exp')],
        ['Current job title', v('current_job')],
        ['Skills', v('skills')],
        ['CV attached', f ? f.name : 'No file uploaded'],
        ['Additional notes', v('cover_note')]
      ]);
  }

  /* ---------------- step navigation ---------------- */

  function goTo(n) {
    current = n;
    panels.forEach(p => p.classList.toggle('active', +p.dataset.panel === n));
    steps.forEach(s => {
      const i = +s.dataset.step;
      s.classList.toggle('active', i === n);
      s.classList.toggle('done', i < n);
    });
    btnBack.style.visibility = n === 1 ? 'hidden' : 'visible';
    btnNext.style.display = n === LAST ? 'none' : '';
    btnSubmit.style.display = n === LAST ? '' : 'none';
    if (n === LAST) buildReview();
    const top = document.querySelector('.form-wrap').getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  btnNext.addEventListener('click', () => { if (validate(current)) goTo(current + 1); });
  btnBack.addEventListener('click', () => goTo(current - 1));

  /* ---------------- submit ---------------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(LAST)) return;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';
    alertBox.innerHTML = '';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then(r => r.json().catch(() => ({ ok: false, error: 'Unexpected server response.' })))
      .then(data => {
        if (data.ok) {
          form.style.display = 'none';
          document.querySelector('#apply-intro').style.display = 'none';
          document.querySelector('#form-steps').style.display = 'none';
          document.querySelector('#success-ref').textContent = data.reference || '—';

          // Let the candidate copy their reference in one tap.
          const copyBtn = document.querySelector('#copy-ref');
          if (copyBtn && navigator.clipboard) {
            copyBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(data.reference || '').then(() => {
                copyBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1800);
              }).catch(() => {});
            });
          } else if (copyBtn) {
            copyBtn.style.display = 'none';
          }
          document.querySelector('#apply-success').style.display = 'block';
          window.scrollTo({
            top: document.querySelector('.form-wrap').offsetTop - 110,
            behavior: 'smooth'
          });
        } else {
          throw new Error(data.error || 'Submission failed.');
        }
      })
      .catch(err => {
        alertBox.innerHTML =
          '<div style="background:#fdecea;border:1px solid #f5c6cb;color:#8a1c1c;' +
          'padding:12px 16px;border-radius:6px;font-size:14px;">' +
          esc(err.message) + ' Please try again, or email your CV to info@basmat-almawared.com.' +
          '</div>';
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="bi bi-send"></i> Submit Application';
      });
  });

  /* ---------------- anti-spam timestamp ---------------- */

  const ft = document.querySelector('#form-time');
  if (ft) ft.value = Math.floor(Date.now() / 1000);

})();
