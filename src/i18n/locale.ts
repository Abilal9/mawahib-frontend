/**
 * Arabic stays unavailable in the menu until built-in wording and RTL coverage
 * are ready. The preference logic already accepts `ar`.
 */
export const arabicChoiceEnabled = false;

export const APP_LOCALES = ['en', 'ar'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

/** English, including a missing value or a retired French choice. */
export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === 'ar' ? 'ar' : 'en';
}

export function directionFor(locale: AppLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Text and layout stay on the direction the native app already started with.
 * A saved choice that needs the other direction waits until the next launch.
 */
export function appliedLocaleFor(input: {
  saved: AppLocale;
  nativeIsRTL: boolean;
}): AppLocale {
  const savedIsRtl = input.saved === 'ar';
  if (savedIsRtl === input.nativeIsRTL) return input.saved;
  return input.nativeIsRTL ? 'ar' : 'en';
}
