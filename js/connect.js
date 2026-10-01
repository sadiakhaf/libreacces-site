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
  let pages = 1;

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

  // ── Add-on checkboxes (only the calculator ones, not the contact include box) ──
  document.querySelectorAll('.check-pill input[type="checkbox"][data-cost]').forEach(cb => {
    cb.addEventListener('change', updateEstimate);
  });

  // ── Select inputs ──
  const selectCare     = document.getElementById('est-care');
  const selectScale    = document.getElementById('est-scale');
  const selectTimeline = document.getElementById('est-timeline');

  [selectScale, selectTimeline].forEach(sel => {
    if (sel) sel.addEventListener('change', updateEstimate);
  });
  if (selectCare) selectCare.addEventListener('change', updateEstimate);

  // ── Estimate calculation ──
  const estimateValue = document.getElementById('estimate-value');

  function updateEstimate() {
    let addonsTotal = 0;
    document.querySelectorAll('.check-pill input[type="checkbox"][data-cost]:checked').forEach(cb => {
      addonsTotal += parseInt(cb.dataset.cost, 10);
    });

    const care = selectCare ? (selectCare.checked ? parseInt(selectCare.value, 10) : 0) : 0;
    const scale = selectScale ? parseFloat(selectScale.value) : 1;
    const timeline = selectTimeline ? parseFloat(selectTimeline.value) : 1;

    const siteCost = pages <= 1 ? 900 : 900 + (pages - 1) * 100;
    const total = Math.round((siteCost + addonsTotal + care) * scale * timeline);

    if (estimateValue) {
      estimateValue.textContent = 'CAD $' + total.toLocaleString('en-CA');
    }

    refreshEstimateHidden();
  }

  // ── Optional estimate sync into contact form hidden fields ──
  const includeEstimateCb = document.getElementById('include-estimate');

  function syncEstimateToContact(clear = false) {
    const budgetField   = document.getElementById('inq-budget');
    const pagesField    = document.getElementById('inq-pages');
    const careField     = document.getElementById('inq-care');
    const scaleField    = document.getElementById('inq-scale');
    const timelineField = document.getElementById('inq-timeline');
    const addonsField   = document.getElementById('inq-addons');

    if (clear) {
      if (budgetField) budgetField.value = '';
      if (pagesField) pagesField.value = '';
      if (careField) careField.value = '';
      if (scaleField) scaleField.value = '';
      if (timelineField) timelineField.value = '';
      if (addonsField) addonsField.value = '';
      return;
    }

    const budget = estimateValue ? estimateValue.textContent : '';
    const addonLabels = [];
    document.querySelectorAll('.check-pill input[type="checkbox"][data-cost]:checked').forEach(cb => {
      addonLabels.push(cb.closest('label').textContent.trim());
    });

    if (pagesField) pagesField.value = pages;
    if (budgetField) budgetField.value = budget;
    if (careField) careField.value = selectCare && selectCare.checked ? selectCare.closest('label').textContent.trim() : 'No care & rescue plan';
    if (scaleField) scaleField.value = selectScale ? selectScale.options[selectScale.selectedIndex].textContent : '';
    if (timelineField) timelineField.value = selectTimeline ? selectTimeline.options[selectTimeline.selectedIndex].textContent : '';
    if (addonsField) addonsField.value = addonLabels.join(', ');
  }

  // Refresh hidden estimate fields whenever the calculator changes, but only
  // populate them if the user has checked the include-estimate box.
  function refreshEstimateHidden() {
    if (includeEstimateCb && includeEstimateCb.checked) {
      syncEstimateToContact();
    }
  }

  if (includeEstimateCb) {
    includeEstimateCb.addEventListener('change', () => {
      syncEstimateToContact(!includeEstimateCb.checked);
    });
  }

  updateEstimate();

  // ── Form submissions ──
  function showFeedback(container, message, isError = false) {
    container.hidden = false;
    container.className = 'form-feedback' + (isError ? ' form-feedback--error' : ' form-feedback--success');
    container.textContent = message;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = busy ? 'Sending…' : button.dataset.originalText;
  }

  async function submitForm(form, endpoint, feedbackId, formType) {
    const feedback = document.getElementById(feedbackId);
    if (!form || !feedback) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true);
      feedback.hidden = true;

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Always send form_type so the worker can route/store correctly
      payload.form_type = formType;

      // If the user checked "Include my project goals", refresh hidden estimate
      // values right before submission so they match the calculator state.
      if (payload.include_estimate === 'yes') {
        syncEstimateToContact();
        const addonLabels = [];
        document.querySelectorAll('.check-pill input[type="checkbox"][data-cost]:checked').forEach(cb => {
          addonLabels.push(cb.closest('label').textContent.trim());
        });
        payload.addons = addonLabels.join(', ');
        payload.care_plan = selectCare && selectCare.checked ? selectCare.closest('label').textContent.trim() : 'No care & rescue plan';
        payload.sliding_scale = selectScale ? selectScale.options[selectScale.selectedIndex].textContent : payload.sliding_scale;
        payload.timeline = selectTimeline ? selectTimeline.options[selectTimeline.selectedIndex].textContent : payload.timeline;
        payload.estimated_budget = estimateValue ? estimateValue.textContent : payload.estimated_budget;
        payload.pages = String(pages);
      } else {
        // Don't send stale calculator values if the checkbox is unchecked.
        delete payload.estimated_budget;
        delete payload.pages;
        delete payload.care_plan;
        delete payload.sliding_scale;
        delete payload.timeline;
        delete payload.addons;
        delete payload.include_estimate;
        // Also clear hidden inputs so later submissions don't carry stale data.
        syncEstimateToContact(true);
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok) {
          showFeedback(feedback, data.message || 'Thank you! We\'ll get back to you within 48 hours.');
          form.reset();
          updateEstimate();
          syncEstimateToContact(true);
        } else {
          showFeedback(feedback, data.error || 'Something went wrong. Please try again or email us directly.', true);
        }
      } catch (err) {
        showFeedback(feedback, 'Network error. Please try again or email us directly at contact@libreacces.stream.', true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  submitForm(document.getElementById('contact-form'), '/api/contact', 'contact-feedback', 'contact');

  // ── Principle card flip interaction ──
  document.querySelectorAll('.principle-card').forEach(card => {
    card.addEventListener('click', () => {
      const flipped = card.classList.contains('is-flipped');
      card.classList.toggle('is-flipped', !flipped);
      card.setAttribute('aria-pressed', String(!flipped));
    });
  });

  // ── Scroll reveal animations ──
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    });

    document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .principle-card, section').forEach(el => {
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .principle-card, section').forEach(el => {
      el.classList.add('is-visible');
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