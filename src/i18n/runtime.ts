import { AppLocale } from './locale';
import { MessageKey, pluralPhrase, translate } from './messages';

let applied: AppLocale = 'en';

export function setAppliedLocale(locale: AppLocale): void {
  applied = locale;
}

export function getAppliedLocale(): AppLocale {
  return applied;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(applied, key, vars);
}

export function reviewCountLabel(count: number): string {
  return pluralPhrase(applied, 'nav.reviewCount', count);
}
