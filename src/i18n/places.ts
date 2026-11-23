import { getAppliedLocale } from './runtime';

/** Exact labels from the built-in SA/AE catalog. Any other text is returned unchanged. */
const PLACE_AR: Record<string, string> = {
  'Saudi Arabia': 'المملكة العربية السعودية',
  'United Arab Emirates': 'الإمارات العربية المتحدة',
  Riyadh: 'الرياض',
  Jeddah: 'جدة',
  Makkah: 'مكة',
  Madinah: 'المدينة المنورة',
  Dammam: 'الدمام',
  Khobar: 'الخبر',
  Dhahran: 'الظهران',
  Taif: 'الطائف',
  Abha: 'أبها',
  Tabuk: 'تبوك',
  Jubail: 'الجبيل',
  Yanbu: 'ينبع',
  Buraydah: 'بريدة',
  'Khamis Mushait': 'خميس مشيط',
  Hofuf: 'الهفوف',
  'Abu Dhabi': 'أبوظبي',
  Dubai: 'دبي',
  Sharjah: 'الشارقة',
  Ajman: 'عجمان',
  'Umm Al Quwain': 'أم القيوين',
  'Ras Al Khaimah': 'رأس الخيمة',
  Fujairah: 'الفجيرة',
};

export function placeLabel(english: string): string {
  if (getAppliedLocale() !== 'ar') return english;
  return PLACE_AR[english] ?? english;
}

/** Labels each catalog place in a "City, Country" line. Unknown text stays as stored. */
export function placeLineLabel(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .split(', ')
    .map((part) => placeLabel(part))
    .join(', ');
}
