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
  steps.forEach((step, index) => step.classList.toggle('is-active', index === currentStep));
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index === currentStep);
    indicator.classList.toggle('is-done', index < currentStep);
  });
}

function validateCurrentStep() {
  const activeStep = steps[currentStep];
  const fields = Array.from(activeStep.querySelectorAll('input, select, textarea')).filter((field) => {
    if (field.closest('[hidden]')) return false;
    return true;
  });
  return fields.every((field) => field.reportValidity());
}

activityDomain?.addEventListener('change', (e) => {
  const isOther = e.target.value === 'Autre';
  otherDomainWrap.hidden = !isOther;
  document.getElementById('otherDomain').required = isOther;
});

document.querySelectorAll('[data-next]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    currentStep = Math.min(currentStep + 1, steps.length - 1);
    updateSteps();
  });
});

document.querySelectorAll('[data-prev]').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentStep = Math.max(currentStep - 1, 0);
    updateSteps();
  });
});

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateCurrentStep()) return;

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
    <p><strong>Détails :</strong><br>${(payload.requestDetails || '-').replace(/
/g, '<br>')}</p>
  `;

  const mailBody = encodeURIComponent(
`Bonjour POPE Online,%0D%0A%0D%0AVoici ma demande :%0D%0A%0D%0A- Domaine d'activité : ${payload.domain || '-'}%0D%0A- Structure : ${payload.companyName || '-'}%0D%0A- Nom : ${payload.fullName || '-'}%0D%0A- Contact préféré : ${payload.contactMethod || '-'}%0D%0A- Coordonnée : ${payload.contactValue || '-'}%0D%0A- Type de besoin : ${payload.requestType || '-'}%0D%0A- Détails : ${payload.requestDetails || '-'}%0D%0A%0D%0AMerci.`);
  sendMailCta.href = `mailto:contact@pope-online.com?subject=Demande%20client%20priv%C3%A9%20-%20POPE%20Online&body=${mailBody}`;

  form.hidden = true;
  document.querySelector('.stepper').hidden = true;
  summarySection.hidden = false;
});

updateSteps();
