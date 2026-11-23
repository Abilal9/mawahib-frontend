import { getAppliedLocale } from './runtime';

/**
 * Gregorian calendar and Western digits. Money stays on en-US in the money helpers
 * so grouping and currency text do not change.
 */
export function uiLocaleTag(): string {
  return getAppliedLocale() === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US';
}

export function formatUiDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(uiLocaleTag(), options);
}

export function formatUiNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(uiLocaleTag(), options);
}
