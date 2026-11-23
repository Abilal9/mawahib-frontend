import { getAppliedLocale } from './runtime';

/** Controlled catalog row. Custom text must not be passed here. */
export function catalogLabel(item: {
  nameEn: string;
  nameAr?: string | null;
}): string {
  if (getAppliedLocale() === 'ar') {
    const arabic = item.nameAr?.trim();
    if (arabic) return arabic;
  }
  return item.nameEn;
}
