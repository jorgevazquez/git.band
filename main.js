'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ─── Custom cursor ────────────────────────────────────────────────────
  const cursor = document.querySelector('.cursor');
  if (cursor) {
    document.addEventListener('mousemove', e => {
      cursor.style.left = (e.clientX - 6) + 'px';
      cursor.style.top  = (e.clientY - 6) + 'px';
    });

    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
    });
  }

  // ─── Hamburger menu toggle ────────────────────────────────────────────
  const burger = document.querySelector('.nav-burger');
  const navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      navLinks.classList.toggle('is-open');
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
      });
    });
  }

  // ─── Hero slideshow ───────────────────────────────────────────────────
  const slides = Array.from(document.querySelectorAll('.hero-slide'));
  let currentIndex = 0;

  if (slides.length > 1) {
    setInterval(() => {
      slides[currentIndex].classList.remove('is-active');
      currentIndex = (currentIndex + 1) % slides.length;
      void slides[currentIndex].offsetWidth;
      slides[currentIndex].classList.add('is-active');
    }, 7000);
  }


  // ─── Active nav link via IntersectionObserver ─────────────────────────
  const sections = Array.from(
    document.querySelectorAll('#hero, #music, #shows, #about, #contact')
  );
  const navLinkItems = Array.from(document.querySelectorAll('.nav-link'));

  const setActiveLink = (id) => {
    navLinkItems.forEach(link => {
      if (link.getAttribute('href') === `#${id}`) {
        link.classList.add('is-active');
      } else {
        link.classList.remove('is-active');
      }
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActiveLink(entry.target.id);
      }
    });
  }, {
    rootMargin: '-50% 0px -50% 0px',
    threshold: 0
  });

  sections.forEach(section => observer.observe(section));


  // ─── Nav background opacity on scroll ──────────────────────────────────
  const siteNav = document.getElementById('site-nav');
  const heroSection = document.getElementById('hero');

  const updateNavStyle = () => {
    const threshold = heroSection ? heroSection.offsetHeight * 0.5 : 300;
    if (window.scrollY > threshold) {
      siteNav.classList.add('is-scrolled');
    } else {
      siteNav.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', updateNavStyle, { passive: true });
  updateNavStyle();


  // ─── Footer year ──────────────────────────────────────────────────────
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }


  // ─── Cookie preferences ───────────────────────────────────────────────
  const COOKIE_PREFS_KEY = 'git-band-cookie-prefs';
  const COOKIE_CONSENT_KEY = 'git-band-cookie-consent';

  const cookieModal = document.getElementById('cookie-modal');
  const cookieBackdrop = document.getElementById('cookie-backdrop');
  const cookieClose = document.getElementById('cookie-close');
  const cookieAccept = document.getElementById('cookie-accept');
  const cookieReject = document.getElementById('cookie-reject');
  const cookieSave = document.getElementById('cookie-save');
  const cookieLink = document.querySelector('.cookie-link');

  const getStoredPreferences = () => {
    const stored = localStorage.getItem(COOKIE_PREFS_KEY);
    return stored ? JSON.parse(stored) : null;
  };

  const openCookieModal = () => {
    cookieModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const closeCookieModal = () => {
    cookieModal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  const saveCookiePreferences = (prefs) => {
    localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(prefs));
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    applyConsentSettings(prefs);
    closeCookieModal();
  };

  const applyConsentSettings = (prefs) => {
    if (prefs.analytics) {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': prefs.marketing ? 'granted' : 'denied'
      });
    }
  };

  const getCheckboxState = () => {
    return {
      essential: true,
      analytics: document.querySelector('input[name="analytics"]').checked,
      marketing: document.querySelector('input[name="marketing"]').checked
    };
  };

  const setCheckboxState = (prefs) => {
    if (prefs) {
      document.querySelector('input[name="analytics"]').checked = prefs.analytics !== false;
      document.querySelector('input[name="marketing"]').checked = prefs.marketing === true;
    }
  };

  // Initialize cookies on page load
  const storedPrefs = getStoredPreferences();
  if (!storedPrefs) {
    openCookieModal();
  } else {
    setCheckboxState(storedPrefs);
    applyConsentSettings(storedPrefs);
  }

  // Event listeners
  if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
      saveCookiePreferences({
        essential: true,
        analytics: true,
        marketing: true
      });
    });
  }

  if (cookieReject) {
    cookieReject.addEventListener('click', () => {
      saveCookiePreferences({
        essential: true,
        analytics: false,
        marketing: false
      });
    });
  }

  if (cookieSave) {
    cookieSave.addEventListener('click', () => {
      saveCookiePreferences(getCheckboxState());
    });
  }

  if (cookieClose) {
    cookieClose.addEventListener('click', closeCookieModal);
  }

  if (cookieBackdrop) {
    cookieBackdrop.addEventListener('click', closeCookieModal);
  }

  if (cookieLink) {
    cookieLink.addEventListener('click', (e) => {
      e.preventDefault();
      setCheckboxState(getStoredPreferences());
      openCookieModal();
    });
  }

  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cookieModal.classList.contains('is-open')) {
      closeCookieModal();
    }
  });

});
