import { getAppliedLocale, t } from './runtime';

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

/** Compact feed age. Digits stay Western. English stays now, 5m, 3h, 2d, 1w. */
export function formatCompactAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return t('discover.justNow');
  if (minutes < 60) return t('discover.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('discover.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('discover.daysAgo', { count: days });
  return t('discover.weeksAgo', { count: Math.floor(days / 7) });
}
