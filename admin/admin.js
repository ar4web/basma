/**
 * Vacancy Manager — front end.
 * Talks to api.php. Keeps the whole flow on one screen: no page reloads,
 * no JavaScript editing, no FTP.
 */
(function () {
  "use strict";

  const API = 'api.php';
  let CSRF = null;
  let JOBS = [];
  let editingId = null;      // reference being edited, null when creating
  let filter = 'all';
  let query = '';

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- transport ---------------- */

  async function call(action, payload) {
    const body = Object.assign({ action: action }, payload || {});
    if (CSRF) body.csrf = CSRF;

    const res = await fetch(API, {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        CSRF ? { 'X-CSRF-Token': CSRF } : {}
      ),
      body: JSON.stringify(body)
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('The server returned an unexpected response. Is PHP running?');
    }
    if (!data.ok) throw new Error(data.error || 'Request failed.');
    if (data.csrf) CSRF = data.csrf;
    return data;
  }

  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast-bam on' + (bad ? ' bad' : '');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = 'toast-bam'; }, 3200);
  }

  function showErr(sel, msg) {
    const el = $(sel);
    el.textContent = msg;
    el.classList.add('show');
  }

  function hideErr(sel) {
    $(sel).classList.remove('show');
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    try {
      const st = await call('status');
      if (st.auth) {
        CSRF = st.csrf;
        enterApp();
      } else {
        $('#login-form').style.display = st.installed ? '' : 'none';
        $('#setup-form').style.display = st.installed ? 'none' : '';
        ($('#' + (st.installed ? 'li-user' : 'su-user')) || {}).focus?.();
      }
    } catch (e) {
      showErr('#li-error', e.message);
    }
  }

  /* ---------------- auth ---------------- */

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideErr('#li-error');
    const btn = $('#li-btn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const r = await call('login', { username: $('#li-user').value, password: $('#li-pass').value });
      CSRF = r.csrf;
      enterApp();
    } catch (err) {
      showErr('#li-error', err.message);
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  $('#setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideErr('#su-error');
    if ($('#su-pass').value !== $('#su-pass2').value) {
      return showErr('#su-error', 'The two passwords do not match.');
    }
    const btn = $('#su-btn');
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const r = await call('setup', { username: $('#su-user').value, password: $('#su-pass').value });
      CSRF = r.csrf;
      enterApp();
      toast('Account created. Keep these credentials safe.');
    } catch (err) {
      showErr('#su-error', err.message);
      btn.disabled = false; btn.textContent = 'Create Account';
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await call('logout'); } catch (e) {}
    location.reload();
  });

  async function enterApp() {
    $('#gate').style.display = 'none';
    $('#app').style.display = '';
    await refresh();
  }

  /* ---------------- data ---------------- */

  async function refresh() {
    const r = await call('list');
    JOBS = r.jobs || [];
    if (r.updated) {
      const d = new Date(r.updated);
      $('#saved-at').textContent = 'Last updated ' + d.toLocaleDateString() + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    paint();
  }

  function paint() {
    const live = JOBS.filter(j => j.active !== false).length;
    $('#s-total').textContent = JOBS.length;
    $('#s-live').textContent = live;
    $('#s-paused').textContent = JOBS.length - live;
    $('#s-positions').textContent = JOBS
      .filter(j => j.active !== false)
      .reduce((n, j) => n + (parseInt(j.vacancies, 10) || 0), 0);

    // datalists for faster typing
    $('#cats').innerHTML = [...new Set(JOBS.map(j => j.category).filter(Boolean))]
      .map(c => '<option value="' + esc(c) + '">').join('');
    $('#locs').innerHTML = [...new Set(JOBS.map(j => j.location).filter(Boolean))]
      .map(c => '<option value="' + esc(c) + '">').join('');

    let list = JOBS.slice();
    if (filter === 'live') list = list.filter(j => j.active !== false);
    if (filter === 'paused') list = list.filter(j => j.active === false);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(j =>
        ((j.title || '') + ' ' + (j.id || '') + ' ' + (j.location || '') + ' ' + (j.category || ''))
          .toLowerCase().includes(q));
    }

    $('#blank').style.display = JOBS.length === 0 ? '' : 'none';

    $('#rows').innerHTML = list.map(j => {
      const paused = j.active === false;
      return '<div class="row-job' + (paused ? ' paused' : '') + '">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(j.title || 'Untitled') +
            (j.urgent ? '<span class="pill pill-urgent">Urgent</span>' : '') +
            '<span class="pill ' + (paused ? 'pill-paused">Paused' : 'pill-live">Live') + '</span>' +
          '</div>' +
          '<div class="row-meta">' +
            '<span><i class="bi bi-hash"></i>' + esc(j.id || '') + '</span>' +
            '<span><i class="bi bi-tag"></i>' + esc(j.category || '') + '</span>' +
            '<span><i class="bi bi-geo-alt"></i>' + esc(j.location || '') + '</span>' +
            '<span><i class="bi bi-people"></i>' + (parseInt(j.vacancies, 10) || 1) + '</span>' +
            '<span><i class="bi bi-calendar3"></i>' + esc(j.posted || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="row-acts">' +
          '<button class="icon-btn" data-act="dup" data-id="' + esc(j.id) + '" title="Duplicate"><i class="bi bi-copy"></i></button>' +
          '<button class="icon-btn" data-act="toggle" data-id="' + esc(j.id) + '" title="' +
            (paused ? 'Make live' : 'Pause') + '"><i class="bi bi-' + (paused ? 'play' : 'pause') + '-circle"></i></button>' +
          '<button class="icon-btn" data-act="edit" data-id="' + esc(j.id) + '" title="Edit"><i class="bi bi-pencil"></i></button>' +
          '<button class="icon-btn danger" data-act="del" data-id="' + esc(j.id) + '" title="Delete"><i class="bi bi-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (JOBS.length && !list.length) {
      $('#rows').innerHTML = '<div class="blank"><i class="bi bi-search"></i>' +
        '<h3>Nothing matches</h3><p>Try a different search or filter.</p></div>';
    }
  }

  /* ---------------- row actions ---------------- */

  $('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    const job = JOBS.find(j => j.id === id);
    if (!job) return;

    if (b.dataset.act === 'edit') return openDrawer(job);

    if (b.dataset.act === 'dup') {
      const copy = JSON.parse(JSON.stringify(job));
      copy.id = nextRef(job.category);
      copy.title = job.title;
      openDrawer(copy, true);
      return;
    }

    if (b.dataset.act === 'toggle') {
      try {
        const r = await call('toggle', { id: id });
        job.active = r.active;
        paint();
        toast(r.active ? 'Vacancy is now live' : 'Vacancy paused');
      } catch (err) { toast(err.message, true); }
      return;
    }

    if (b.dataset.act === 'del') {
      if (!confirm('Delete "' + job.title + '" (' + job.id + ')?\n\nThis cannot be undone, but a backup is kept on the server.')) return;
      try {
        await call('delete', { id: id });
        JOBS = JOBS.filter(j => j.id !== id);
        paint();
        toast('Vacancy deleted');
      } catch (err) { toast(err.message, true); }
    }
  });

  /* ---------------- filters ---------------- */

  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    filter = b.dataset.f;
    $('#seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });

  let qt;
  $('#q').addEventListener('input', e => {
    clearTimeout(qt);
    const v = e.target.value.trim();
    qt = setTimeout(() => { query = v; paint(); }, 150);
  });

  /* ---------------- drawer ---------------- */

  function nextRef(category) {
    const prefix = (category || 'JOB').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'JB';
    let n = 100;
    const used = new Set(JOBS.map(j => (j.id || '').toUpperCase()));
    while (used.has(prefix + '-' + n)) n++;
    return prefix + '-' + n;
  }

  function openDrawer(job, isCopy) {
    editingId = (job && !isCopy) ? job.id : null;
    $('#dr-title').textContent = job ? (isCopy ? 'Duplicate Vacancy' : 'Edit Vacancy') : 'Add Vacancy';
    hideErr('#dr-error');

    const j = job || {};
    $('#f-title').value = j.title || '';
    $('#f-id').value = j.id || '';
    $('#f-category').value = j.category || '';
    $('#f-location').value = j.location || '';
    $('#f-type').value = j.type || 'Full-time';
    $('#f-experience').value = j.experience || '';
    $('#f-vacancies').value = j.vacancies || 1;
    $('#f-salary').value = j.salary || '';
    $('#f-posted').value = j.posted || new Date().toISOString().slice(0, 10);
    $('#f-summary').value = j.summary || '';
    $('#f-requirements').value = (j.requirements || []).join('\n');
    $('#f-benefits').value = (j.benefits || []).join('\n');
    $('#f-active').checked = j.active !== false;
    $('#f-urgent').checked = !!j.urgent;

    $('#drawer').classList.add('on');
    $('#drawer-bg').classList.add('on');
    $('#drawer').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#f-title').focus(), 340);
  }

  function closeDrawer() {
    $('#drawer').classList.remove('on');
    $('#drawer-bg').classList.remove('on');
    $('#drawer').setAttribute('aria-hidden', 'true');
    editingId = null;
  }

  $('#btn-new').addEventListener('click', () => openDrawer(null));
  $('#btn-new2').addEventListener('click', () => openDrawer(null));
  $('#dr-close').addEventListener('click', closeDrawer);
  $('#dr-cancel').addEventListener('click', closeDrawer);
  $('#drawer-bg').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#drawer').classList.contains('on')) closeDrawer();
    // Ctrl/Cmd+S saves while the drawer is open
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && $('#drawer').classList.contains('on')) {
      e.preventDefault();
      $('#dr-save').click();
    }
  });

  // Auto-suggest a reference from the category when the field is empty
  $('#f-category').addEventListener('blur', () => {
    if (!$('#f-id').value.trim() && $('#f-category').value.trim()) {
      $('#f-id').value = nextRef($('#f-category').value);
    }
  });

  $('#f-gen').addEventListener('click', () => {
    $('#f-id').value = nextRef($('#f-category').value);
  });

  $('#dr-save').addEventListener('click', async () => {
    hideErr('#dr-error');
    const job = {
      id: $('#f-id').value.trim().toUpperCase(),
      title: $('#f-title').value.trim(),
      category: $('#f-category').value.trim(),
      location: $('#f-location').value.trim(),
      type: $('#f-type').value,
      experience: $('#f-experience').value.trim(),
      vacancies: parseInt($('#f-vacancies').value, 10) || 1,
      salary: $('#f-salary').value.trim() || 'Competitive',
      posted: $('#f-posted').value || new Date().toISOString().slice(0, 10),
      summary: $('#f-summary').value.trim(),
      requirements: $('#f-requirements').value.split('\n').map(s => s.trim()).filter(Boolean),
      benefits: $('#f-benefits').value.split('\n').map(s => s.trim()).filter(Boolean),
      active: $('#f-active').checked,
      urgent: $('#f-urgent').checked
    };

    if (!job.title) return showErr('#dr-error', 'Job title is required.');
    if (!job.category) return showErr('#dr-error', 'Category is required.');
    if (!/^[A-Z0-9\-]{2,24}$/.test(job.id)) {
      return showErr('#dr-error', 'Reference must be 2-24 characters: letters, numbers and hyphens only.');
    }

    const btn = $('#dr-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    try {
      await call('save', { job: job, originalId: editingId });
      await refresh();
      closeDrawer();
      toast('Saved. The careers page is updated.');
    } catch (err) {
      showErr('#dr-error', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check-lg"></i> Save Vacancy';
    }
  });

  /* ---------------- password ---------------- */

  $('#btn-password').addEventListener('click', () => $('#pw-bg').classList.add('on'));
  $('#pw-cancel').addEventListener('click', () => $('#pw-bg').classList.remove('on'));

  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideErr('#pw-error');
    try {
      await call('password', { current: $('#pw-cur').value, new: $('#pw-new').value });
      $('#pw-bg').classList.remove('on');
      $('#pw-form').reset();
      toast('Password updated');
    } catch (err) {
      showErr('#pw-error', err.message);
    }
  });

  boot();

})();
