const form = document.getElementById('privateWizard');
const steps = Array.from(document.querySelectorAll('.wizard-step'));
const indicators = Array.from(document.querySelectorAll('[data-step-indicator]'));
const otherDomainWrap = document.getElementById('otherDomainWrap');
const activityDomain = document.getElementById('activityDomain');
const summarySection = document.getElementById('wizardSummary');
const summaryContent = document.getElementById('summaryContent');
const sendMailCta = document.getElementById('sendMailCta');
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

form?.addEventListener('submit', (e) => {
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

  summaryContent.innerHTML = `
    <p><strong>Domaine :</strong> ${payload.domain || '-'}</p>
    <p><strong>Structure :</strong> ${payload.companyName || '-'}</p>
    <p><strong>Contact :</strong> ${payload.fullName || '-'} — ${payload.contactMethod || '-'} : ${payload.contactValue || '-'}</p>
    <p><strong>Besoin :</strong> ${payload.requestType || '-'}</p>
    <p><strong>Détails :</strong><br>${String(payload.requestDetails || '-').replace(/\n/g, '<br>')}</p>
  `;

  const lines = [
    "Bonjour POPE Online,",
    "",
    "Voici ma demande :",
    "",
    `- Domaine d'activité : ${payload.domain || '-'}`,
    `- Structure : ${payload.companyName || '-'}`,
    `- Nom : ${payload.fullName || '-'}`,
    `- Contact préféré : ${payload.contactMethod || '-'}`,
    `- Coordonnée : ${payload.contactValue || '-'}`,
    `- Type de besoin : ${payload.requestType || '-'}`,
    `- Détails : ${payload.requestDetails || '-'}`,
    "",
    "Merci."
  ].join("\r\n");
  sendMailCta.href = `mailto:contact@pope-online.com?subject=Demande%20client%20priv%C3%A9%20-%20POPE%20Online&body=${encodeURIComponent(lines)}`;

  form.hidden = true;
  document.querySelector('.stepper').hidden = true;
  summarySection.hidden = false;
});

updateSteps();


// V3 fix: relax step 2 validation so the journey can continue once the name is filled.
// contact method/value remain optional at this stage and can be clarified during contact.
(function(){
  const fullNameField = document.getElementById('fullName');
  const contactMethodField = document.getElementById('contactMethod');
  const contactValueField = document.getElementById('contactValue');
  if (contactMethodField) contactMethodField.required = false;
  if (contactValueField) contactValueField.required = false;
  if (fullNameField) fullNameField.required = true;
})();
