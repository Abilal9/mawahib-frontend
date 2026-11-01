/**
 * Guest Explore query combination: typed q AND canonical categoryIds.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGuestExploreQuery } from '../src/lib/guestExploreQuery.ts';
import {
  buildPublicSearchQuery,
  PUBLIC_Q_MIN_LENGTH,
} from '../src/services/publicQuery.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

assert.equal(PUBLIC_Q_MIN_LENGTH, 2);

const CATEGORY = '55555555-5555-4555-8555-555555555555';

assert.deepEqual(resolveGuestExploreQuery('', null), {
  blocked: false,
  categoryIds: undefined,
});
assert.deepEqual(resolveGuestExploreQuery('a', null), { blocked: true });
assert.deepEqual(resolveGuestExploreQuery('a', CATEGORY), {
  blocked: false,
  categoryIds: [CATEGORY],
});
assert.deepEqual(resolveGuestExploreQuery('ab', CATEGORY), {
  blocked: false,
  q: 'ab',
  categoryIds: [CATEGORY],
});
assert.deepEqual(resolveGuestExploreQuery('Photography', null), {
  blocked: false,
  q: 'Photography',
  categoryIds: undefined,
});
assert.deepEqual(resolveGuestExploreQuery('', [CATEGORY]), {
  blocked: false,
  categoryIds: [CATEGORY],
});
assert.deepEqual(resolveGuestExploreQuery('ab', [CATEGORY, CATEGORY]), {
  blocked: false,
  q: 'ab',
  categoryIds: [CATEGORY, CATEGORY],
});
assert.deepEqual(resolveGuestExploreQuery('', []), {
  blocked: false,
  categoryIds: undefined,
});

const combined = buildPublicSearchQuery({
  q: 'ab',
  categoryIds: [CATEGORY],
});
assert.match(combined, /q=ab/);
assert.match(combined, new RegExp(`categoryIds=${CATEGORY}`));

const hook = read('src/hooks/useGuestExplore.ts');
assert.match(hook, /refreshing: boolean/);
assert.match(hook, /GUEST_EXPLORE_REFRESH_WATCHDOG_MS/);
assert.equal(hook.includes('selectedCategoryName'), false);
assert.equal(hook.includes('nameEn.trim()'), false);

const cards = read('src/components/guest/GuestDiscoveryCards.tsx');
assert.match(cards, /guestServiceCardPrice/);
assert.match(cards, /fromPrice/);
assert.match(read('src/components/explore/ExploreServiceCard.tsx'), /MoneyAmount/);

console.log('guest-explore-query-selftest ok');
