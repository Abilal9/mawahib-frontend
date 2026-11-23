/**
 * Calendar Phase C: Gregorian civil dates, agenda membership, and stale responses.
 * No network. No device calendar. Imports the real TypeScript modules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dates = await import('../src/utils/gregorianCivilDate.ts');
const page = dates;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const guarded = [
  'src/screens/profile/CalendarScreen.tsx',
  'src/hooks/useMyCalendar.ts',
  'src/utils/gregorianCivilDate.ts',
  'src/services/calendarApi.ts',
  'src/components/layout/SidebarCalendarPreview.tsx',
  'src/components/ui/CalendarPicker.tsx',
  'src/screens/profile/RequestServiceScreen.tsx',
  'src/screens/jobs/DirectRequestScreen.tsx',
  'src/services/workRequestApi.ts',
];

const unsafe = /toLocale|Intl\.|new Date\(\s*['"`]|data\/mock\/calendar/;
for (const relative of guarded) {
  const source = read(relative);
  assert.equal(unsafe.test(source), false, `${relative} stays on fixed Gregorian dates`);
}

assert.equal(dates.isCivilDate('2026-10-22'), true);
assert.equal(dates.isCivilDate('2024-02-29'), true);
assert.equal(dates.isCivilDate('2026-02-29'), false);
assert.equal(dates.isCivilDate('2026-13-01'), false);
assert.equal(dates.isCivilDate('2026/10/22'), false);
assert.equal(dates.civilDateFromParts(2026, 2, 29), null);
assert.equal(dates.civilDateFromParts(2024, 2, 29), '2024-02-29');

assert.equal(dates.daysInGregorianMonth(2026, 1), 31);
assert.equal(dates.daysInGregorianMonth(2026, 4), 30);
assert.equal(dates.daysInGregorianMonth(2026, 2), 28);
assert.equal(dates.daysInGregorianMonth(2024, 2), 29);

assert.deepEqual(dates.shiftGregorianMonth(2026, 1, -1), { year: 2025, month: 12 });
assert.deepEqual(dates.shiftGregorianMonth(2026, 12, 1), { year: 2027, month: 1 });
let stepped = { year: 2026, month: 10, selected: '2026-10-22', today: '2026-06-15' };
stepped = { ...stepped, ...dates.advanceVisibleMonth(stepped, 1) };
stepped = { ...stepped, ...dates.advanceVisibleMonth(stepped, 1) };
assert.equal(stepped.year, 2026);
assert.equal(stepped.month, 12);
assert.equal(stepped.selected, '2026-12-22');
assert.deepEqual(dates.advanceVisibleMonth(
  { year: 2026, month: 1, selected: '2026-01-31', today: '2026-06-15' },
  1,
), { year: 2026, month: 2, selected: '2026-02-28' });
assert.equal(dates.addCivilDays('2026-02-28', 1), '2026-03-01');
assert.equal(dates.addCivilDays('2024-02-28', 1), '2024-02-29');
assert.equal(dates.addCivilDays('2026-10-22', 0), '2026-10-22');

assert.equal(dates.gregorianWeekday('2026-01-01'), 4);
assert.equal(dates.gregorianMonthGrid(2026, 2)[0]?.iso, '2026-02-01');
const october = dates.gregorianMonthGrid(2026, 10);
assert.equal(october.length, 42);
assert.equal(october[0], null);
assert.equal(october[4]?.iso, '2026-10-01');
assert.equal(october.filter((cell) => cell?.iso === '2026-10-31').length, 1);
assert.equal(dates.gregorianMonthGrid(2024, 2).some((cell) => cell?.iso === '2024-02-29'), true);
assert.equal(dates.gregorianMonthGrid(2026, 2).some((cell) => cell?.iso === '2026-02-29'), false);
assert.equal(dates.monthBounds(2026, 10).from, '2026-10-01');
assert.equal(dates.monthBounds(2026, 10).to, '2026-10-31');
assert.equal(
  dates.selectedCivilDayForMonth('2026-10-31', '2026-10-22', 2026, 11),
  '2026-11-30',
);
assert.equal(
  dates.selectedCivilDayForMonth('2026-01-31', '2026-03-02', 2026, 2),
  '2026-02-28',
);
assert.equal(
  dates.selectedCivilDayForMonth('2026-09-04', '2026-10-22', 2026, 10),
  '2026-10-22',
);

assert.equal(dates.gregorianMonthName(9), 'October');
assert.equal(dates.gregorianMonthName(9, 'ar-SA'), 'أكتوبر');
assert.equal(dates.gregorianWeekdayName(0, 'ar-SA-u-ca-islamic'), 'الأحد');
assert.equal(dates.formatGregorianMonthTitle(2026, 10), 'October 2026');
assert.equal(dates.formatGregorianLongDate('2026-10-22'), 'October 22, 2026');

const localeExpectations = {
  'en-US': 'en',
  'en-GB': 'en',
  'en-SA': 'en',
  en_SA: 'en',
  'en-SA@calendar=islamic-umalqura': 'en',
  'en_SA@calendar=gregorian': 'en',
  'ar-SA': 'ar',
  ar_SA: 'ar',
  'ar-AE': 'ar',
  'ar-SA-u-ca-islamic': 'ar',
  'ar-SA-u-ca-islamic-umalqura': 'ar',
  'ar_SA@calendar=islamic-umalqura': 'ar',
  'ar-SA-u-ca-buddhist': 'ar',
  'ar-AE-u-ca-persian': 'ar',
  'ar-SA-u-ca-hebrew': 'ar',
};
for (const [locale, language] of Object.entries(localeExpectations)) {
  assert.equal(dates.schedulingLanguage(locale), language, locale);
  const title = dates.formatGregorianMonthTitle(2026, 10, locale);
  const long = dates.formatGregorianLongDate('2026-10-22', locale);
  const month = dates.gregorianMonthName(9, locale);
  assert.equal(title.includes('1448'), false, locale);
  assert.equal(long.includes('1448'), false, locale);
  assert.equal(title.includes('هـ'), false, locale);
  assert.equal(long.includes('Jumada'), false, locale);
  if (language === 'ar') {
    assert.equal(month, 'أكتوبر', locale);
    assert.equal(title, 'أكتوبر 2026', locale);
    assert.equal(long, '22 أكتوبر 2026', locale);
    assert.equal(dates.gregorianWeekdayName(0, locale), 'الأحد', locale);
    assert.equal(dates.gregorianWeekdayHeading(0, locale), 'ح', locale);
    assert.equal(dates.gregorianWeekdayHeading(6, locale), 'س', locale);
  } else {
    assert.equal(month, 'October', locale);
    assert.equal(title, 'October 2026', locale);
    assert.equal(long, 'October 22, 2026', locale);
    assert.equal(dates.gregorianWeekdayName(0, locale), 'Sun', locale);
  }
}
assert.equal(dates.formatGregorianLocalDay(new Date(2026, 9, 22)), 'Oct 22, 2026');
assert.equal(
  dates.formatGregorianLocalDay(new Date(2026, 9, 22), 'ar-SA-u-ca-islamic-umalqura'),
  '22 أكتوبر 2026',
);
assert.equal(dates.formatGregorianSpan('2026-10-22', '2026-10-22'), 'Oct 22, 2026');
assert.equal(dates.formatGregorianSpan('2026-10-20', '2026-10-24'), 'Oct 20 – Oct 24');
assert.equal(dates.formatGregorianSpan('2026-12-28', '2027-01-03'), 'Dec 28, 2026 – Jan 3, 2027');
for (const label of [
  dates.formatGregorianMonthTitle(2026, 10),
  dates.formatGregorianLongDate('2026-10-22'),
  dates.formatGregorianSpan('2026-10-20', '2026-10-24'),
]) {
  assert.equal(String(label).includes('1448'), false);
  assert.equal(String(label).includes('هـ'), false);
  assert.equal(String(label).includes('Jumada'), false);
}

const counterpart = {
  id: 'user-1',
  displayName: 'Layla',
  username: 'layla',
  avatarUrl: null,
  isVerified: false,
};

function scheduled(overrides) {
  return {
    engagementId: 'eng-exact',
    workRequestId: 'req-1',
    title: 'Brand film',
    engagementStatus: 'in_progress',
    counterpart,
    kind: 'deadline',
    startDate: '2026-10-22',
    endDate: '2026-10-22',
    source: 'agreed_terms',
    tentative: false,
    viewerRole: 'client',
    ...overrides,
  };
}

const raw = {
  from: '2026-10-01',
  to: '2026-10-31',
  scheduledHasMore: false,
  unscheduledHasMore: true,
  scheduled: [
    scheduled({}),
    scheduled({
      engagementId: 'eng-range',
      workRequestId: 'req-2',
      title: 'Range job',
      engagementStatus: 'completed',
      kind: 'deadline_range',
      startDate: '2026-10-20',
      endDate: '2026-10-24',
    }),
    scheduled({
      engagementId: 'eng-pay',
      workRequestId: null,
      title: 'Awaiting',
      engagementStatus: 'pending_payment',
      startDate: '2026-10-22',
      endDate: '2026-10-22',
      tentative: true,
    }),
    scheduled({
      engagementId: 'eng-dispute',
      workRequestId: 'req-3',
      title: 'Disputed job',
      engagementStatus: 'disputed',
      startDate: '2026-10-22',
      endDate: '2026-10-22',
    }),
    scheduled({
      engagementId: 'eng-bad',
      title: 'Broken',
      startDate: '2026-10-22',
      endDate: '2026-10-01',
    }),
    { engagementId: 'eng-cancelled', title: 'Gone', engagementStatus: 'cancelled' },
  ],
  unscheduled: [
    {
      engagementId: 'eng-open',
      workRequestId: '  req-open  ',
      title: 'Flexible work',
      engagementStatus: 'in_progress',
      counterpart,
      tentative: false,
      viewerRole: 'provider',
    },
    {
      engagementId: 'eng-blank',
      workRequestId: '   ',
      title: 'No request',
      engagementStatus: 'payment_failed',
      counterpart: { ...counterpart, avatarUrl: 12 },
    },
  ],
};

const parsed = page.parseCalendarPage(raw, '2026-10-01', '2026-10-31');
assert.ok(parsed);
assert.equal(parsed.scheduled.length, 4);
assert.equal(parsed.unscheduled.length, 2);
assert.equal(parsed.unscheduledHasMore, true);
assert.equal(parsed.scheduledHasMore, false);
assert.equal(page.parseCalendarPage(raw, '2026-09-01', '2026-09-30'), null);
assert.equal(page.parseCalendarPage({ ...raw, scheduled: null }, '2026-10-01', '2026-10-31'), null);

const pending = parsed.scheduled.find((item) => item.engagementId === 'eng-pay');
assert.equal(pending.workRequestId, null);
assert.equal(pending.statusLabel, 'Pending Payment');
assert.equal(parsed.scheduled.some((item) => item.engagementStatus === 'completed'), true);
assert.equal(parsed.scheduled.some((item) => item.engagementStatus === 'disputed'), true);
assert.equal(parsed.unscheduled[0].workRequestId, 'req-open');
assert.equal(parsed.unscheduled[1].workRequestId, null);
assert.equal(parsed.unscheduled[1].statusLabel, 'Payment Failed');
assert.equal(parsed.unscheduled[1].counterpart.avatarUrl, null);
assert.equal('source' in parsed.scheduled[0], false);
assert.equal('viewerRole' in parsed.scheduled[0], false);
assert.equal('tentative' in parsed.scheduled[0], false);

const range = parsed.scheduled.find((item) => item.engagementId === 'eng-range');
for (const day of ['2026-10-19', '2026-10-25']) {
  assert.equal(page.scheduledOnDay([range], day).length, 0, day);
}
for (const day of ['2026-10-20', '2026-10-22', '2026-10-24']) {
  assert.equal(page.scheduledOnDay([range], day).length, 1, day);
}
const onThe22 = page.scheduledOnDay(parsed.scheduled, '2026-10-22');
assert.deepEqual(
  onThe22.map((item) => item.engagementId),
  ['eng-exact', 'eng-range', 'eng-pay', 'eng-dispute'],
);

const marks = page.indicatorDays(parsed.scheduled, '2026-10-01', '2026-10-31');
assert.equal(marks.includes('2026-10-19'), false);
assert.equal(marks.includes('2026-10-25'), false);
for (const day of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
  assert.equal(marks.filter((mark) => mark === day).length, 1, day);
}

assert.equal(
  page.shouldApplyCalendarResult(
    { generation: 2, from: '2026-11-01', to: '2026-11-30' },
    { generation: 1, from: '2026-10-01', to: '2026-10-31' },
  ),
  false,
);
assert.equal(
  page.shouldApplyCalendarResult(
    { generation: 2, from: '2026-11-01', to: '2026-11-30' },
    { generation: 2, from: '2026-11-01', to: '2026-11-30' },
  ),
  true,
);

assert.deepEqual(page.workRequestRoute('req-1'), { requestId: 'req-1' });
assert.equal(page.workRequestRoute(null), null);
assert.equal(page.workRequestRoute(''), null);

const service = read('src/screens/profile/RequestServiceScreen.tsx');
assert.equal(service.includes("toLocaleString('default'"), false);
assert.equal(service.includes('toLocaleDateString'), false);
assert.equal(service.includes('formatGregorianMonthTitle(year, month + 1, getAppliedLocale())'), true);
assert.equal(service.includes('gregorianWeekdayHeading'), true);

const deadlines = read('src/services/workRequestApi.ts');
const deadlineLabel = deadlines.match(
  /function formatIsoDateLabel[\s\S]*?\nexport function formatDeadline[\s\S]*?\n\}/,
);
assert.equal(/toLocale|Intl\.|new Date\(\s*['"`]/.test(deadlineLabel?.[0] ?? 'missing'), false);
assert.equal(deadlines.includes('MONTH_NAMES[month - 1]'), true);

const detail = read('src/screens/jobs/WorkRequestDetailScreen.tsx');
const pickedDate = detail.match(/function formatPickedDate\(date: Date\) \{([\s\S]*?)\n\}/);
assert.equal(pickedDate?.[1].includes('formatGregorianLocalDay(date, getAppliedLocale())'), true);
assert.equal(/toLocale|Intl\./.test(pickedDate?.[1] ?? 'missing'), false);
assert.equal(detail.includes('toLocaleDateString'), false);
assert.equal(detail.includes("toLocaleString('default'"), false);

const screen = read('src/screens/profile/CalendarScreen.tsx');
assert.equal(screen.includes("navigate('WorkRequestDetail'"), true);
assert.equal(screen.includes('getEventsForDay'), false);
assert.equal(screen.includes('agreed_terms'), false);
assert.equal(screen.includes('viewerRole'), false);
assert.equal(screen.includes('Date not set'), true);
assert.equal(screen.includes('More unscheduled work exists'), true);

console.log('calendar-phase-c-selftest ok');
