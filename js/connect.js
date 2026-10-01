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

  async function submitForm(form, endpoint, feedbackId) {
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

      // The estimate form uses name="details"; the API expects "message"
      if (endpoint === '/api/estimate' && payload.details) {
        payload.message = payload.details;
        delete payload.details;
      }

      // Collect multi-select / checkboxes as arrays if needed
      if (endpoint === '/api/estimate') {
        const addonLabels = [];
        form.querySelectorAll('.check-pill input[type="checkbox"]:checked').forEach(cb => {
          addonLabels.push(cb.closest('label').textContent.trim());
        });
        payload.addons = addonLabels.join(', ');
        payload.care_plan = form.querySelector('#est-care option:checked')?.textContent || payload.care_plan;
        payload.sliding_scale = form.querySelector('#est-scale option:checked')?.textContent || payload.sliding_scale;
        payload.timeline = form.querySelector('#est-timeline option:checked')?.textContent || payload.timeline;
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
          if (endpoint === '/api/estimate') {
            const pagesField = document.getElementById('inq-pages');
            const budgetField = document.getElementById('inq-budget');
            if (pagesField) pagesField.value = pages;
            if (budgetField) budgetField.value = '$' + estimateValue.textContent.replace(/[^0-9]/g, '');
          }
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

  submitForm(document.getElementById('inquire-form'), '/api/estimate', 'inq-feedback');
  submitForm(document.getElementById('contact-form'), '/api/contact', 'contact-feedback');

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