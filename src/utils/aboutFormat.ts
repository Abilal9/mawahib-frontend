import { gregorianMonthYear } from './gregorianCivilDate';
import { t, getAppliedLocale } from '../i18n/runtime';
import type {
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileLanguage,
} from '../data/types';
import { displayLanguageLevel } from '../constants/languageLevels';

export function formatMonthYear(
  month?: number | null,
  year?: number | null,
): string {
  if (!year) return '';
  if (month && month >= 1 && month <= 12) {
    return gregorianMonthYear(month, year, getAppliedLocale());
  }
  return String(year);
}

export function formatDateRange(input: {
  startMonth?: number | null;
  startYear?: number | null;
  endMonth?: number | null;
  endYear?: number | null;
  current?: boolean;
  legacyYears?: string | null;
}): string {
  const start = formatMonthYear(input.startMonth, input.startYear);
  if (input.current) {
    return start ? t('profile.presentRange', { start }) : t('profile.present');
  }
  const end = formatMonthYear(input.endMonth, input.endYear);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return input.legacyYears?.trim() || '';
}

export function languageSubtitle(lang: ProfileLanguage): string {
  return displayLanguageLevel(lang.level);
}

export function educationDateLabel(item: ProfileEducation): string {
  return formatDateRange({
    startMonth: item.startMonth,
    startYear: item.startYear,
    endMonth: item.endMonth,
    endYear: item.endYear,
    current: Boolean(item.currentlyStudying),
    legacyYears: item.years,
  });
}

export function experienceDateLabel(item: ProfileExperience): string {
  return formatDateRange({
    startMonth: item.startMonth,
    startYear: item.startYear,
    endMonth: item.endMonth,
    endYear: item.endYear,
    current: Boolean(item.currentlyWorking),
    legacyYears: item.years,
  });
}

export function experienceTypeLabel(item: ProfileExperience): string {
  return (item.employmentType || item.type || '').trim();
}

export function certificationIssuer(item: ProfileCertification): string {
  return (item.issuingOrganization || item.org || '').trim();
}

export function certificationIssueLabel(item: ProfileCertification): string {
  const structured = formatMonthYear(item.issueMonth, item.issueYear);
  if (structured) return t('profile.issued', { date: structured });
  if (item.year?.trim()) return t('profile.issued', { date: item.year.trim() });
  return '';
}

export function certificationExpiryLabel(item: ProfileCertification): string {
  if (item.doesNotExpire) return t('profile.doesNotExpire');
  const structured = formatMonthYear(item.expirationMonth, item.expirationYear);
  return structured ? t('profile.expires', { date: structured }) : '';
}

function sortKey(
  year?: number | null,
  month?: number | null,
  current?: boolean,
): number {
  if (current) return Number.MAX_SAFE_INTEGER;
  if (!year) return 0;
  return year * 100 + (month && month >= 1 && month <= 12 ? month : 0);
}

/** Display sort: currently studying first, then latest end/start. */
export function sortEducationForDisplay(
  items: ProfileEducation[],
): ProfileEducation[] {
  return [...items].sort((a, b) => {
    const aCurrent = Boolean(a.currentlyStudying);
    const bCurrent = Boolean(b.currentlyStudying);
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    const aKey = Math.max(
      sortKey(a.endYear, a.endMonth),
      sortKey(a.startYear, a.startMonth),
    );
    const bKey = Math.max(
      sortKey(b.endYear, b.endMonth),
      sortKey(b.startYear, b.startMonth),
    );
    if (aKey !== bKey) return bKey - aKey;
    return 0;
  });
}

/** Display sort: currently working first, then newest dates. */
export function sortExperienceForDisplay(
  items: ProfileExperience[],
): ProfileExperience[] {
  return [...items].sort((a, b) => {
    const aCurrent = Boolean(a.currentlyWorking);
    const bCurrent = Boolean(b.currentlyWorking);
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    const aKey = Math.max(
      sortKey(a.endYear, a.endMonth, a.currentlyWorking),
      sortKey(a.startYear, a.startMonth),
    );
    const bKey = Math.max(
      sortKey(b.endYear, b.endMonth, b.currentlyWorking),
      sortKey(b.startYear, b.startMonth),
    );
    if (aKey !== bKey) return bKey - aKey;
    return 0;
  });
}

/** Display sort: newest issue first. */
export function sortCertificationsForDisplay(
  items: ProfileCertification[],
): ProfileCertification[] {
  return [...items].sort((a, b) => {
    const aYear = a.issueYear ?? (a.year ? Number.parseInt(a.year, 10) : 0);
    const bYear = b.issueYear ?? (b.year ? Number.parseInt(b.year, 10) : 0);
    const aKey = sortKey(
      Number.isFinite(aYear) ? aYear : 0,
      a.issueMonth,
    );
    const bKey = sortKey(
      Number.isFinite(bYear) ? bYear : 0,
      b.issueMonth,
    );
    return bKey - aKey;
  });
}

export function normalizeTalentList(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > 60) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 40);
}

export function replaceById<T extends { id: string }>(
  list: T[],
  id: string,
  next: T,
): T[] {
  return list.map((item) => (item.id === id ? next : item));
}

export function removeById<T extends { id: string }>(
  list: T[],
  id: string,
): T[] {
  return list.filter((item) => item.id !== id);
}
