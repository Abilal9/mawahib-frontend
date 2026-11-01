/**
 * Phase F: public API client uses publicRequest only, no Authorization,
 * Guest epoch fence drops stale results, q<2 is omitted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  guestIdentityId,
  shouldIgnoreStaleIdentityResult,
} from '../src/context/identityGuard.ts';
import {
  buildPublicCursorQuery,
  buildPublicSearchQuery,
  PUBLIC_MAX_SKIP,
  PUBLIC_MAX_TAKE,
  PUBLIC_Q_MIN_LENGTH,
} from '../src/services/publicQuery.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const publicApi = read('src/services/publicApi.ts');
const fence = read('src/lib/guestRequestFence.ts');
const apiClient = read('src/lib/apiClient.ts');
const identityFences = read('src/lib/identityFences.ts');
const errors = read('src/lib/publicErrors.ts');

assert.match(publicApi, /publicRequest/);
assert.match(publicApi, /captureGuestRequestFence/);
assert.match(publicApi, /isGuestResultStale/);
assert.match(publicApi, /StaleIdentityError/);
assert.equal(publicApi.includes('getSession'), false);
assert.equal(publicApi.includes('Authorization'), false);
assert.equal(publicApi.includes('apiRequest'), false);
assert.equal(publicApi.includes('/feed?'), false);
assert.match(publicApi, /\/public\/feed/);
assert.match(publicApi, /\/public\/posts\/\$\{id\}/);
assert.match(publicApi, /\/public\/users\/\$\{id\}/);
assert.match(publicApi, /\/public\/users\/\$\{id\}\/posts/);
assert.match(publicApi, /\/public\/users\/\$\{id\}\/services/);
assert.match(publicApi, /\/public\/users\/\$\{id\}\/portfolio/);
assert.match(publicApi, /\/public\/users\/\$\{id\}\/reviews/);
assert.match(publicApi, /\/public\/services\/\$\{id\}/);
assert.match(publicApi, /\/public\/services\/\$\{id\}\/reviews/);
assert.match(publicApi, /\/public\/job-listings/);
assert.match(publicApi, /\/public\/job-listings\/\$\{id\}/);
assert.match(publicApi, /\/public\/explore\/talents/);
assert.match(publicApi, /\/public\/explore\/services/);
assert.match(publicApi, /\/public\/taxonomy/);
assert.equal(publicApi.includes('/media/'), false);
assert.equal(publicApi.includes('status:'), false);
assert.equal(publicApi.includes('locationCode'), false);
assert.match(publicApi, /startingPrice/);
assert.match(publicApi, /fromPrice/);
assert.equal(publicApi.includes('locationCode'), false);

assert.match(apiClient, /executePublicRequest/);
assert.match(identityFences, /headers\.delete\('Authorization'\)/);
assert.match(identityFences, /may only call \/public\/\*/);
assert.match(fence, /guestIdentityId/);
assert.match(fence, /authenticatedProductActive/);
assert.match(fence, /mode: 'guest'/);

function isGuestResultStale(started, now) {
  if (now.authenticatedProductActive) return true;
  return shouldIgnoreStaleIdentityResult({
    startedUserId: started.identityId,
    currentUserId: guestIdentityId(now.epoch),
    epochAtStart: started.epoch,
    epochNow: now.epoch,
  });
}

const started = {
  principal: { mode: 'guest', epoch: 3 },
  identityId: guestIdentityId(3),
  epoch: 3,
};
assert.equal(
  isGuestResultStale(started, { epoch: 3, authenticatedProductActive: false }),
  false,
);
assert.equal(
  isGuestResultStale(started, { epoch: 4, authenticatedProductActive: false }),
  true,
  'Guest epoch bump must drop the in-flight result',
);
assert.equal(
  isGuestResultStale(started, { epoch: 3, authenticatedProductActive: true }),
  true,
  'Guest→Auth must drop the Guest result even if epoch were unchanged',
);

const browse = buildPublicSearchQuery({ skip: 0, take: 8 });
assert.equal(browse.includes('q='), false);
assert.equal(browse.includes('categoryIds='), false);
assert.match(browse, /take=8/);
const CATEGORY = '55555555-5555-4555-8555-555555555555';
const filtered = buildPublicSearchQuery({
  q: 'ab',
  skip: 0,
  take: 20,
  categoryIds: [CATEGORY, 'not-a-uuid', CATEGORY],
});
assert.match(filtered, new RegExp(`categoryIds=${CATEGORY}`));
assert.equal(filtered.includes('not-a-uuid'), false);
assert.equal(
  buildPublicSearchQuery({
    categoryIds: ['not-a-uuid'],
  }).includes('categoryIds='),
  false,
);
assert.equal(buildPublicSearchQuery({ q: 'ab' }).includes('locationCode'), false);
assert.equal(buildPublicSearchQuery({ q: 'ab' }).includes('status='), false);
const oneChar = buildPublicSearchQuery({ q: 'a', skip: 0, take: 20 });
assert.equal(oneChar.includes('q='), false);
assert.equal(PUBLIC_Q_MIN_LENGTH, 2);
const twoChar = buildPublicSearchQuery({ q: 'ab', skip: 0, take: 50 });
assert.match(twoChar, /q=ab/);
assert.match(twoChar, /take=20/);
assert.equal(twoChar.includes('take=50'), false);
const cappedSkip = buildPublicSearchQuery({ skip: 500, take: 20 });
assert.match(cappedSkip, new RegExp(`skip=${PUBLIC_MAX_SKIP}`));
assert.equal(PUBLIC_MAX_TAKE, 20);

const cursor = buildPublicCursorQuery({ take: 12 });
assert.match(cursor, /take=12/);
assert.equal(cursor.includes('cursor='), false);
const withCursor = buildPublicCursorQuery({ cursor: 'abc', take: 20 });
assert.match(withCursor, /cursor=abc/);

assert.match(errors, /status === 404/);
assert.match(errors, /unavailable/);
assert.match(errors, /Try again/);
assert.equal(errors.includes('SignIn'), false);
assert.equal(errors.includes("navigate('SignIn')"), false);

console.log('guest-public-api-selftest ok');
