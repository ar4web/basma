/**
 * Careers page: renders vacancies from assets/js/jobs-data.js,
 * with category filtering and keyword search.
 */
(async function () {
  "use strict";

  const list = document.querySelector('#job-list');
  if (!list) return;

  // Wait for data/jobs.json (written by the admin panel) before rendering.
  if (window.BAM_JOBS_READY) { try { await window.BAM_JOBS_READY; } catch (e) {} }

  const jobs = (window.BAM_JOBS || []).filter(j => j.active !== false);

  const filterBar = document.querySelector('#job-filters');
  const searchBox = document.querySelector('#job-search');
  const countEl = document.querySelector('#job-result-count');
  const emptyEl = document.querySelector('#job-empty');
  const noneEl = document.querySelector('#job-none');

  let activeCat = 'All';
  let term = '';

  /* ---------- helpers ---------- */

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function daysAgo(dateStr) {
    const then = new Date(dateStr + 'T00:00:00');
    if (isNaN(then)) return '';
    const diff = Math.floor((Date.now() - then.getTime()) / 86400000);
    if (diff <= 0) return 'Posted today';
    if (diff === 1) return 'Posted yesterday';
    if (diff < 7) return 'Posted ' + diff + ' days ago';
    if (diff < 14) return 'Posted 1 week ago';
    if (diff < 60) return 'Posted ' + Math.floor(diff / 7) + ' weeks ago';
    return 'Posted ' + Math.floor(diff / 30) + ' months ago';
  }

  /* ---------- headline stats ---------- */

  function setStats() {
    const openings = jobs.length;
    const positions = jobs.reduce((n, j) => n + (parseInt(j.vacancies, 10) || 0), 0);
    const urgent = jobs.filter(j => j.urgent).length;
    const set = (id, val) => {
      const el = document.querySelector(id);
      if (el) countUp(el, val);
    };
    set('#stat-openings', openings);
    set('#stat-positions', positions);
    set('#stat-urgent', urgent);
  }

  function countUp(el, target) {
    const dur = 900, t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.floor(p * target).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(tick);
  }

  /* ---------- filters ---------- */

  function buildFilters() {
    const cats = ['All', ...Array.from(new Set(jobs.map(j => j.category)))];
    filterBar.innerHTML = cats.map(c => {
      const n = c === 'All' ? jobs.length : jobs.filter(j => j.category === c).length;
      return '<button type="button" data-cat="' + esc(c) + '"' +
        (c === 'All' ? ' class="active"' : '') + '>' + esc(c) +
        ' <span style="opacity:.65">(' + n + ')</span></button>';
    }).join('');

    filterBar.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      activeCat = btn.dataset.cat;
      filterBar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  }

  /* ---------- card markup ---------- */

  function card(j) {
    const reqs = (j.requirements || []).map(r => '<li>' + esc(r) + '</li>').join('');
    const bens = (j.benefits || []).map(b => '<li>' + esc(b) + '</li>').join('');
    const posText = j.vacancies > 1 ? j.vacancies + ' positions' : '1 position';

    return '' +
      '<div class="col-lg-6">' +
        '<article class="job-card">' +
          '<div class="job-card-head">' +
            '<div>' +
              '<h3>' + esc(j.title) + '</h3>' +
              '<span class="job-ref">Ref ' + esc(j.id) + ' &middot; ' + esc(j.category) + '</span>' +
            '</div>' +
            (j.urgent ? '<span class="job-urgent">Urgent</span>' : '') +
          '</div>' +

          '<div class="job-meta">' +
            '<span><i class="bi bi-geo-alt"></i>' + esc(j.location) + '</span>' +
            '<span><i class="bi bi-briefcase"></i>' + esc(j.type) + '</span>' +
            '<span><i class="bi bi-bar-chart"></i>' + esc(j.experience) + '</span>' +
            '<span><i class="bi bi-people"></i>' + posText + '</span>' +
            '<span><i class="bi bi-cash-coin"></i>' + esc(j.salary) + '</span>' +
          '</div>' +

          '<p class="job-summary">' + esc(j.summary) + '</p>' +

          '<div class="job-detail" id="detail-' + esc(j.id) + '">' +
            (reqs ? '<h5>Requirements</h5><ul>' + reqs + '</ul>' : '') +
            (bens ? '<h5>What We Offer</h5><ul>' + bens + '</ul>' : '') +
          '</div>' +

          '<div class="job-actions">' +
            '<a class="btn-brand" href="apply.html?job=' + encodeURIComponent(j.id) + '">Apply Now</a>' +
            '<button type="button" class="job-toggle" aria-expanded="false" ' +
              'aria-controls="detail-' + esc(j.id) + '" data-toggle="' + esc(j.id) + '">' +
              '<span class="t">View details</span> <i class="bi bi-chevron-down"></i>' +
            '</button>' +
            '<span class="job-posted">' + daysAgo(j.posted) + '</span>' +
          '</div>' +
        '</article>' +
      '</div>';
  }

  /* ---------- render ---------- */

  function render() {
    let out = jobs.slice();

    if (activeCat !== 'All') out = out.filter(j => j.category === activeCat);

    if (term) {
      const t = term.toLowerCase();
      out = out.filter(j =>
        (j.title + ' ' + j.location + ' ' + j.category + ' ' +
         j.id + ' ' + j.type + ' ' + j.summary).toLowerCase().includes(t)
      );
    }

    // Urgent first, then newest.
    out.sort((a, b) => (b.urgent - a.urgent) || (new Date(b.posted) - new Date(a.posted)));

    list.innerHTML = out.map(card).join('');

    // Two different empty states, because they mean different things:
    //  - no jobs posted at all  -> invite the candidate to register in advance
    //  - jobs exist but the search/filter matched none -> offer to clear filters
    const noneAtAll = jobs.length === 0;
    if (noneEl) noneEl.hidden = !noneAtAll;
    emptyEl.hidden = noneAtAll || out.length !== 0;

    // Hide the toolbar entirely when there is nothing to search through.
    const toolbar = document.querySelector('.job-toolbar');
    if (toolbar) toolbar.style.display = noneAtAll ? 'none' : '';

    countEl.textContent = out.length
      ? 'Showing ' + out.length + ' of ' + jobs.length + ' vacancies'
      : '';
  }

  /* ---------- expand / collapse ---------- */

  list.addEventListener('click', e => {
    const btn = e.target.closest('.job-toggle');
    if (!btn) return;
    const panel = document.querySelector('#detail-' + CSS.escape(btn.dataset.toggle));
    const open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.querySelector('.t').textContent = open ? 'Hide details' : 'View details';
  });

  /* ---------- search (debounced) ---------- */

  let timer;
  if (searchBox) {
    searchBox.addEventListener('input', e => {
      clearTimeout(timer);
      const v = e.target.value.trim();
      timer = setTimeout(() => { term = v; render(); }, 180);
    });
  }

  /* ---------- clear filters ---------- */

  const clearBtn = document.querySelector('#job-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      term = '';
      activeCat = 'All';
      if (searchBox) searchBox.value = '';
      filterBar.querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === 'All'));
      render();
    });
  }

  /* ---------- init ---------- */

  buildFilters();
  render();
  setStats();

})();
