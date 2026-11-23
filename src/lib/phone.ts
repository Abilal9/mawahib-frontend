import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { t } from '../i18n/runtime';

export type DialCountry = {
  code: CountryCode;
  name: string;
  dial: string;
  flag: string;
};

/** Mawahib phone picker: SA + AE only. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
];

/** Saudi / UAE mobile local format: 5XXXXXXXX (exactly 9 digits). */
const SA_MOBILE_NATIONAL = /^5\d{8}$/;
const AE_MOBILE_NATIONAL = /^5\d{8}$/;

/**
 * Max national digits accepted in the input.
 * SA and AE are fixed at 9; other countries use a generous E.164-safe cap
 * (libphonenumber still decides validity).
 */
export function maxNationalDigits(country: CountryCode): number {
  if (country === 'SA' || country === 'AE') return 9;
  return 15;
}

/** Digits only, capped to the country max (blocks 10th SA/AE digit, letters, +). */
export function sanitizeNationalInput(
  raw: string,
  country: CountryCode,
): string {
  return raw.replace(/\D/g, '').slice(0, maxNationalDigits(country));
}

export function toE164(
  nationalNumber: string,
  country: CountryCode,
): string | null {
  const digits = sanitizeNationalInput(nationalNumber, country);
  if (!digits) return null;

  if (country === 'SA') {
    if (!SA_MOBILE_NATIONAL.test(digits)) return null;
    return `+966${digits}`;
  }

  if (country === 'AE') {
    if (!AE_MOBILE_NATIONAL.test(digits)) return null;
    const parsed = parsePhoneNumberFromString(digits, 'AE');
    if (!parsed || !parsed.isValid()) return null;
    const e164 = parsed.format('E.164');
    // Canonical UAE mobile shape for Nest agreement: +9715XXXXXXXX
    if (!/^\+9715\d{8}$/.test(e164)) return null;
    return e164;
  }

  const parsed = parsePhoneNumberFromString(digits, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format('E.164');
}

export function isValidNationalNumber(
  nationalNumber: string,
  country: CountryCode,
): boolean {
  return toE164(nationalNumber, country) !== null;
}

/**
 * Live UX messages for the local-number field.
 * Returns null when empty or valid.
 */
export function getPhoneValidationMessage(
  nationalNumber: string,
  country: CountryCode,
): string | null {
  const digits = sanitizeNationalInput(nationalNumber, country);
  if (!digits) return null;

  if (country === 'SA') {
    if (digits[0] !== '5') {
      return t('auth.saMustStart5');
    }
    if (digits.length < 9) {
      return t('auth.nineDigits');
    }
    return null;
  }

  if (country === 'AE') {
    if (digits[0] !== '5') {
      return t('auth.uaeMobile');
    }
    if (digits.length < 9) {
      return t('auth.nineDigits');
    }
    if (!toE164(digits, 'AE')) {
      return t('auth.uaeMobile');
    }
    return null;
  }

  if (!toE164(digits, country)) {
    return t('auth.phoneForCountry');
  }
  return null;
}

export function formatNationalHint(country: CountryCode): string {
  switch (country) {
    case 'SA':
    case 'AE':
      return '5XXXXXXXX';
    default:
      return t('auth.phoneNumberHint');
  }
}
