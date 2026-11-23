export const languages = [
  { id: 'en', labelKey: 'language.english' },
  { id: 'ar', labelKey: 'language.arabic' },
] as const;

export type LanguageId = (typeof languages)[number]['id'];
