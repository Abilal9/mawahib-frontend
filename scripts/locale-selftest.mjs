import assert from 'node:assert/strict';
import { appliedLocaleFor, normalizeLocale } from '../src/i18n/locale.ts';
import { messages, pluralPhrase, translate } from '../src/i18n/messages.ts';

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

console.log('locale-selftest: ok');
