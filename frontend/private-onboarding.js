import { apiFetch } from './api.js';
import { showToast, requireLogin } from './app.js';

const form = document.getElementById('privateWizard');
const steps = Array.from(document.querySelectorAll('.wizard-step'));
const indicators = Array.from(document.querySelectorAll('[data-step-indicator]'));
const otherDomainWrap = document.getElementById('otherDomainWrap');
const activityDomain = document.getElementById('activityDomain');
const summarySection = document.getElementById('wizardSummary');
const summaryContent = document.getElementById('summaryContent');
let currentStep = 0;
let accountUser = null;

requireLogin('private-onboarding.html');

function updateSteps() {
  steps.forEach((step, index) => {
    step.classList.toggle('is-active', index === currentStep);
    step.hidden = index !== currentStep;
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
    if (field.type === 'button' || field.type === 'submit') return false;
    if (field.closest('[hidden]')) return false;
    return true;
  });
}

function validateStep(stepIndex) {
  const fields = getVisibleFields(stepIndex);
  let ok = true;
  fields.forEach((field) => {
    if (!field.checkValidity()) {
      field.reportValidity();
      ok = false;
    }
  });
  return ok;
}

activityDomain?.addEventListener('change', (e) => {
  const isOther = e.target.value === 'Autre';
  otherDomainWrap.hidden = !isOther;
  const otherField = document.getElementById('otherDomain');
  if (otherField) otherField.required = isOther;
});

document.addEventListener('click', (e) => {
  const nextBtn = e.target.closest('[data-next]');
  const prevBtn = e.target.closest('[data-prev]');

  if (nextBtn) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    currentStep = Math.min(currentStep + 1, steps.length - 1);
    updateSteps();
    return;
  }

  if (prevBtn) {
    e.preventDefault();
    currentStep = Math.max(currentStep - 1, 0);
    updateSteps();
  }
});

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

    if (companyField) companyField.value = companyField.value || organization;
    if (nameField) nameField.value = nameField.value || fullName;
    if (contactMethodField) {
      if (phone) contactMethodField.value = 'Téléphone';
      else if (email) contactMethodField.value = 'Mail';
    }
    if (contactValueField) {
      contactValueField.value = contactValueField.value || phone || email || '';
    }
  } catch (e) {
    console.warn('Préremplissage indisponible', e);
    showToast('Préremplissage indisponible pour le moment', 'warn');
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const data = new FormData(form);
  const domain = data.get('activityDomain') === 'Autre' ? data.get('otherDomain') : data.get('activityDomain');
  const payload = {
    domain,
    companyName: String(data.get('companyName') || '').trim(),
    fullName: String(data.get('fullName') || '').trim(),
    contactMethod: String(data.get('contactMethod') || '').trim(),
    contactValue: String(data.get('contactValue') || '').trim(),
    requestType: String(data.get('requestType') || '').trim(),
    requestDetails: String(data.get('requestDetails') || '').trim()
  };

  const accountEmail = String(accountUser?.email || '').trim();
  const accountPhone = String(accountUser?.phone_full || accountUser?.phoneFull || accountUser?.phone_number || accountUser?.phoneNumber || '').trim();
  const requesterEmail = payload.contactMethod === 'Mail'
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
        ].join('
')
      }
    });

    summaryContent.innerHTML = `
      <p><strong>Domaine :</strong> ${payload.domain || '-'}</p>
      <p><strong>Structure :</strong> ${payload.companyName || '-'}</p>
      <p><strong>Contact :</strong> ${payload.fullName || '-'} — ${payload.contactMethod || '-'} : ${payload.contactValue || '-'}</p>
      <p><strong>Besoin :</strong> ${payload.requestType || '-'}</p>
      <p><strong>Détails :</strong><br>${String(payload.requestDetails || '-').replace(/
/g, '<br>')}</p>
      <p style="margin-top:12px"><strong>Message transmis.</strong> Un conseiller POPE Online vous contactera rapidement.</p>
    `;

    form.hidden = true;
    document.querySelector('.stepper').hidden = true;
    summarySection.hidden = false;
    showToast('Message transmis', 'ok');
  } catch (e) {
    console.error(e);
    showToast('Envoi impossible', 'err');
    alert(`Votre demande n’a pas pu être transmise pour le moment. ${e?.data?.error || e.message || ''}`.trim());
  }
});

updateSteps();
prefillFromAccount();

(function(){
  const fullNameField = document.getElementById('fullName');
  const contactMethodField = document.getElementById('contactMethod');
  const contactValueField = document.getElementById('contactValue');
  if (contactMethodField) contactMethodField.required = false;
  if (contactValueField) contactValueField.required = false;
  if (fullNameField) fullNameField.required = true;
})();
