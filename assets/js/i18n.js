(function () {
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'bam_lang';
  var currentLang = DEFAULT_LANG;
  var dictEn = {};
  var dictAr = {};
  var dictLoaded = { en: false, ar: false };

  function getPreferredLang() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
    var browser = navigator.language || navigator.userLanguage;
    if (browser && browser.startsWith('ar')) return 'ar';
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    var html = document.documentElement;
    html.setAttribute('lang', lang === 'ar' ? 'ar-SA' : 'en');
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.classList.toggle('active', lang === 'ar');
      // Update toggle innerHTML to show only the active language
      if (lang === 'ar') {
        toggle.innerHTML = '<span class="lang-label active" data-i18n-lang="ar">AR</span>';
        toggle.setAttribute('aria-label', 'Switch to English');
      } else {
        toggle.innerHTML = '<span class="lang-label active" data-i18n-lang="en">EN</span>';
        toggle.setAttribute('aria-label', 'Toggle to Arabic');
      }
    }
    translatePage();
  }

  function getCurrentDict() {
    if (currentLang === 'ar') {
      // Merge: start with English, overlay Arabic so missing keys fall back to English
      var merged = {};
      deepMerge(merged, dictEn);
      deepMerge(merged, dictAr);
      return merged;
    }
    return dictEn;
  }

  function deepMerge(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  function loadDicts() {
    Promise.all([
      fetch('assets/i18n/en.json').then(function(r){ return r.json(); }).then(function(d){ dictEn = d; dictLoaded.en = true; }),
      fetch('assets/i18n/ar.json').then(function(r){ return r.json(); }).then(function(d){ dictAr = d; dictLoaded.ar = true; })
    ]).catch(function() {});
  }

  function translatePage() {
    if (!dictLoaded.en && !dictLoaded.ar) return;
    var dict = getCurrentDict();
    applyTranslations(dict);
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = resolveKey(dict, key);
      if (val !== undefined) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (!el.value || el.dataset.i18nPlaceholder) {
            el.placeholder = val;
          }
          if (el.dataset.i18nValue) el.value = val;
        } else if (el.tagName === 'TIME') {
          // keep datetime, update text
        } else {
          el.innerHTML = val;
        }
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var val = resolveKey(dict, key);
      if (val !== undefined) el.title = val;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      var val = resolveKey(dict, key);
      if (val !== undefined) el.alt = val;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var val = resolveKey(dict, key);
      if (val !== undefined) el.setAttribute('aria-label', val);
    });
    document.querySelectorAll('[data-i18n-lang]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-lang');
      if (key === currentLang) {
        el.style.fontWeight = '700';
        el.style.color = 'var(--accent-color)';
      } else {
        el.style.fontWeight = '';
        el.style.color = '';
      }
    });
    // Update lang toggle button labels
    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
      var enLabel = toggle.querySelector('[data-i18n-lang="en"]');
      var arLabel = toggle.querySelector('[data-i18n-lang="ar"]');
      // The labels are static EN/AR, just update active styling via CSS class
    }
  }

  function resolveKey(dict, key) {
    var parts = key.split('.');
    var val = dict;
    for (var i = 0; i < parts.length; i++) {
      if (val && typeof val === 'object' && parts[i] in val) {
        val = val[parts[i]];
      } else {
        return undefined;
      }
    }
    return typeof val === 'string' ? val : undefined;
  }

  function createToggle() {
    var header = document.querySelector('.header .container-fluid');
    if (!header) return;
    var toggle = document.createElement('div');
    toggle.id = 'lang-toggle';
    toggle.className = 'lang-switch';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    // Set initial language labels based on current language - show ONLY the active language
    if (currentLang === 'ar') {
      toggle.innerHTML = '<span class="lang-label active" data-i18n-lang="ar">AR</span>';
      toggle.setAttribute('aria-label', 'Switch to English');
    } else {
      toggle.innerHTML = '<span class="lang-label active" data-i18n-lang="en">EN</span>';
      toggle.setAttribute('aria-label', 'Toggle to Arabic');
    }
    toggle.addEventListener('click', function () {
      setLang(currentLang === 'ar' ? 'en' : 'ar');
    });
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLang(currentLang === 'ar' ? 'en' : 'ar'); }
    });
    // Place toggle before the main logo (works for both mobile and desktop)
    var logo = header.querySelector('.logo');
    if (logo) {
      header.insertBefore(toggle, logo);
    } else if (header.firstChild) {
      header.insertBefore(toggle, header.firstChild);
    } else {
      header.appendChild(toggle);
    }
  }

  function addStyles() {
    var style = document.createElement('style');
    style.textContent = '.lang-switch{display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer;transition:all 150ms ease-in-out;color:var(--nav-color);user-select:none;flex-shrink:0;} .lang-switch:hover{color:var(--nav-hover-color);background:rgba(139,108,56,0.08);} .lang-label{font-family:var(--nav-font);} .lang-divider{color:var(--text-faint);font-size:11px;} .lang-switch.active{color:var(--accent-color);background:rgba(139,108,56,0.1);}[dir="rtl"] .lang-divider{margin:0 2px;}[dir="rtl"] .lang-label{font-family:"Inter","Segoe UI","Helvetica Neue","Noto Sans",Arial,sans-serif;}';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { addStyles(); createToggle(); loadDicts(); setLang(getPreferredLang()); });
  } else {
    addStyles(); createToggle(); loadDicts(); setLang(getPreferredLang());
  }
})();
