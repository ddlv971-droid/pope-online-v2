
const DEFAULT_COUNTRIES = [
  { iso2: 'gp', name: 'Guadeloupe', dialCode: '590' },
  { iso2: 'mq', name: 'Martinique', dialCode: '596' },
  { iso2: 'gf', name: 'Guyane française', dialCode: '594' },
  { iso2: 'fr', name: 'France', dialCode: '33' },
  { iso2: 'be', name: 'Belgique', dialCode: '32' },
  { iso2: 'ch', name: 'Suisse', dialCode: '41' },
  { iso2: 'ca', name: 'Canada', dialCode: '1' },
  { iso2: 'us', name: 'États-Unis', dialCode: '1' },
  { iso2: 'gb', name: 'Royaume-Uni', dialCode: '44' },
  { iso2: 'de', name: 'Allemagne', dialCode: '49' },
  { iso2: 'es', name: 'Espagne', dialCode: '34' },
  { iso2: 'it', name: 'Italie', dialCode: '39' },
  { iso2: 'lu', name: 'Luxembourg', dialCode: '352' },
  { iso2: 'nl', name: 'Pays-Bas', dialCode: '31' },
  { iso2: 'pt', name: 'Portugal', dialCode: '351' },
  { iso2: 'ht', name: 'Haïti', dialCode: '509' },
  { iso2: 'do', name: 'République dominicaine', dialCode: '1' },
  { iso2: 'ma', name: 'Maroc', dialCode: '212' },
  { iso2: 'sn', name: 'Sénégal', dialCode: '221' },
  { iso2: 'ci', name: "Côte d’Ivoire", dialCode: '225' }
];

function flagEmoji(iso2) {
  return String.fromCodePoint(...String(iso2 || 'fr').toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeCountries() {
  if (window.intlTelInputGlobals?.getCountryData) {
    const preferred = ['gp', 'mq', 'gf', 'fr', 'be', 'ch', 'ca', 'us', 'gb'];
    const data = window.intlTelInputGlobals.getCountryData().map((c) => ({
      iso2: c.iso2,
      name: c.name,
      dialCode: String(c.dialCode)
    }));
    const uniq = [];
    const seen = new Set();
    [...data.filter((c) => preferred.includes(c.iso2)), ...data.filter((c) => !preferred.includes(c.iso2))].forEach((c) => {
      const key = `${c.iso2}:${c.dialCode}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(c);
      }
    });
    return uniq;
  }
  return DEFAULT_COUNTRIES;
}

export function attachIntlPhone({ selectInputId, countryInputId, numberInputId, fullInputId, initialFull = '' }) {
  const select = document.getElementById(selectInputId);
  const country = document.getElementById(countryInputId);
  const number = document.getElementById(numberInputId);
  const full = document.getElementById(fullInputId);
  if (!select || !country || !number || !full) return null;

  const countries = normalizeCountries();
  select.innerHTML = countries
    .map((c) => `<option value="+${c.dialCode}" data-iso2="${c.iso2}">${flagEmoji(c.iso2)} ${c.name} (+${c.dialCode})</option>`)
    .join('');

  let iti = null;
  if (window.intlTelInput) {
    iti = window.intlTelInput(number, {
      initialCountry: 'gp',
      preferredCountries: ['gp', 'mq', 'gf', 'fr', 'be', 'ch', 'ca', 'us', 'gb'],
      nationalMode: false,
      separateDialCode: false,
      autoPlaceholder: 'polite',
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/js/utils.js'
    });
  }

  function syncFromSelect() {
    const dial = select.value || '+590';
    const opt = select.options[select.selectedIndex];
    const iso2 = opt?.dataset?.iso2 || 'gp';
    country.value = dial;
    if (iti) {
      try { iti.setCountry(iso2); } catch {}
    }
    const raw = onlyDigits(number.value).replace(new RegExp(`^${onlyDigits(dial)}`), '');
    number.value = raw;
    full.value = `${dial}${raw}`;
  }

  function syncFromInput() {
    const dial = select.value || '+590';
    country.value = dial;
    const raw = onlyDigits(number.value).replace(new RegExp(`^${onlyDigits(dial)}`), '');
    number.value = raw;
    if (iti) {
      try {
        const selected = iti.getSelectedCountryData();
        if (selected?.dialCode) {
          const maybeDial = `+${selected.dialCode}`;
          country.value = maybeDial;
          select.value = maybeDial;
        }
      } catch {}
    }
    full.value = `${country.value}${raw}`;
  }

  function setFromValue(value) {
    const compact = String(value || '').trim().replace(/[\s()-]/g, '');
    if (!compact) {
      select.value = '+590';
      syncFromSelect();
      return;
    }
    const byLen = [...countries].sort((a, b) => String(b.dialCode).length - String(a.dialCode).length);
    const match = byLen.find((c) => compact.startsWith(`+${c.dialCode}`));
    if (match) {
      select.value = `+${match.dialCode}`;
      country.value = `+${match.dialCode}`;
      if (iti) {
        try { iti.setCountry(match.iso2); } catch {}
      }
      number.value = compact.slice(match.dialCode.length + 1);
    } else {
      number.value = compact.replace(/^\+/, '');
    }
    syncFromInput();
  }

  select.addEventListener('change', syncFromSelect);
  number.addEventListener('input', syncFromInput);
  number.addEventListener('blur', syncFromInput);
  number.addEventListener('countrychange', syncFromInput);

  setFromValue(initialFull);

  return { iti, sync: syncFromInput, setFromValue };
}
