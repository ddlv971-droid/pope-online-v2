import { apiFetch } from './api.js';
import { showToast } from './app.js';

const form = document.getElementById('privateWizard');
const steps = Array.from(document.querySelectorAll('.wizard-step'));
const indicators = Array.from(document.querySelectorAll('[data-step-indicator]'));
const otherDomainWrap = document.getElementById('otherDomainWrap');
const activityDomain = document.getElementById('activityDomain');
const summarySection = document.getElementById('wizardSummary');
const summaryContent = document.getElementById('summaryContent');
let currentStep = 0;

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
    const user = me?.user || {};
    const organization = user.organization || '';
    const fullName = user.full_name || user.fullName || '';
    const email = user.email || '';
    const phone = user.phone_full || user.phoneFull || '';

    const companyField = document.getElementById('companyName');
    const nameField = document.getElementById('fullName');
    const contactMethodField = document.getElementById('contactMethod');
    const contactValueField = document.getElementById('contactValue');

    if (companyField && organization) companyField.value = organization;
    if (nameField && fullName) nameField.value = fullName;
    if (contactMethodField) {
      if (email) contactMethodField.value = 'Mail';
      else if (phone) contactMethodField.value = 'Téléphone';
    }
    if (contactValueField) {
      contactValueField.value = email || phone || '';
    }
  } catch (e) {
    console.warn('Préremplissage indisponible', e);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const data = new FormData(form);
  const domain = data.get('activityDomain') === 'Autre' ? data.get('otherDomain') : data.get('activityDomain');
  const payload = {
    domain,
    companyName: data.get('companyName'),
    fullName: data.get('fullName'),
    contactMethod: data.get('contactMethod'),
    contactValue: data.get('contactValue'),
    requestType: data.get('requestType'),
    requestDetails: data.get('requestDetails')
  };

  try {
    await apiFetch('/client/message', {
      method: 'POST',
      body: {
        companyName: payload.companyName,
        requesterName: payload.fullName,
        requesterEmail: payload.contactMethod === 'Mail' ? payload.contactValue : '',
        requesterPhone: payload.contactMethod === 'Téléphone' || payload.contactMethod === 'WhatsApp' ? payload.contactValue : '',
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

    summaryContent.innerHTML = `
      <p><strong>Domaine :</strong> ${payload.domain || '-'}</p>
      <p><strong>Structure :</strong> ${payload.companyName || '-'}</p>
      <p><strong>Contact :</strong> ${payload.fullName || '-'} — ${payload.contactMethod || '-'} : ${payload.contactValue || '-'}</p>
      <p><strong>Besoin :</strong> ${payload.requestType || '-'}</p>
      <p><strong>Détails :</strong><br>${String(payload.requestDetails || '-').replace(/\n/g, '<br>')}</p>
      <p style="margin-top:12px"><strong>Votre demande a été transmise.</strong> Un conseiller POPE Online vous contactera rapidement.</p>
    `;

    form.hidden = true;
    document.querySelector('.stepper').hidden = true;
    summarySection.hidden = false;
    showToast('Votre demande a été transmise', 'ok');
  } catch (e) {
    console.error(e);
    showToast('Envoi impossible', 'err');
    alert('Votre demande n’a pas pu être transmise pour le moment.');
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
