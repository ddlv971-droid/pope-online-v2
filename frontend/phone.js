
export function attachIntlPhone({ selectInputId, countryInputId, numberInputId, fullInputId, initialFull = '' }) {
  const select = document.getElementById(selectInputId);
  const country = document.getElementById(countryInputId);
  const number = document.getElementById(numberInputId);
  const full = document.getElementById(fullInputId);
  if (!select || !country || !number || !full || !window.intlTelInputGlobals) return null;

  const countries = window.intlTelInputGlobals.getCountryData() || [];
  const preferred = ['fr', 'gp', 'mq', 'gf', 're', 'ca', 'us', 'gb'];
  const grouped = [
    ...countries.filter(c => preferred.includes(c.iso2)),
    ...countries.filter(c => !preferred.includes(c.iso2))
  ];
  select.innerHTML = grouped.map(c => `<option value="+${c.dialCode}" data-iso2="${c.iso2}">${flagEmoji(c.iso2)} ${c.name} (+${c.dialCode})</option>`).join('');

  const iti = window.intlTelInput(number, {
    initialCountry: 'fr',
    preferredCountries: preferred,
    nationalMode: false,
    separateDialCode: false,
    utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/js/utils.js'
  });

  function flagEmoji(iso2) {
    return String.fromCodePoint(...iso2.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  function syncFromIti() {
    const data = iti.getSelectedCountryData();
    const dial = data?.dialCode ? `+${data.dialCode}` : '';
    country.value = dial;
    if (dial) select.value = dial;
    try {
      full.value = iti.getNumber() || `${dial}${number.value}`;
    } catch {
      full.value = `${dial}${number.value}`;
    }
  }

  function syncFromSelect() {
    const dial = select.value || '';
    country.value = dial;
    const opt = select.options[select.selectedIndex];
    const iso2 = opt?.dataset?.iso2;
    if (iso2) iti.setCountry(iso2);
    try {
      const raw = String(number.value || '').replace(/^\+?\d+\s*/, '').trim();
      full.value = `${dial}${raw}`;
    } catch {
      full.value = `${dial}${number.value || ''}`;
    }
  }

  number.addEventListener('countrychange', syncFromIti);
  number.addEventListener('input', syncFromIti);
  select.addEventListener('change', syncFromSelect);

  if (initialFull) number.value = initialFull;
  syncFromIti();
  return { iti, sync: syncFromIti };
}
