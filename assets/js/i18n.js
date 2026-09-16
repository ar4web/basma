(function () {
  "use strict";
  var dictEn = {};
  var dictLoaded = false;

  function loadDicts() {
    fetch('assets/i18n/en.json').then(function(r){ return r.json(); }).then(function(d){ dictEn = d; dictLoaded = true; translatePage(); }).catch(function() {});
  }

  function translatePage() {
    if (!dictLoaded) return;
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = resolveKey(dictEn, key);
      if (val !== undefined) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (!el.value || el.dataset.i18nPlaceholder) {
            el.placeholder = val;
          }
          if (el.dataset.i18nValue) el.value = val;
        } else {
          el.innerHTML = val;
        }
      }
    });
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

  window.BAM_t = function (key, fallback, vars) {
    var val = resolveKey(dictEn, key);
    if (val === undefined) val = (fallback !== undefined) ? fallback : key;
    if (vars) {
      for (var k in vars) {
        if (vars.hasOwnProperty(k)) val = String(val).split('{' + k + '}').join(vars[k]);
      }
    }
    return val;
  };

  function addStyles() {
    var style = document.createElement('style');
    style.textContent = '';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { addStyles(); loadDicts(); });
  } else {
    addStyles(); loadDicts();
  }
})();