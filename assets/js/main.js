/**
* Template Name: HeroBiz
* Template URL: https://bootstrapmade.com/herobiz-bootstrap-business-template/
* Updated: Aug 07 2024 with Bootstrap v5.3.3
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/

(function() {
  "use strict";

  /**
   * Smart Header - Auto-hide on scroll down, show on scroll up/stop
   */
  let lastScrollY = window.scrollY;
  let ticking = false;
  let scrollTimeout;
  const header = document.querySelector('#header');
  const marqueeHeight = 36; // matches --marquee-height

  function updateHeader() {
    if (!header) return;
    
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY;
    
    // Add/remove scrolled class for styling
    if (currentScrollY > 100) {
      document.body.classList.add('scrolled');
    } else {
      document.body.classList.remove('scrolled');
    }
    
    // Determine header visibility
    if (currentScrollY <= marqueeHeight) {
      // Near top - always show
      header.classList.remove('header-hidden');
      header.classList.add('header-visible');
    } else if (scrollDelta > 5) {
      // Scrolling down - hide header
      header.classList.add('header-hidden');
      header.classList.remove('header-visible');
    } else if (scrollDelta < -5) {
      // Scrolling up - show header
      header.classList.remove('header-hidden');
      header.classList.add('header-visible');
    }
    
    lastScrollY = currentScrollY;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
    
    // Show header when user stops scrolling
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (header && window.scrollY > marqueeHeight) {
        header.classList.remove('header-hidden');
        header.classList.add('header-visible');
      }
    }, 200); // Show after 200ms of no scrolling
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', () => {
    if (header) {
      header.classList.add('header-visible');
    }
  });

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    if (mobileNavToggleBtn) {
      mobileNavToggleBtn.classList.toggle('bi-list');
      mobileNavToggleBtn.classList.toggle('bi-x');
    }
  }
  if (mobileNavToggleBtn) mobileNavToggleBtn.addEventListener('click', mobileNavToogle);

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active')) {
        mobileNavToogle();
      }
    });

  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  // Guarded, because toggleScrollTop above already treats this element as
  // optional. Binding without a guard would throw on any page that omits it.
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('load', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 450,
      easing: 'ease-out-cubic',
      offset: 40,
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  if (typeof GLightbox !== 'undefined') {
    GLightbox({ selector: '.glightbox' });
  }

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    if (typeof Swiper === 'undefined') return;
    document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Frequently Asked Questions Toggle
   */
  document.querySelectorAll('.faq-item h3, .faq-item .faq-toggle').forEach((faqItem) => {
    faqItem.addEventListener('click', () => {
      faqItem.parentNode.classList.toggle('faq-active');
    });
  });

  /**
   * Init isotope layout and filters
   */
  document.querySelectorAll('.isotope-layout').forEach(function(isotopeItem) {
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    if (typeof imagesLoaded === 'undefined' || typeof Isotope === 'undefined') return;
    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function() {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function(filters) {
      filters.addEventListener('click', function() {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

  });

  /**
   * Correct scrolling position upon page load for URLs containing hash links.
   */
  window.addEventListener('load', function(e) {
    if (window.location.hash) {
      if (document.querySelector(window.location.hash)) {
        setTimeout(() => {
          let section = document.querySelector(window.location.hash);
          let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
          window.scrollTo({
            top: section.offsetTop - parseInt(scrollMarginTop),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  });

  /**
   * Navmenu Scrollspy
   */
  let navmenulinks = document.querySelectorAll('.navmenu a');

  // Resolve each link to its section once, instead of running a
  // document.querySelector per link on every scroll event.
  const spyTargets = [];
  navmenulinks.forEach(link => {
    if (!link.hash || link.hash === '#') return;
    let section = null;
    try { section = document.querySelector(link.hash); } catch (e) { return; }
    if (section) spyTargets.push({ link: link, section: section });
  });

  function navmenuScrollspy() {
    const position = window.scrollY + 200;
    let current = null;

    // Read first, write second. Interleaving offsetTop reads with class
    // changes forces the browser to re-run layout between each one.
    for (const t of spyTargets) {
      const top = t.section.offsetTop;
      if (position >= top && position <= top + t.section.offsetHeight) current = t.link;
    }

    for (const t of spyTargets) {
      t.link.classList.toggle('active', t.link === current);
    }
  }
  window.addEventListener('load', navmenuScrollspy);

  /**
   * One passive, rAF-throttled scroll listener for all three handlers.
   *
   * These used to be three separate non-passive listeners, each running on
   * every scroll event. A non-passive listener forces the browser to wait
   * and see whether the handler calls preventDefault before it may scroll,
   * and navmenuScrollspy reads offsetTop/offsetHeight, which forces a
   * synchronous layout. Doing that on every event is the standard cause of
   * scroll jank.
   *
   * Now the work is coalesced into a single animation frame, so it runs at
   * most once per painted frame no matter how fast the events arrive, and
   * { passive: true } tells the browser it can scroll immediately.
   */
  let scrollQueued = false;
  function onScrollFrame() {
    scrollQueued = false;
    toggleScrolled();
    toggleScrollTop();
    navmenuScrollspy();
  }
  document.addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(onScrollFrame);
  }, { passive: true });

  const contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if ((this.website && this.website.value) || !this.checkValidity()) return;
      const body = [
        'Name: ' + this.name.value.trim(),
        'Company: ' + this.subject.value.trim(),
        'Email: ' + this.email.value.trim(),
        'Phone: ' + (this.phone.value.trim() || '—'),
        '',
        this.message.value.trim()
      ].join('\n');
      window.location.href = 'mailto:info@basmatalmawared.com?subject=' +
        encodeURIComponent('Manpower request — ' + this.subject.value.trim()) +
        '&body=' + encodeURIComponent(body);
      const sent = this.querySelector('.sent-message');
      if (sent) sent.classList.add('d-block');
    });
  }

  /* =========================================================
     FOOTER PROJECT SETUP FORM
     ========================================================= */
  const footerForm = document.querySelector('#footer-project-form');
  if (footerForm) {
    // Goal radio button visual selection
    const goalLabels = footerForm.querySelectorAll('.goal-option');
    goalLabels.forEach(label => {
      label.addEventListener('click', function() {
        const input = this.querySelector('input[type="radio"]');
        if (input) {
          input.checked = true;
          goalLabels.forEach(l => l.classList.remove('active'));
          this.classList.add('active');
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    // Initial active state
    const checkedGoal = footerForm.querySelector('input[name="goal"]:checked');
    if (checkedGoal) {
      checkedGoal.closest('.goal-option').classList.add('active');
    }

    footerForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // Validate
      const email = this.querySelector('#form-email');
      const type = this.querySelector('#form-type');
      const goal = this.querySelector('input[name="goal"]:checked');
      const brief = this.querySelector('#form-brief');

      let valid = true;
      if (!email.value || !email.checkValidity()) {
        email.classList.add('is-invalid');
        valid = false;
      } else { email.classList.remove('is-invalid'); }

      if (!type.value) {
        type.classList.add('is-invalid');
        valid = false;
      } else { type.classList.remove('is-invalid'); }

      if (!goal) {
        this.querySelectorAll('.goal-option').forEach(l => l.style.borderColor = 'var(--color-danger, #dc3545)');
        valid = false;
      } else {
        this.querySelectorAll('.goal-option').forEach(l => l.style.borderColor = '');
      }

      if (!brief.value || brief.value.trim().length < 30) {
        brief.classList.add('is-invalid');
        valid = false;
      } else { brief.classList.remove('is-invalid'); }

      if (!valid) return;

      // Build mailto
      const body = [
        'Project Type: ' + type.options[type.selectedIndex].text,
        'Primary Goal: ' + goal.value.charAt(0).toUpperCase() + goal.value.slice(1),
        'Brief: ' + brief.value.trim(),
        '',
        'Submitted by: ' + email.value.trim()
      ].join('\n');

      window.location.href = 'mailto:info@basmatalmawared.com?subject=' +
        encodeURIComponent('New Project Setup — ' + type.options[type.selectedIndex].text) +
        '&body=' + encodeURIComponent(body);

      // Show success toast
      const formCard = this.closest('.footer-form-card');
      const toast = document.getElementById('form-success-toast');
      if (toast) {
        toast.classList.remove('d-none');
        toast.style.animation = 'slideIn 0.3s ease';
        setTimeout(() => {
          toast.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => toast.classList.add('d-none'), 300);
        }, 4000);
      }

      // Reset
      this.reset();
      document.querySelectorAll('.goal-option').forEach(l => l.classList.remove('active'));
    });
  }

})();
