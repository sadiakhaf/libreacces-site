/*
 * connect.js — Studio Libre Accès
 * Estimator calculator and mobile nav.
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
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.hidden = true;
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Stepper logic ──
  const pageStepper = document.querySelector('.stepper[data-target="pages"]');
  let pages = 5;

  if (pageStepper) {
    const btnMinus = pageStepper.querySelector('.stepper__btn--minus');
    const btnPlus  = pageStepper.querySelector('.stepper__btn--plus');
    const valEl    = pageStepper.querySelector('.stepper__value');

    const min = 1;
    const max = 20;

    function updateDisplay() {
      valEl.textContent = pages;
      updateEstimate();
    }

    btnMinus.addEventListener('click', () => {
      if (pages > min) { pages--; updateDisplay(); }
    });

    btnPlus.addEventListener('click', () => {
      if (pages < max) { pages++; updateDisplay(); }
    });
  }

  // ── Add-on checkboxes ──
  document.querySelectorAll('.check-pill input[type="checkbox"]').forEach(cb => {
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
    let addonsTotal = 0;
    document.querySelectorAll('.check-pill input[type="checkbox"]:checked').forEach(cb => {
      addonsTotal += parseInt(cb.dataset.cost, 10);
    });

    const care = selectCare ? parseInt(selectCare.value, 10) : 300;
    const scale = selectScale ? parseFloat(selectScale.value) : 1;
    const timeline = selectTimeline ? parseFloat(selectTimeline.value) : 1;

    const siteCost = pages <= 5 ? 900 : 900 + (pages - 5) * 100;
    const total = Math.round((siteCost + addonsTotal + care) * scale * timeline);

    if (estimateValue) {
      estimateValue.textContent = '$' + total.toLocaleString('en-CA');
    }

    const budgetField = document.getElementById('inq-budget');
    const pagesField  = document.getElementById('inq-pages');
    if (budgetField) budgetField.value = '$' + total.toLocaleString('en-CA');
    if (pagesField)  pagesField.value  = pages;
  }

  updateEstimate();

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