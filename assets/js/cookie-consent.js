/**
 * =============================================================================
 * BASMAT AL MAWARED — COOKIE CONSENT
 * =============================================================================
 * Built for Saudi PDPL, which requires opt-in consent: non-essential cookies
 * and third-party embeds must stay OFF until the visitor actively agrees.
 *
 * What this actually does, rather than just claims:
 *   - Nothing non-essential runs before consent. The YouTube video is physically
 *     replaced with a placeholder until "functional" is granted.
 *   - Rejecting is exactly as easy as accepting: both are one click, same size.
 *   - The choice is stored with a timestamp and a version, so consent can be
 *     re-requested if the categories ever change (PDPL expects re-consent when
 *     purposes change).
 *   - The decision is recorded in localStorage, NOT in a cookie, so declining
 *     genuinely means no cookie is written.
 *
 * Other scripts can check consent with:
 *     BamConsent.allows('analytics')      -> true / false
 *     BamConsent.onChange(fn)             -> called whenever preferences change
 *     BamConsent.reopen()                 -> opens the preferences dialog
 * =============================================================================
 */
(function () {
  "use strict";

  const KEY = 'bam_cookie_consent';
  const VERSION = 1;          // bump this if the categories change
  const EXPIRY_DAYS = 180;    // re-ask twice a year

  /* ---------------- state ---------------- */

  const DEFAULTS = { essential: true, functional: false, analytics: false };
  let state = null;
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.version !== VERSION) return null;
      const age = (Date.now() - (d.at || 0)) / 86400000;
      if (age > EXPIRY_DAYS) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function save(prefs) {
    state = {
      version: VERSION,
      at: Date.now(),
      date: new Date().toISOString(),
      prefs: prefs
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage blocked — consent then applies to this visit only */
    }
    listeners.forEach(fn => { try { fn(prefs); } catch (e) {} });
    applyConsent(prefs);
  }

  function prefs() {
    return (state && state.prefs) ? state.prefs : DEFAULTS;
  }

  /* ---------------- third-party gating ---------------- */
  /**
   * The company video is now self-hosted from assets/video/, so it sets no
   * third-party cookies and needs no consent.
   *
   * This gate is kept active for any FUTURE third-party embed: if a YouTube or
   * Vimeo link is ever added back, it is blocked automatically until the
   * visitor allows functional cookies. Nothing to change at that point.
   */
  function gateEmbeds(allowed) {
    document.querySelectorAll('a.glightbox[href*="youtube.com"], a.glightbox[href*="youtu.be"], a.glightbox[href*="vimeo.com"]')
      .forEach(link => {
        const holder = link.parentElement;
        if (!holder) return;

        if (allowed) {
          if (link.dataset.bamHref) {
            link.setAttribute('href', link.dataset.bamHref);
            delete link.dataset.bamHref;
          }
          link.classList.remove('bam-cc-disabled');
          const ph = holder.querySelector('.bam-cc-blocked');
          if (ph) ph.remove();
          return;
        }

        // Block it.
        if (!link.dataset.bamHref) {
          link.dataset.bamHref = link.getAttribute('href') || '';
          link.setAttribute('href', 'javascript:void(0)');
          link.classList.add('bam-cc-disabled');
        }
        if (!holder.querySelector('.bam-cc-blocked')) {
          if (getComputedStyle(holder).position === 'static') {
            holder.style.position = 'relative';
          }
          const ph = document.createElement('div');
          ph.className = 'bam-cc-blocked';
          ph.innerHTML =
            '<i class="bi bi-play-btn"></i>' +
            '<p>This video is hosted on YouTube, which may set its own cookies. ' +
            'Allow functional cookies to play it here.</p>' +
            '<button type="button" data-bam-allow-video>Allow and play video</button>';
          ph.querySelector('[data-bam-allow-video]').addEventListener('click', e => {
            e.stopPropagation();
            const p = Object.assign({}, prefs(), { functional: true });
            save(p);
            syncToggles();
          });
          holder.appendChild(ph);
        }
      });
  }

  function applyConsent(p) {
    gateEmbeds(!!p.functional);
    document.documentElement.dataset.bamConsent =
      [p.essential && 'essential', p.functional && 'functional', p.analytics && 'analytics']
        .filter(Boolean).join(' ');

    /* Analytics hook.
       No analytics tool is installed on this site today. When one is added,
       load it here so it can never run before consent:

       if (p.analytics && !window.__bamAnalyticsLoaded) {
         window.__bamAnalyticsLoaded = true;
         const s = document.createElement('script');
         s.async = true;
         s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX';
         document.head.appendChild(s);
       }
    */
  }

  /* ---------------- markup ---------------- */

  function buildUI() {
    if (document.querySelector('.bam-cc')) return;

    const banner = document.createElement('div');
    banner.className = 'bam-cc';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div class="bam-cc-inner">' +
        '<div class="bam-cc-icon"><i class="bi bi-shield-check"></i></div>' +
        '<div class="bam-cc-text">' +
          '<h4>We respect your privacy</h4>' +
          '<p>This site uses only what it needs to work. We do not track you across other websites, ' +
          'and we set no advertising cookies. You can accept, decline, or choose exactly what to allow. ' +
          'Read our <a href="cookie-policy.html">Cookie Policy</a>.</p>' +
        '</div>' +
        '<div class="bam-cc-actions">' +
          '<button type="button" class="bam-cc-btn bam-cc-manage" data-bam="manage">Manage</button>' +
          '<button type="button" class="bam-cc-btn bam-cc-reject" data-bam="reject">Decline</button>' +
          '<button type="button" class="bam-cc-btn bam-cc-accept" data-bam="accept">Accept All</button>' +
        '</div>' +
      '</div>';

    const overlay = document.createElement('div');
    overlay.className = 'bam-cc-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Cookie preferences');
    overlay.innerHTML =
      '<div class="bam-cc-modal">' +
        '<div class="bam-cc-modal-head">' +
          '<div>' +
            '<h3>Cookie Preferences</h3>' +
            '<p>Choose what you allow. Your choice is saved on this device and you can change it at any time.</p>' +
          '</div>' +
          '<button type="button" class="bam-cc-close" data-bam="close" aria-label="Close">&times;</button>' +
        '</div>' +

        '<div class="bam-cc-modal-body">' +

          '<div class="bam-cc-group">' +
            '<div class="bam-cc-group-top">' +
              '<h5>Strictly Necessary</h5>' +
              '<span class="bam-cc-always">Always On</span>' +
            '</div>' +
            '<p>Required for the site to function: remembering this cookie choice, keeping a form ' +
            'submission secure, and limiting automated spam. These store nothing that identifies you ' +
            'and cannot be switched off.</p>' +
          '</div>' +

          '<div class="bam-cc-group">' +
            '<div class="bam-cc-group-top">' +
              '<h5>Functional</h5>' +
              '<label class="bam-cc-switch">' +
                '<input type="checkbox" data-bam-pref="functional" aria-label="Allow functional cookies">' +
                '<span class="bam-cc-slider"></span>' +
              '</label>' +
            '</div>' +
            '<p>Enables the embedded YouTube video and saves a CV Builder draft on your own device so ' +
            'you do not lose your work. Your CV draft never leaves your browser unless you submit an ' +
            'application. Declining keeps the video blocked.</p>' +
          '</div>' +

          '<div class="bam-cc-group">' +
            '<div class="bam-cc-group-top">' +
              '<h5>Analytics</h5>' +
              '<label class="bam-cc-switch">' +
                '<input type="checkbox" data-bam-pref="analytics" aria-label="Allow analytics cookies">' +
                '<span class="bam-cc-slider"></span>' +
              '</label>' +
            '</div>' +
            '<p>Anonymous statistics about which pages and vacancies are viewed, so we can improve the ' +
            'site. <strong>No analytics tool is currently installed</strong>, so this setting has no ' +
            'effect today. It is here so that nothing can start collecting data without your permission.</p>' +
          '</div>' +

        '</div>' +

        '<div class="bam-cc-modal-foot">' +
          '<button type="button" class="bam-cc-btn bam-cc-reject" data-bam="reject">Decline All</button>' +
          '<button type="button" class="bam-cc-btn bam-cc-manage" data-bam="savePrefs">Save My Choices</button>' +
          '<button type="button" class="bam-cc-btn bam-cc-accept" data-bam="accept">Accept All</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);
    document.body.appendChild(overlay);

    /* events */
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-bam]');
      if (!btn) return;
      const act = btn.dataset.bam;

      if (act === 'accept') {
        save({ essential: true, functional: true, analytics: true });
        closeAll();
      } else if (act === 'reject') {
        save({ essential: true, functional: false, analytics: false });
        closeAll();
      } else if (act === 'savePrefs') {
        const p = { essential: true };
        overlay.querySelectorAll('[data-bam-pref]').forEach(i => {
          p[i.dataset.bamPref] = i.checked;
        });
        save(p);
        closeAll();
      } else if (act === 'manage') {
        syncToggles();
        overlay.classList.add('show');
      } else if (act === 'close') {
        overlay.classList.remove('show');
        // If they have never chosen, keep the banner visible.
        if (!load()) banner.classList.add('show');
      }
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
        if (!load()) banner.classList.add('show');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        overlay.classList.remove('show');
        if (!load()) banner.classList.add('show');
      }
    });
  }

  function syncToggles() {
    const p = prefs();
    document.querySelectorAll('[data-bam-pref]').forEach(i => {
      i.checked = !!p[i.dataset.bamPref];
    });
  }

  function closeAll() {
    const b = document.querySelector('.bam-cc');
    const o = document.querySelector('.bam-cc-overlay');
    if (b) b.classList.remove('show');
    if (o) o.classList.remove('show');
  }

  /* ---------------- public API ---------------- */

  window.BamConsent = {
    allows: cat => !!prefs()[cat],
    get: () => Object.assign({}, prefs()),
    onChange: fn => { if (typeof fn === 'function') listeners.push(fn); },
    reopen: () => {
      buildUI();
      syncToggles();
      document.querySelector('.bam-cc-overlay').classList.add('show');
    },
    reset: () => {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = null;
      applyConsent(DEFAULTS);
      buildUI();
      document.querySelector('.bam-cc').classList.add('show');
    },
    recordedAt: () => (state && state.date) ? state.date : null
  };

  /* ---------------- start ---------------- */

  function init() {
    buildUI();
    state = load();

    if (state) {
      applyConsent(state.prefs);      // honour the saved choice
    } else {
      applyConsent(DEFAULTS);         // block everything non-essential
      setTimeout(() => {
        const b = document.querySelector('.bam-cc');
        if (b) b.classList.add('show');
      }, 700);
    }

    // Any element with data-bam-cookie-settings opens the dialog (footer link).
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-bam-cookie-settings]');
      if (t) { e.preventDefault(); window.BamConsent.reopen(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
