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

  function flagEmoji(iso2) {
    return String.fromCodePoint(...iso2.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  select.innerHTML = grouped
    .map(c => `<option value="+${c.dialCode}" data-iso2="${c.iso2}">${flagEmoji(c.iso2)} ${c.name} (+${c.dialCode})</option>`)
    .join('');

  const iti = window.intlTelInput(number, {
    initialCountry: 'fr',
    preferredCountries: preferred,
    nationalMode: false,
    separateDialCode: false,
    utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/js/utils.js'
  });

  function onlyDigits(v) {
    return String(v || '').replace(/[^\d]/g, '');
  }

  function syncFromIti() {
    const data = iti.getSelectedCountryData();
    const dial = data?.dialCode ? `+${data.dialCode}` : '';
    country.value = dial;
    if (dial) select.value = dial;
    const rawDigits = onlyDigits(number.value).replace(new RegExp(`^${onlyDigits(dial)}`), '');
    try {
      full.value = iti.getNumber() || `${dial}${rawDigits}`;
    } catch {
      full.value = `${dial}${rawDigits}`;
    }
  }

  function syncFromSelect() {
    const dial = select.value || '';
    country.value = dial;
    const opt = select.options[select.selectedIndex];
    const iso2 = opt?.dataset?.iso2;
    if (iso2) iti.setCountry(iso2);
    const rawDigits = onlyDigits(number.value).replace(new RegExp(`^${onlyDigits(dial)}`), '');
    number.value = rawDigits;
    full.value = `${dial}${rawDigits}`;
  }

  function setFromValue(inputValue) {
    const value = String(inputValue || '').trim();
    if (!value) {
      syncFromIti();
      return;
    }
    const compact = value.replace(/[\s()-]/g, '');
    const byDialLength = [...grouped].sort((a,b) => String(b.dialCode).length - String(a.dialCode).length);
    const match = byDialLength.find(c => compact.startsWith(`+${c.dialCode}`));
    if (match) {
      select.value = `+${match.dialCode}`;
      country.value = `+${match.dialCode}`;
      iti.setCountry(match.iso2);
      number.value = compact.replace(`+${match.dialCode}`, '');
    } else {
      number.value = compact.replace(/^\+/, '');
    }
    syncFromSelect();
  }

  number.addEventListener('countrychange', syncFromIti);
  number.addEventListener('input', syncFromIti);
  select.addEventListener('change', syncFromSelect);

  if (initialFull) setFromValue(initialFull);
  else syncFromIti();

  return { iti, sync: syncFromIti, setFromValue };
}
