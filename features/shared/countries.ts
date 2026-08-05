export interface CountryPhoneInfo {
  code: string;
  name: string;
  /** No leading '+'. */
  dialCode: string;
  flag: string;
}

export const COUNTRIES: CountryPhoneInfo[] = [
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { code: 'PE', name: 'Perú', dialCode: '51', flag: '🇵🇪' },
  { code: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴' },
  { code: 'MX', name: 'México', dialCode: '52', flag: '🇲🇽' },
  { code: 'BR', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
  { code: 'UY', name: 'Uruguay', dialCode: '598', flag: '🇺🇾' },
  { code: 'BO', name: 'Bolivia', dialCode: '591', flag: '🇧🇴' },
  { code: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { code: 'PY', name: 'Paraguay', dialCode: '595', flag: '🇵🇾' },
  { code: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
  { code: 'PA', name: 'Panamá', dialCode: '507', flag: '🇵🇦' },
  { code: 'DO', name: 'República Dominicana', dialCode: '1', flag: '🇩🇴' },
  { code: 'US', name: 'Estados Unidos', dialCode: '1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', dialCode: '1', flag: '🇨🇦' },
  { code: 'ES', name: 'España', dialCode: '34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italia', dialCode: '39', flag: '🇮🇹' },
  { code: 'FR', name: 'Francia', dialCode: '33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', dialCode: '49', flag: '🇩🇪' },
  { code: 'GB', name: 'Reino Unido', dialCode: '44', flag: '🇬🇧' },
];

export const DEFAULT_COUNTRY_CODE = 'CL';

/**
 * Chile gets the exact rule from the product spec: 9 digits, starting with
 * 9 (mobile) or 2 (Santiago landline). Every other country only gets a loose
 * sanity-check length range — precise per-country dialing plans are out of
 * scope here.
 */
export function isValidPhoneNumber(countryCode: string, digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  if (countryCode === 'CL') {
    return digits.length === 9 && (digits[0] === '9' || digits[0] === '2');
  }
  return digits.length >= 6 && digits.length <= 14;
}

/**
 * Splits a stored phone string like "+56 912345678" back into a country +
 * local digits, matching the longest known dial code first so e.g. Uruguay's
 * "598" isn't mistaken for a shorter prefix. Countries that share a dial
 * code (US/CA/DO all use "1") can't be told apart from the number alone —
 * this picks whichever of them appears first in COUNTRIES, which is a
 * reasonable default, not a precise area-code lookup. Falls back to the
 * default country with the raw digits when nothing matches or the input is
 * empty.
 */
export function parsePhoneNumber(value: string | null | undefined): { countryCode: string; digits: string } {
  const digitsOnly = (value ?? '').replace(/[^\d]/g, '');
  if (!digitsOnly) return { countryCode: DEFAULT_COUNTRY_CODE, digits: '' };

  const byDialCodeLengthDesc = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of byDialCodeLengthDesc) {
    if (digitsOnly.startsWith(country.dialCode)) {
      return { countryCode: country.code, digits: digitsOnly.slice(country.dialCode.length) };
    }
  }
  return { countryCode: DEFAULT_COUNTRY_CODE, digits: digitsOnly };
}

/** Combines a country + local digits into the single string stored in profiles.telefono. */
export function formatPhoneNumber(countryCode: string, digits: string): string {
  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  return `+${country.dialCode} ${digits}`;
}
