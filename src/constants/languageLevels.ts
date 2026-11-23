import { t } from '../i18n/runtime';
import type { MessageKey } from '../i18n/messages';

export const LANGUAGE_LEVELS = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'NATIVE',
] as const;

export type LanguageLevelCode = (typeof LANGUAGE_LEVELS)[number];

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevelCode, string> = {
  A1: 'A1 — Beginner',
  A2: 'A2 — Elementary',
  B1: 'B1 — Intermediate',
  B2: 'B2 — Upper Intermediate',
  C1: 'C1 — Advanced',
  C2: 'C2 — Proficient',
  NATIVE: 'Native / Bilingual',
};

export function isLanguageLevelCode(value: string): value is LanguageLevelCode {
  return (LANGUAGE_LEVELS as readonly string[]).includes(value);
}

const LEVEL_KEYS: Record<LanguageLevelCode, MessageKey> = {
  A1: 'editor.levelA1',
  A2: 'editor.levelA2',
  B1: 'editor.levelB1',
  B2: 'editor.levelB2',
  C1: 'editor.levelC1',
  C2: 'editor.levelC2',
  NATIVE: 'editor.levelNative',
};

function levelLabel(code: LanguageLevelCode): string {
  return t(LEVEL_KEYS[code]);
}

/** Display label for canonical or legacy free-text level. Unknown text stays as stored. */
export function displayLanguageLevel(level: string | null | undefined): string {
  if (!level?.trim()) return '';
  const trimmed = level.trim();
  if (isLanguageLevelCode(trimmed)) return levelLabel(trimmed);
  const upper = trimmed.toUpperCase();
  if (isLanguageLevelCode(upper)) return levelLabel(upper);
  if (/^native/i.test(trimmed) || /bilingual/i.test(trimmed)) {
    return levelLabel('NATIVE');
  }
  const cefr = trimmed.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  if (cefr && isLanguageLevelCode(cefr[1].toUpperCase())) {
    return levelLabel(cefr[1].toUpperCase() as LanguageLevelCode);
  }
  return trimmed;
}
