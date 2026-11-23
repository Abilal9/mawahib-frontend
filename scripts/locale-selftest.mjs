import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./ts-selftest-loader.mjs', import.meta.url), {
  parentURL: import.meta.url,
});

const { appliedLocaleFor, normalizeLocale } = await import('../src/i18n/locale.ts');
const { setAppliedLocale } = await import('../src/i18n/runtime.ts');
const { catalogLabel } = await import('../src/i18n/catalogLabel.ts');
const { formatUiDateTime } = await import('../src/i18n/format.ts');
const { notificationDisplayCopy, systemChatText } = await import('../src/i18n/noticeCopy.ts');
const { placeLabel } = await import('../src/i18n/places.ts');
const { notificationShowsReviewPrompt } = await import('../src/lib/notificationReviewPrompt.ts');
const { formatMoneyAmountDigits } = await import('../src/utils/money.ts');
const { messages, pluralPhrase, translate } = await import('../src/i18n/messages.ts');

assert.equal(normalizeLocale(null), 'en');
assert.equal(normalizeLocale('fr'), 'en');
assert.equal(normalizeLocale('ar'), 'ar');
assert.equal(normalizeLocale('en'), 'en');

assert.equal(appliedLocaleFor({ saved: 'ar', nativeIsRTL: false }), 'en');
assert.equal(appliedLocaleFor({ saved: 'en', nativeIsRTL: true }), 'ar');
assert.equal(appliedLocaleFor({ saved: 'ar', nativeIsRTL: true }), 'ar');
assert.equal(appliedLocaleFor({ saved: 'en', nativeIsRTL: false }), 'en');

for (const key of Object.keys(messages.en)) {
  assert.equal(typeof messages.ar[key], 'string', key);
}

const title = 'Home Building';
const sentence = translate('ar', 'notice.withPerson', { name: title });
assert.equal(sentence.includes(title), true);
assert.equal(sentence, 'مع Home Building');

assert.equal(pluralPhrase('en', 'nav.reviewCount', 1), '1 review');
assert.equal(pluralPhrase('en', 'nav.reviewCount', 3), '3 reviews');
assert.equal(pluralPhrase('ar', 'nav.reviewCount', 1), 'تقييم واحد');
assert.equal(pluralPhrase('ar', 'nav.reviewCount', 2), 'تقييمان');
assert.match(pluralPhrase('ar', 'nav.reviewCount', 5), /5/);

setAppliedLocale('en');
assert.equal(
  notificationDisplayCopy({
    type: 'engagement_status',
    title: 'Ada',
    body: 'completed the job',
    actorName: 'Ada',
    params: { status: 'completed', jobTitle: title },
  }).context,
  title,
);
assert.equal(
  notificationDisplayCopy({
    type: 'work_request_event',
    title: 'Ada',
    body: 'sent you a work request',
    actorName: 'Ada',
    params: { jobTitle: title },
  }).message,
  'sent you a work request',
);
assert.equal(
  notificationDisplayCopy({
    type: 'work_request_event',
    title: 'Ada',
    body: 'Please review the stairs',
    actorName: 'Ada',
    params: {},
  }).message,
  'Please review the stairs',
);
assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'system',
    engagementStatus: 'completed',
    canSubmit: true,
  }),
  false,
);

setAppliedLocale('ar');
assert.equal(catalogLabel({ nameEn: 'Design', nameAr: null }), 'Design');
assert.equal(catalogLabel({ nameEn: 'Design', nameAr: 'تصميم' }), 'تصميم');
assert.equal(placeLabel('Riyadh'), 'الرياض');
assert.equal(placeLabel(title), title);
assert.equal(formatMoneyAmountDigits(1284.87), '1,284.87');
const formatted = formatUiDateTime('2026-03-15T00:00:00.000Z', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
assert.match(formatted, /2026/);
assert.doesNotMatch(formatted, /[٠-٩]/);
const hidden = notificationDisplayCopy({
  type: 'system',
  title: 'Mawahib',
  body: 'Mawahib hid one of your reviews.',
  params: { workRequestId: 'wr-1' },
});
assert.equal(hidden.message, 'أخفت مواهب أحد تقييماتك.');
assert.equal(hidden.context, undefined);
const started = notificationDisplayCopy({
  type: 'message_received',
  title: 'Ada',
  body: 'private message text',
  actorName: 'Ada',
  params: { event: 'conversation_started', jobTitle: title },
});
assert.equal(started.title, 'Ada');
assert.equal(started.message, 'بدأ محادثة معك');
assert.equal(started.context, title);
assert.equal(
  systemChatText({
    body: 'Work started',
    systemPayload: { event: 'engagement_in_progress' },
  }),
  'بدأ العمل المتفق عليه',
);
assert.equal(systemChatText({ body: title, systemPayload: null }), title);
assert.equal(
  notificationDisplayCopy({
    type: 'engagement_status',
    title: 'Work update',
    body: 'Further work was agreed. The work is in progress.',
    params: { status: 'in_progress', jobTitle: title },
  }).message,
  'Further work was agreed. The work is in progress.',
);
setAppliedLocale('en');

console.log('locale-selftest: ok');
