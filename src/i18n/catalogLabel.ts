import { getAppliedLocale } from './runtime';

/** Card label. Custom text stays as written. Catalog Arabic is used only when present. */
export function categoryCardLabel(input: {
  customCategory?: string | null;
  categoryName?: string | null;
  categoryNameAr?: string | null;
  category?: string | null;
}): string | null {
  const custom = input.customCategory?.trim();
  if (custom) return custom;
  if (getAppliedLocale() === 'ar') {
    const arabic = input.categoryNameAr?.trim();
    if (arabic) return arabic;
  }
  const catalog = input.categoryName?.trim();
  if (catalog) return catalog;
  const legacy = input.category?.trim();
  return legacy || null;
}
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
