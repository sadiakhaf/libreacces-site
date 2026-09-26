/*
 * connect.js — Studio Libre Accès
 * Estimator calculator, mobile nav, and inquiry form handling.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Mobile nav toggle ──
  const navToggle = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => {
      const open = mobileNav.hidden === false;
      mobileNav.hidden = open;
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    // close mobile nav when a link is clicked
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.hidden = true;
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Stepper logic ──
  document.querySelectorAll('.stepper').forEach(stepper => {
    const target = stepper.dataset.target;
    const btnMinus = stepper.querySelector('.stepper__btn--minus');
    const btnPlus  = stepper.querySelector('.stepper__btn--plus');
    const valEl    = stepper.querySelector('.stepper__value');
    let value = parseInt(valEl.textContent, 10);

    const min = target === 'pages' ? 1 : 0;
    const max = target === 'pages' ? 20 : 50;

    function update() {
      valEl.textContent = value;
      updateEstimate();
    }

    btnMinus.addEventListener('click', () => { if (value > min) { value--; update(); } });
    btnPlus.addEventListener('click',  () => { if (value < max) { value++; update(); } });
  });

  // ── Add-on checkboxes ──
  const addons = {};
  document.querySelectorAll('.check-pill input[type="checkbox"]').forEach(cb => {
    const key = cb.dataset.addon;
    const cost = parseInt(cb.dataset.cost, 10);
    addons[key] = cost;
    cb.addEventListener('change', updateEstimate);
  });

  // ── Select inputs ──
  const selectCare     = document.getElementById('est-care');
  const selectScale    = document.getElementById('est-scale');
  const selectTimeline = document.getElementById('est-timeline');

  [selectCare, selectScale, selectTimeline].forEach(sel => {
    if (sel) sel.addEventListener('change', updateEstimate);
  });

  // ── Estimate calculation ──
  const estimateValue = document.getElementById('estimate-value');

  function updateEstimate() {
    // Pages
    const pagesEl = document.querySelector('.stepper[data-target="pages"] .stepper__value');
    const pages = pagesEl ? parseInt(pagesEl.textContent, 10) : 5;

    // Add-ons total
    let addonsTotal = 0;
    document.querySelectorAll('.check-pill input[type="checkbox"]:checked').forEach(cb => {
      addonsTotal += parseInt(cb.dataset.cost, 10);
    });

    // Care plan
    const care = selectCare ? parseInt(selectCare.value, 10) : 300;

    // Scale multiplier
    const scale = selectScale ? parseFloat(selectScale.value) : 1;

    // Timeline multiplier
    const timeline = selectTimeline ? parseFloat(selectTimeline.value) : 1;

    // Base site cost: $900 for up to 5 pages, $100 per page beyond 5
    const siteCost = pages <= 5 ? 900 : 900 + (pages - 5) * 100;

    const total = Math.round((siteCost + addonsTotal + care) * scale * timeline);

    if (estimateValue) {
      estimateValue.textContent = '$' + total.toLocaleString('en-CA');
    }
  }

  // Initial calculation
  updateEstimate();

  // ── Inquiry form submission ──
  const form = document.getElementById('inquire-form');
  const toast = document.getElementById('inquire-toast');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Gather all estimator state
      const pagesEl = document.querySelector('.stepper[data-target="pages"] .stepper__value');
      const pages = pagesEl ? pagesEl.textContent : '5';

      const selectedAddons = [];
      document.querySelectorAll('.check-pill input[type="checkbox"]:checked').forEach(cb => {
        selectedAddons.push(cb.parentElement.textContent.trim());
      });

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.estPages = pages;
      data.estAddons = selectedAddons.join(', ');
      data.estCare = selectCare?.options[selectCare.selectedIndex]?.text || '';
      data.estScale = selectScale?.options[selectScale.selectedIndex]?.text || '';
      data.estTimeline = selectTimeline?.options[selectTimeline.selectedIndex]?.text || '';
      data.estBudget = estimateValue?.textContent || '';

      console.log('Inquiry submitted:', data);

      // Show success toast
      form.style.display = 'none';
      if (toast) toast.style.display = 'block';
    });
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});