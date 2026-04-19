
import { apiFetch } from './api.js';
import { showToast, requireLogin } from './app.js';

requireLogin('private-onboarding.html');

const form = document.getElementById('privateWizard');
const steps = Array.from(document.querySelectorAll('.wizard-step'));
const indicators = Array.from(document.querySelectorAll('[data-step-indicator]'));
const otherDomainWrap = document.getElementById('otherDomainWrap');
const activityDomain = document.getElementById('activityDomain');
const summarySection = document.getElementById('wizardSummary');
const summaryContent = document.getElementById('summaryContent');
const stepper = document.querySelector('.stepper');

let currentStep = 0;
let accountUser = null;

function updateSteps() {
  steps.forEach((step, index) => {
    const active = index === currentStep;
    step.classList.toggle('is-active', active);
    step.hidden = !active;
  });

  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index === currentStep);
    indicator.classList.toggle('is-done', index < currentStep);
  });
}

function getVisibleFields(stepIndex) {
  const activeStep = steps[stepIndex];
  if (!activeStep) return [];
  return Array.from(activeStep.querySelectorAll('input, select, textarea')).filter((field) => {
    if (field.type === 'button' || field.type === 'submit' || field.type === 'hidden') return false;
    if (field.disabled) return false;
    if (field.closest('[hidden]')) return false;
    return true;
  });
}

function validateStep(stepIndex) {
  const fields = getVisibleFields(stepIndex);
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function syncConditionalFields() {
  const isOther = activityDomain?.value === 'Autre';
  if (otherDomainWrap) otherDomainWrap.hidden = !isOther;
  const otherField = document.getElementById('otherDomain');
  if (otherField) otherField.required = Boolean(isOther);
}

activityDomain?.addEventListener('change', syncConditionalFields);
syncConditionalFields();

for (const btn of document.querySelectorAll('[data-next]')) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    currentStep = Math.min(currentStep + 1, steps.length - 1);
    updateSteps();
  });
}

for (const btn of document.querySelectorAll('[data-prev]')) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    currentStep = Math.max(currentStep - 1, 0);
    updateSteps();
  });
}

async function prefillFromAccount() {
  try {
    const me = await apiFetch('/auth/me');
    accountUser = me?.user || {};

    const organization = accountUser.organization || accountUser.organizationName || '';
    const fullName = accountUser.full_name || accountUser.fullName || '';
    const email = accountUser.email || '';
    const phone = accountUser.phone_full || accountUser.phoneFull || accountUser.phone_number || accountUser.phoneNumber || '';

    const companyField = document.getElementById('companyName');
    const nameField = document.getElementById('fullName');
    const contactMethodField = document.getElementById('contactMethod');
    const contactValueField = document.getElementById('contactValue');

    if (companyField && !companyField.value) companyField.value = organization;
    if (nameField && !nameField.value) nameField.value = fullName;

    if (contactMethodField && !contactMethodField.value) {
      if (phone) contactMethodField.value = 'Téléphone';
      else if (email) contactMethodField.value = 'Mail';
    }

    if (contactValueField && !contactValueField.value) {
      contactValueField.value = phone || email || '';
    }
  } catch (error) {
    console.warn('Préremplissage indisponible', error);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const data = new FormData(form);
  const domain = data.get('activityDomain') === 'Autre' ? data.get('otherDomain') : data.get('activityDomain');
  const payload = {
    domain: String(domain || '').trim(),
    companyName: String(data.get('companyName') || '').trim(),
    fullName: String(data.get('fullName') || '').trim(),
    contactMethod: String(data.get('contactMethod') || '').trim(),
    contactValue: String(data.get('contactValue') || '').trim(),
    requestType: String(data.get('requestType') || '').trim(),
    requestDetails: String(data.get('requestDetails') || '').trim()
  };

  const accountEmail = String(accountUser?.email || '').trim();
  const accountPhone = String(accountUser?.phone_full || accountUser?.phoneFull || accountUser?.phone_number || accountUser?.phoneNumber || '').trim();

  const requesterEmail = payload.contactMethod === 'Mail' && payload.contactValue.includes('@')
    ? payload.contactValue
    : accountEmail;
  const requesterPhone = payload.contactMethod === 'Téléphone' || payload.contactMethod === 'WhatsApp'
    ? payload.contactValue
    : accountPhone;

  try {
    await apiFetch('/client/message', {
      method: 'POST',
      body: {
        companyName: payload.companyName,
        requesterName: payload.fullName,
        requesterEmail,
        requesterPhone,
        needText: [
          `Domaine d'activité : ${payload.domain || '-'}`,
          `Structure : ${payload.companyName || '-'}`,
          `Contact préféré : ${payload.contactMethod || '-'}`,
          `Coordonnée : ${payload.contactValue || '-'}`,
          `Type de besoin : ${payload.requestType || '-'}`,
          '',
          'Détails :',
          payload.requestDetails || '-'
        ].join('\n')
      }
    });

    summaryContent.innerHTML = [
      `<p><strong>Domaine :</strong> ${payload.domain || '-'}</p>`,
      `<p><strong>Structure :</strong> ${payload.companyName || '-'}</p>`,
      `<p><strong>Contact :</strong> ${payload.fullName || '-'} — ${payload.contactMethod || '-'} : ${payload.contactValue || '-'}</p>`,
      `<p><strong>Besoin :</strong> ${payload.requestType || '-'}</p>`,
      `<p><strong>Détails :</strong><br>${String(payload.requestDetails || '-').replace(/\n/g, '<br>')}</p>`,
      `<p style="margin-top:12px"><strong>Message transmis.</strong> Un conseiller POPE Online vous contactera rapidement.</p>`
    ].join('');

    form.hidden = true;
    if (stepper) stepper.hidden = true;
    summarySection.hidden = false;
    showToast('Message transmis', 'ok');
  } catch (error) {
    console.error(error);
    showToast('Envoi impossible', 'err');
    alert(`Votre demande n’a pas pu être transmise pour le moment. ${error?.data?.error || error.message || ''}`.trim());
  }
});

updateSteps();
prefillFromAccount();
