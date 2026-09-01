/**
 * ATS CV Builder — live preview, scoring and PDF export.
 *
 * Export strategy: window.print() with a dedicated @page/@media print stylesheet.
 * This keeps the PDF as real selectable text. Canvas-based exporters produce an
 * image of the text, which applicant tracking systems cannot parse at all —
 * that would defeat the entire purpose of the tool.
 */
(function () {
  "use strict";

  const sheet = document.querySelector('#cv-sheet');
  if (!sheet) return;

  const STORE_KEY = 'bam_cv_draft_v1';
  const expList = document.querySelector('#exp-list');
  const eduList = document.querySelector('#edu-list');

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const val = id => {
    const el = document.querySelector('#' + id);
    return el ? el.value.trim() : '';
  };

  /* ================= repeatable entries ================= */

  let expSeq = 0, eduSeq = 0;

  function expRow(d) {
    d = d || {};
    const i = ++expSeq;
    const div = document.createElement('div');
    div.className = 'entry-row';
    div.dataset.kind = 'exp';
    div.innerHTML =
      '<button type="button" class="entry-remove" aria-label="Remove this job">&times;</button>' +
      '<h6>Position ' + i + '</h6>' +
      '<div class="row">' +
        '<div class="col-md-6 mb-2"><label class="field-label">Job Title</label>' +
          '<input type="text" class="form-control cv-in" data-f="title" placeholder="Warehouse Supervisor" value="' + esc(d.title || '') + '"></div>' +
        '<div class="col-md-6 mb-2"><label class="field-label">Employer</label>' +
          '<input type="text" class="form-control cv-in" data-f="org" placeholder="Company name" value="' + esc(d.org || '') + '"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="col-md-4 mb-2"><label class="field-label">From</label>' +
          '<input type="text" class="form-control cv-in" data-f="from" placeholder="Jan 2021" value="' + esc(d.from || '') + '"></div>' +
        '<div class="col-md-4 mb-2"><label class="field-label">To</label>' +
          '<input type="text" class="form-control cv-in" data-f="to" placeholder="Present" value="' + esc(d.to || '') + '"></div>' +
        '<div class="col-md-4 mb-2"><label class="field-label">Location</label>' +
          '<input type="text" class="form-control cv-in" data-f="loc" placeholder="Riyadh" value="' + esc(d.loc || '') + '"></div>' +
      '</div>' +
      '<div class="mb-1"><label class="field-label">What you did</label>' +
        '<textarea class="form-control cv-in" data-f="duties" rows="3" ' +
        'placeholder="One achievement per line. Start with a verb and add a number where you can.">' + esc(d.duties || '') + '</textarea>' +
        '<div class="field-help">One point per line. "Managed a team of 12" beats "responsible for team".</div></div>';
    expList.appendChild(div);
    return div;
  }

  function eduRow(d) {
    d = d || {};
    const i = ++eduSeq;
    const div = document.createElement('div');
    div.className = 'entry-row';
    div.dataset.kind = 'edu';
    div.innerHTML =
      '<button type="button" class="entry-remove" aria-label="Remove this qualification">&times;</button>' +
      '<h6>Qualification ' + i + '</h6>' +
      '<div class="row">' +
        '<div class="col-md-7 mb-2"><label class="field-label">Qualification</label>' +
          '<input type="text" class="form-control cv-in" data-f="deg" placeholder="Diploma in Logistics" value="' + esc(d.deg || '') + '"></div>' +
        '<div class="col-md-5 mb-2"><label class="field-label">Year</label>' +
          '<input type="text" class="form-control cv-in" data-f="year" placeholder="2019" value="' + esc(d.year || '') + '"></div>' +
      '</div>' +
      '<div class="mb-1"><label class="field-label">Institution</label>' +
        '<input type="text" class="form-control cv-in" data-f="school" placeholder="Institution name and country" value="' + esc(d.school || '') + '"></div>';
    eduList.appendChild(div);
    return div;
  }

  function collect(kind) {
    return Array.from(document.querySelectorAll('.entry-row[data-kind="' + kind + '"]')).map(row => {
      const o = {};
      row.querySelectorAll('[data-f]').forEach(f => { o[f.dataset.f] = f.value.trim(); });
      return o;
    });
  }

  document.querySelector('#add-exp').addEventListener('click', () => { expRow(); render(); });
  document.querySelector('#add-edu').addEventListener('click', () => { eduRow(); render(); });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.entry-remove');
    if (!btn) return;
    btn.closest('.entry-row').remove();
    render();
  });

  /* ================= template picker ================= */

  let tpl = 'classic';
  document.querySelector('#tpl-grid').addEventListener('click', e => {
    const card = e.target.closest('.tpl-card');
    if (!card) return;
    tpl = card.dataset.tpl;
    document.querySelectorAll('.tpl-card').forEach(c => {
      const on = c === card;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    render();
  });

  document.querySelector('#tpl-grid').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.tpl-card');
      if (card) { e.preventDefault(); card.click(); }
    }
  });

  /* ================= render the sheet ================= */

  function bullets(text) {
    return text.split('\n').map(l => l.replace(/^[\-\u2022\*]\s*/, '').trim()).filter(Boolean);
  }

  function listFrom(text) {
    return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  }

  function render() {
    const name = val('cv_name');
    const role = val('cv_title');
    const contact = [val('cv_email'), val('cv_phone'), val('cv_city'), val('cv_nationality')]
      .filter(Boolean);

    const extras = [];
    if (val('cv_iqama')) extras.push('Status: ' + val('cv_iqama'));
    if (val('cv_licence') && val('cv_licence') !== 'None') extras.push('Driving Licence: ' + val('cv_licence'));

    let h = '';

    /* header */
    h += '<div class="cv-head">';
    h += '<div class="cv-name">' + (name ? esc(name) : '<span class="cv-placeholder">Your Name</span>') + '</div>';
    if (role) h += '<div class="cv-role">' + esc(role) + '</div>';
    if (contact.length) h += '<p class="cv-contact">' + contact.map(esc).join(' &nbsp;|&nbsp; ') + '</p>';
    if (extras.length) h += '<p class="cv-contact">' + extras.map(esc).join(' &nbsp;|&nbsp; ') + '</p>';
    h += '</div>';

    /* summary */
    const summary = val('cv_summary');
    if (summary) {
      h += '<h2 class="cv-h">Professional Summary</h2>';
      h += '<p class="cv-body">' + esc(summary) + '</p>';
    }

    /* experience */
    const exps = collect('exp').filter(x => x.title || x.org);
    if (exps.length) {
      h += '<h2 class="cv-h">Work Experience</h2>';
      exps.forEach(x => {
        const when = [x.from, x.to].filter(Boolean).join(' – ');
        h += '<div class="cv-entry">';
        h += '<div class="cv-entry-top">';
        h += '<span class="cv-entry-title">' + esc(x.title || 'Position') + '</span>';
        if (when) h += '<span class="cv-entry-date">' + esc(when) + '</span>';
        h += '</div>';
        const org = [x.org, x.loc].filter(Boolean).join(', ');
        if (org) h += '<div class="cv-entry-org">' + esc(org) + '</div>';
        const b = bullets(x.duties || '');
        if (b.length) h += '<ul>' + b.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>';
        h += '</div>';
      });
    }

    /* education */
    const edus = collect('edu').filter(x => x.deg || x.school);
    if (edus.length) {
      h += '<h2 class="cv-h">Education</h2>';
      edus.forEach(x => {
        h += '<div class="cv-entry">';
        h += '<div class="cv-entry-top">';
        h += '<span class="cv-entry-title">' + esc(x.deg || 'Qualification') + '</span>';
        if (x.year) h += '<span class="cv-entry-date">' + esc(x.year) + '</span>';
        h += '</div>';
        if (x.school) h += '<div class="cv-entry-org">' + esc(x.school) + '</div>';
        h += '</div>';
      });
    }

    /* skills */
    const skills = listFrom(val('cv_skills'));
    if (skills.length) {
      h += '<h2 class="cv-h">Skills</h2>';
      h += '<p class="cv-inline">' + skills.map(esc).join(' &nbsp;&middot;&nbsp; ') + '</p>';
    }

    /* certificates */
    const certs = listFrom(val('cv_certs'));
    if (certs.length) {
      h += '<h2 class="cv-h">Certificates &amp; Licences</h2>';
      h += '<div class="cv-entry"><ul>' + certs.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
    }

    /* languages */
    const langs = val('cv_langs');
    if (langs) {
      h += '<h2 class="cv-h">Languages</h2>';
      h += '<p class="cv-inline">' + esc(langs) + '</p>';
    }

    if (!name && !summary && !exps.length) {
      h += '<p class="cv-placeholder" style="margin-top:14mm;text-align:center;">' +
           'Start filling in the form and your CV will appear here.</p>';
    }

    sheet.className = 'tpl-' + tpl;
    sheet.innerHTML = h;

    score();
  }

  /* ================= ATS scoring ================= */

  function score() {
    const exps = collect('exp').filter(x => x.title || x.org);
    const allDuties = exps.map(x => x.duties || '').join('\n');
    const skills = listFrom(val('cv_skills'));

    const checks = [
      { ok: !!val('cv_name'), t: 'Full name present' },
      { ok: !!val('cv_title'), t: 'Professional title matches the job' },
      { ok: !!(val('cv_email') && val('cv_phone')), t: 'Email and phone included' },
      { ok: val('cv_summary').split(/\s+/).filter(Boolean).length >= 15, t: 'Professional summary written' },
      { ok: exps.length >= 1, t: 'At least one job listed' },
      { ok: exps.every(x => x.from), t: 'Employment dates given' },
      { ok: bullets(allDuties).length >= 3, t: 'Duties written as bullet points' },
      { ok: /\d/.test(allDuties), t: 'Achievements include numbers' },
      { ok: skills.length >= 5, t: 'Five or more relevant skills' },
      { ok: collect('edu').some(x => x.deg), t: 'Education included' },
      { ok: !!val('cv_certs'), t: 'Certificates or licences listed' },
      { ok: !!val('cv_langs'), t: 'Languages stated' },
    ];

    const pass = checks.filter(c => c.ok).length;
    const pct = Math.round((pass / checks.length) * 100);

    document.querySelector('#ats-num').textContent = pct;
    document.querySelector('#ats-fill').style.width = pct + '%';
    document.querySelector('#ats-checks').innerHTML =
      checks.map(c => '<li class="' + (c.ok ? 'pass' : 'fail') + '">' + esc(c.t) + '</li>').join('');
  }

  /* ================= export ================= */

  document.querySelector('#btn-pdf').addEventListener('click', () => {
    const name = val('cv_name') || 'CV';
    const prev = document.title;
    // The browser uses document.title as the default PDF filename.
    document.title = name.replace(/[^\w\s\-]/g, '').trim().replace(/\s+/g, '_') + '_CV';
    window.print();
    setTimeout(() => { document.title = prev; }, 900);
  });

  /* ================= draft save / restore ================= */

  function snapshot() {
    return {
      tpl: tpl,
      f: ['cv_name', 'cv_title', 'cv_email', 'cv_phone', 'cv_city', 'cv_nationality',
          'cv_iqama', 'cv_licence', 'cv_summary', 'cv_skills', 'cv_certs', 'cv_langs']
          .reduce((o, k) => { o[k] = val(k); return o; }, {}),
      exp: collect('exp'),
      edu: collect('edu'),
    };
  }

  function restore(d) {
    if (!d) return;
    Object.keys(d.f || {}).forEach(k => {
      const el = document.querySelector('#' + k);
      if (el) el.value = d.f[k];
    });
    expList.innerHTML = ''; eduList.innerHTML = ''; expSeq = 0; eduSeq = 0;
    (d.exp || []).forEach(expRow);
    (d.edu || []).forEach(eduRow);
    if (!(d.exp || []).length) expRow();
    if (!(d.edu || []).length) eduRow();
    if (d.tpl) {
      const card = document.querySelector('.tpl-card[data-tpl="' + d.tpl + '"]');
      if (card) card.click();
    }
    render();
  }

  document.querySelector('#btn-save').addEventListener('click', () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot()));
      const n = document.querySelector('#save-note');
      n.style.display = 'block';
      setTimeout(() => { n.style.display = 'none'; }, 2600);
    } catch (e) {
      alert('Could not save the draft. Your browser may be blocking local storage.');
    }
  });

  /* ================= worked example ================= */

  document.querySelector('#btn-sample').addEventListener('click', () => {
    restore({
      tpl: tpl,
      f: {
        cv_name: 'Imran Khan',
        cv_title: 'Warehouse Supervisor',
        cv_email: 'imran.khan@example.com',
        cv_phone: '+966 55 123 4567',
        cv_city: 'Riyadh, Saudi Arabia',
        cv_nationality: 'Pakistani',
        cv_iqama: 'Transferable Iqama',
        cv_licence: 'Saudi licence - Light vehicle',
        cv_summary: 'Warehouse supervisor with 8 years of experience in distribution and cold chain operations in Saudi Arabia. Managed teams of up to 24 staff across three shifts and reduced picking errors by 31% in twelve months. Seeking a supervisory role with a large logistics operator in Riyadh.',
        cv_skills: 'Inventory control, Team supervision, WMS (SAP EWM), Stock auditing, Cold chain handling, Health and safety, Shift planning, Loading and dispatch',
        cv_certs: 'Forklift Operator Certificate (2022)\nOSHA General Industry Safety Awareness (2021)\nFirst Aid at Work (2023)',
        cv_langs: 'English (fluent), Urdu (native), Arabic (conversational)',
      },
      exp: [
        {
          title: 'Warehouse Supervisor', org: 'Gulf Distribution Company', from: 'Mar 2020', to: 'Present', loc: 'Riyadh',
          duties: 'Supervise 24 warehouse staff across three shifts in a 14,000 sqm distribution centre\nReduced picking errors by 31% by introducing a double-scan verification step\nCoordinate daily dispatch of up to 180 orders against next-day delivery targets\nTrain new operatives on WMS procedures and safe manual handling',
        },
        {
          title: 'Senior Warehouse Operative', org: 'Al Rashid Logistics', from: 'Jun 2017', to: 'Feb 2020', loc: 'Dammam',
          duties: 'Handled inbound receiving and put-away for an average of 40 containers per month\nMaintained 99.2% stock accuracy across quarterly audits\nOperated counterbalance and reach forklifts in a high-density racking environment',
        },
      ],
      edu: [
        { deg: 'Diploma in Supply Chain Management', year: '2016', school: 'Punjab Board of Technical Education, Pakistan' },
      ],
    });
  });

  /* ================= init ================= */

  document.addEventListener('input', e => {
    if (e.target.classList && e.target.classList.contains('cv-in')) render();
  });
  document.addEventListener('change', e => {
    if (e.target.classList && e.target.classList.contains('cv-in')) render();
  });

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }

  if (saved) {
    restore(saved);
  } else {
    expRow();
    eduRow();
    render();
  }

})();
