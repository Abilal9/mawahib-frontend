/**
 * Proleptic Gregorian civil dates for Mawahib scheduling.
 *
 * Month length and weekday index come from ECMAScript date fields. Names come
 * from fixed tables: month index 9 is October / أكتوبر. A locale argument may
 * choose English or Arabic words. It never chooses a calendar. Unicode
 * extensions such as u-ca-islamic and u-ca-islamic-umalqura are ignored, as
 * are iOS and Android preferred-calendar settings. This module does not call
 * the Intl API. API values stay YYYY-MM-DD and are never parsed with the
 * Date constructor on a date-only string, which would treat it as UTC midnight.
 */

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Sunday-first, matching the existing Calendar grids. Index 0 is Sunday. */
export const GREGORIAN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** One-letter Sunday-first headings. The weekday index is unchanged. */
const WEEKDAYS_SHORT_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] as const;

const MONTHS_LONG_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

const MONTHS_SHORT_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

const WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export type SchedulingLanguage = 'en' | 'ar';

/**
 * Language of a locale tag. Calendar extensions and legacy @calendar suffixes
 * are discarded before the language is read.
 */
export function schedulingLanguage(locale?: string): SchedulingLanguage {
  if (!locale) return 'en';
  const withoutUnicode = locale.split('-u-')[0] ?? locale;
  const withoutLegacy = withoutUnicode.split('@')[0] ?? withoutUnicode;
  const language = withoutLegacy.toLowerCase().split(/[-_]/)[0];
  return language === 'ar' ? 'ar' : 'en';
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CivilParts = {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
};

export function isCivilDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseCivilDate(value: string): CivilParts | null {
  if (!isCivilDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function civilDateFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isCivilDate(iso) ? iso : null;
}

/** Device-local Gregorian today. The device calendar system is not consulted. */
export function todayCivilDate(now: Date = new Date()): string {
  const iso = civilDateFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (!iso) {
    throw new Error('Local today is not a Gregorian civil date');
  }
  return iso;
}

export function daysInGregorianMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, in the proleptic Gregorian calendar. */
export function gregorianWeekday(iso: string): number | null {
  const parts = parseCivilDate(iso);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function addCivilDays(iso: string, days: number): string | null {
  const parts = parseCivilDate(iso);
  if (!parts || !Number.isInteger(days)) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return civilDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function shiftGregorianMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** One month step. Callers can apply it again before React re-renders. */
export function advanceVisibleMonth(
  current: { year: number; month: number; selected: string; today: string },
  delta: number,
): { year: number; month: number; selected: string } {
  const next = shiftGregorianMonth(current.year, current.month, delta);
  return {
    year: next.year,
    month: next.month,
    selected: selectedCivilDayForMonth(current.selected, current.today, next.year, next.month),
  };
}

/**
 * Entering the month that contains today selects today.
 * Otherwise the previous day-of-month is kept, clamped to the month length.
 */
export function selectedCivilDayForMonth(
  currentSelected: string,
  today: string,
  year: number,
  month: number,
): string {
  const todayParts = parseCivilDate(today);
  if (todayParts && todayParts.year === year && todayParts.month === month) return today;
  const current = parseCivilDate(currentSelected);
  const day = Math.min(current?.day ?? 1, daysInGregorianMonth(year, month));
  return civilDateFromParts(year, month, day) ?? civilDateFromParts(year, month, 1) ?? today;
}

export function monthBounds(year: number, month: number): { from: string; to: string } {
  const last = daysInGregorianMonth(year, month);
  const from = civilDateFromParts(year, month, 1);
  const to = civilDateFromParts(year, month, last);
  if (!from || !to) {
    throw new Error('Month bounds are not Gregorian civil dates');
  }
  return { from, to };
}

export type MonthGridCell = { iso: string; day: number } | null;

/** Six rows. Days outside the month are blank, not neighbouring dates. */
export function gregorianMonthGrid(year: number, month: number): MonthGridCell[] {
  const from = civilDateFromParts(year, month, 1);
  if (!from) return Array.from({ length: 42 }, () => null);
  const lead = gregorianWeekday(from) ?? 0;
  const count = daysInGregorianMonth(year, month);
  const cells: MonthGridCell[] = [];
  for (let index = 0; index < lead; index += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) {
    const iso = civilDateFromParts(year, month, day);
    cells.push(iso ? { iso, day } : null);
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function civilRangeContains(start: string, end: string, day: string): boolean {
  return isCivilDate(start) && isCivilDate(end) && isCivilDate(day) && start <= day && day <= end;
}

function monthNames(locale?: string): readonly string[] {
  return schedulingLanguage(locale) === 'ar' ? MONTHS_LONG_AR : MONTHS_LONG;
}

function shortMonthNames(locale?: string): readonly string[] {
  return schedulingLanguage(locale) === 'ar' ? MONTHS_SHORT_AR : MONTHS_SHORT;
}

export function gregorianMonthYear(month: number, year: number, locale?: string): string {
  const name = shortMonthNames(locale)[month - 1] ?? '';
  return name ? `${name} ${year}` : String(year);
}

/** `monthIndex` matches `Date#getMonth`: 0 is January and 9 is October. */
export function gregorianMonthName(monthIndex: number, locale?: string): string {
  return monthNames(locale)[monthIndex] ?? '';
}

/** `weekdayIndex` matches `Date#getDay`: 0 is Sunday. */
export function gregorianWeekdayName(weekdayIndex: number, locale?: string): string {
  const names = schedulingLanguage(locale) === 'ar' ? WEEKDAYS_AR : GREGORIAN_WEEKDAYS;
  return names[weekdayIndex] ?? '';
}

/** Compact grid heading. Sunday stays index 0 in both languages. */
export function gregorianWeekdayHeading(weekdayIndex: number, locale?: string): string {
  if (schedulingLanguage(locale) === 'ar') return WEEKDAYS_SHORT_AR[weekdayIndex] ?? '';
  return GREGORIAN_WEEKDAYS[weekdayIndex] ?? '';
}

export function formatGregorianMonthTitle(year: number, month: number, locale?: string): string {
  const name = gregorianMonthName(month - 1, locale);
  return `${name} ${year}`;
}

export function formatGregorianLongDate(iso: string, locale?: string): string | null {
  const parts = parseCivilDate(iso);
  if (!parts) return null;
  const name = gregorianMonthName(parts.month - 1, locale);
  if (schedulingLanguage(locale) === 'ar') {
    return `${parts.day} ${name} ${parts.year}`;
  }
  return `${name} ${parts.day}, ${parts.year}`;
}

function formatShort(iso: string, withYear: boolean, locale?: string): string | null {
  const parts = parseCivilDate(iso);
  if (!parts) return null;
  const name = shortMonthNames(locale)[parts.month - 1] ?? '';
  if (schedulingLanguage(locale) === 'ar') {
    return withYear ? `${parts.day} ${name} ${parts.year}` : `${parts.day} ${name}`;
  }
  const label = `${name} ${parts.day}`;
  return withYear ? `${label}, ${parts.year}` : label;
}

/** Same-year ranges omit the year. A range that crosses a year includes both years. */
export function formatGregorianSpan(start: string, end: string, locale?: string): string | null {
  if (start === end) return formatShort(start, true, locale);
  const left = parseCivilDate(start);
  const right = parseCivilDate(end);
  if (!left || !right) return null;
  if (left.year === right.year) {
    const from = formatShort(start, false, locale);
    const to = formatShort(end, false, locale);
    return from && to ? `${from} – ${to}` : null;
  }
  const from = formatShort(start, true, locale);
  const to = formatShort(end, true, locale);
  return from && to ? `${from} – ${to}` : null;
}

/** A picked local Date, labeled from its Gregorian fields. No locale calendar. */
export function formatGregorianLocalDay(date: Date, locale?: string): string {
  const iso = civilDateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return (iso && formatGregorianSpan(iso, iso, locale)) || '';
}

export const CALENDAR_STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  payment_failed: 'Payment Failed',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  disputed: 'Disputed',
  completed: 'Completed',
} as const;

export type CalendarEngagementStatus = keyof typeof CALENDAR_STATUS_LABELS;

export type CalendarCounterpart = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
};

export type CalendarItem = {
  engagementId: string;
  workRequestId: string | null;
  title: string;
  engagementStatus: CalendarEngagementStatus;
  statusLabel: string;
  counterpart: CalendarCounterpart;
};

export type ScheduledCalendarItem = CalendarItem & {
  startDate: string;
  endDate: string;
};

export type CalendarPage = {
  from: string;
  to: string;
  scheduled: ScheduledCalendarItem[];
  scheduledHasMore: boolean;
  unscheduled: CalendarItem[];
  unscheduledHasMore: boolean;
};

export type CalendarTicket = {
  generation: number;
  from: string;
  to: string;
};

const EXPAND_CAP = 93;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function workRequestIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function counterpartOf(value: unknown): CalendarCounterpart | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.trim() === '') return null;
  if (typeof value.displayName !== 'string' || value.displayName.trim() === '') return null;
  return {
    id: value.id,
    displayName: value.displayName.trim(),
    username: typeof value.username === 'string' ? value.username : '',
    avatarUrl: typeof value.avatarUrl === 'string' && value.avatarUrl ? value.avatarUrl : null,
    isVerified: value.isVerified === true,
  };
}

function itemOf(value: unknown): CalendarItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.engagementId !== 'string' || value.engagementId.trim() === '') return null;
  if (typeof value.title !== 'string' || value.title.trim() === '') return null;
  if (typeof value.engagementStatus !== 'string') return null;
  const statusLabel = CALENDAR_STATUS_LABELS[value.engagementStatus as CalendarEngagementStatus];
  if (!statusLabel) return null;
  const counterpart = counterpartOf(value.counterpart);
  if (!counterpart) return null;
  return {
    engagementId: value.engagementId,
    workRequestId: workRequestIdOf(value.workRequestId),
    title: value.title.trim(),
    engagementStatus: value.engagementStatus as CalendarEngagementStatus,
    statusLabel,
    counterpart,
  };
}

function scheduledOf(value: unknown): ScheduledCalendarItem | null {
  const base = itemOf(value);
  if (!base || !isRecord(value)) return null;
  if (typeof value.startDate !== 'string' || typeof value.endDate !== 'string') return null;
  if (!isCivilDate(value.startDate) || !isCivilDate(value.endDate)) return null;
  if (value.startDate > value.endDate) return null;
  return { ...base, startDate: value.startDate, endDate: value.endDate };
}

/** Null when the envelope is unusable. Malformed rows are dropped. */
export function parseCalendarPage(
  raw: unknown,
  expectedFrom: string,
  expectedTo: string,
): CalendarPage | null {
  if (!isRecord(raw)) return null;
  if (raw.from !== expectedFrom || raw.to !== expectedTo) return null;
  if (!Array.isArray(raw.scheduled) || !Array.isArray(raw.unscheduled)) return null;
  const scheduled: ScheduledCalendarItem[] = [];
  for (const row of raw.scheduled) {
    const item = scheduledOf(row);
    if (item) scheduled.push(item);
  }
  const unscheduled: CalendarItem[] = [];
  for (const row of raw.unscheduled) {
    const item = itemOf(row);
    if (item) unscheduled.push(item);
  }
  return {
    from: expectedFrom,
    to: expectedTo,
    scheduled,
    scheduledHasMore: raw.scheduledHasMore === true,
    unscheduled,
    unscheduledHasMore: raw.unscheduledHasMore === true,
  };
}

export function scheduledOnDay(
  items: readonly ScheduledCalendarItem[],
  day: string,
): ScheduledCalendarItem[] {
  if (!isCivilDate(day)) return [];
  return items.filter((item) => civilRangeContains(item.startDate, item.endDate, day));
}

/** In-window days that contain at least one scheduled item. One item marks each day once. */
export function indicatorDays(
  items: readonly ScheduledCalendarItem[],
  from: string,
  to: string,
): string[] {
  if (!isCivilDate(from) || !isCivilDate(to) || from > to) return [];
  const marks = new Set<string>();
  for (const item of items) {
    let cursor = item.startDate > from ? item.startDate : from;
    const end = item.endDate < to ? item.endDate : to;
    if (cursor > end) continue;
    for (let step = 0; step < EXPAND_CAP && cursor <= end; step += 1) {
      marks.add(cursor);
      const next = addCivilDays(cursor, 1);
      if (!next) break;
      cursor = next;
    }
  }
  return [...marks];
}

export function shouldApplyCalendarResult(current: CalendarTicket, incoming: CalendarTicket): boolean {
  return (
    current.generation === incoming.generation &&
    current.from === incoming.from &&
    current.to === incoming.to
  );
}

export function workRequestRoute(workRequestId: string | null): { requestId: string } | null {
  if (!workRequestId) return null;
  return { requestId: workRequestId };
}
