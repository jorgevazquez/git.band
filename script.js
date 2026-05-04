/* ============================================================
   git.band — script.js
   ============================================================ */

(function () {
  'use strict';

  /* ---- mobile nav toggle ---- */
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  /* close nav when a link is clicked (mobile) */
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* ---- nav shadow on scroll ---- */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,.5)' : '';
  }, { passive: true });

  /* ---- contact form ---- */
  const form  = document.getElementById('contactForm');
  const toast = document.getElementById('toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name    = form.name.value.trim();
    const email   = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      showToast('⚠️ Please fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('⚠️ Please enter a valid email address.');
      return;
    }

    /* Simulate sending */
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    setTimeout(() => {
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Send Message';
      showToast('✅ Message sent! We\'ll get back to you soon.');
    }, 1000);
  });

  /* ---- intersection observer: fade-in sections ---- */
  const style = document.createElement('style');
  style.textContent = `
    .fade-in { opacity: 0; transform: translateY(30px); transition: opacity .6s ease, transform .6s ease; }
    .fade-in.visible { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.album-card, .show-item, .member, .social-link').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });

})();
