/**
 * Durable media cache owner, pending marker, and fail-closed reconcile.
 * Run: node --no-warnings --experimental-strip-types scripts/media-cache-owner-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mem = new Map();
let failRead = false;
let failWrite = false;
let failRemove = false;

globalThis.localStorage = {
  getItem: (key) => {
    if (failRead) throw new Error('read fail');
    return mem.has(key) ? mem.get(key) : null;
  },
  setItem: (key, value) => {
    if (failWrite) throw new Error('write fail');
    mem.set(key, String(value));
  },
  removeItem: (key) => {
    if (failRemove) throw new Error('remove fail');
    mem.delete(key);
  },
};

const {
  clearMediaCacheClearPending,
  clearMediaCacheOwner,
  markMediaCacheClearPending,
  mediaCacheOwnerFromUserId,
  ownersRequireCacheClear,
  parseMediaCacheOwner,
  readMediaCacheClearPending,
  readMediaCacheOwner,
  reconcileMediaCacheOwner,
  shouldClearMediaImageCache,
  writeMediaCacheOwner,
} = await import('../src/lib/mediaCacheOwner.ts');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function reset() {
  mem.clear();
  failRead = false;
  failWrite = false;
  failRemove = false;
}

assert.equal(mediaCacheOwnerFromUserId('user-a'), 'user:user-a');
assert.equal(mediaCacheOwnerFromUserId(null), 'guest');
assert.equal(parseMediaCacheOwner('guest'), 'guest');
assert.equal(parseMediaCacheOwner('user:abc'), 'user:abc');
assert.equal(parseMediaCacheOwner('nope'), null);

assert.equal(shouldClearMediaImageCache(undefined, 'user-a'), false);
assert.equal(shouldClearMediaImageCache(null, 'user-b'), false);
assert.equal(shouldClearMediaImageCache('user-a', null), true);
assert.equal(shouldClearMediaImageCache('user-a', 'user-b'), true);
assert.equal(shouldClearMediaImageCache('user-a', 'user-a'), false);

assert.equal(ownersRequireCacheClear(null, 'user:A'), false);
assert.equal(ownersRequireCacheClear('user:A', 'user:A'), false);
assert.equal(ownersRequireCacheClear('user:A', 'user:B'), true);
assert.equal(ownersRequireCacheClear('user:A', 'guest'), true);
assert.equal(ownersRequireCacheClear('guest', 'user:A'), true);

// No stored owner → authenticated A: establish, no clear.
reset();
let clears = 0;
let result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.owner, 'user:A');
  assert.equal(result.cleared, false);
}
assert.equal(clears, 0);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'user:A' });

// Owner A → A: no clear.
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) assert.equal(result.cleared, false);
assert.equal(clears, 0);

// Owner A → B: clear once, then owner B.
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'user:B',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.owner, 'user:B');
  assert.equal(result.cleared, true);
}
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'user:B' });

// Owner A → signed-out/guest: clear before signed-out media.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.owner, 'guest');
  assert.equal(result.cleared, true);
}
assert.equal(clears, 1);

// Guest → A: establish A. Clear because stored guest !== A.
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) assert.equal(result.owner, 'user:A');
assert.equal(clears, 1);

// No stored owner → signed-out: clear, then establish guest.
reset();
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.owner, 'guest');
  assert.equal(result.cleared, true);
}
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'guest' });

// Unreadable owner: fail closed, must clear.
reset();
mem.set('mawahib.mediaCacheOwner.v1', 'not-an-owner');
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);

reset();
failRead = true;
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.reason, 'owner-write');
assert.equal(clears, 1);
failRead = false;

// Owner write failure: not ready.
reset();
failWrite = true;
result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {},
});
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.reason, 'owner-write');
failWrite = false;

// Clear failure: not ready.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    throw new Error('clear failed');
  },
});
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.reason, 'cache-clear');
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'user:A' });

// Pending marker false: normal.
reset();
assert.deepEqual(readMediaCacheClearPending(), { ok: true, pending: false });

// Marker true at cold start: clear required even if owner matches.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
assert.equal(markMediaCacheClearPending().ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheClearPending(), { ok: true, pending: false });

// Marker true + clear failure: remain blocked, marker stays.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
assert.equal(markMediaCacheClearPending().ok, true);
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    throw new Error('clear failed');
  },
});
assert.equal(result.ok, false);
assert.deepEqual(readMediaCacheClearPending(), { ok: true, pending: true });

// Marker write failure is not treated as durable protection by itself.
reset();
failWrite = true;
assert.equal(markMediaCacheClearPending().ok, false);
failWrite = false;
assert.deepEqual(readMediaCacheClearPending(), { ok: true, pending: false });

// Die after marker true: next process still clears.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
assert.equal(markMediaCacheClearPending().ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);

// Die after signout before clear: owner A + current guest forces clear.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);

// Die after clear before marker false: extra clear is safe.
reset();
assert.equal(writeMediaCacheOwner('guest').ok, true);
assert.equal(markMediaCacheClearPending().ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheClearPending(), { ok: true, pending: false });

// Remote revoke: stored user:A, no session (guest).
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'guest' });

assert.equal(clearMediaCacheOwner().ok, true);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: null });
assert.equal(clearMediaCacheClearPending().ok, true);

// Concurrent A→guest then A: stale guest write must not land.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
let releaseGuestClear;
let releaseAClear;
const guestClear = new Promise((resolve) => {
  releaseGuestClear = resolve;
});
const aClear = new Promise((resolve) => {
  releaseAClear = resolve;
});
const guestRun = reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: () => guestClear,
});
const aRun = reconcileMediaCacheOwner({
  current: 'user:A',
  clearCache: () => aClear,
});
releaseGuestClear();
const guestResult = await guestRun;
assert.equal(guestResult.ok, false);
if (!guestResult.ok) assert.equal(guestResult.reason, 'superseded');
releaseAClear();
const aResult = await aRun;
assert.equal(aResult.ok, true);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'user:A' });

// Die after clear before owner write: remain blocked; next process still clears.
reset();
assert.equal(writeMediaCacheOwner('user:A').ok, true);
failWrite = true;
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.reason, 'owner-write');
assert.equal(clears, 1);
failWrite = false;
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'user:A' });
clears = 0;
result = await reconcileMediaCacheOwner({
  current: 'guest',
  clearCache: async () => {
    clears += 1;
  },
});
assert.equal(result.ok, true);
assert.equal(clears, 1);
assert.deepEqual(readMediaCacheOwner(), { ok: true, owner: 'guest' });

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /reconcileMediaCacheOwner/);
assert.match(auth, /markMediaCacheClearPending/);
assert.doesNotMatch(auth, /imageCacheReady \? children : null/);
assert.doesNotMatch(auth, /clearMediaImageCache\(\)\.finally/);
assert.match(auth, /<AuthContext.Provider value=\{value\}>\{children\}/);

const app = read('App.tsx');
assert.match(app, /NavigationContainer/);
assert.match(app, /AuthTransitionOverlay/);
assert.doesNotMatch(app, /imageCacheReady \? children : null/);

const navigator = read('src/navigation/RootNavigator.tsx');
assert.match(navigator, /hasConsumedProcessStart/);
assert.match(navigator, /: 'Splash1'/);
assert.match(navigator, /processStarted && !mediaCacheReady/);
assert.match(navigator, /key="media-hold"/);
assert.match(navigator, /key="app"/);

const splash = read('src/screens/onboarding/SplashScreen2.tsx');
assert.match(splash, /mediaCacheReady/);
assert.ok(
  splash.indexOf('consumeProcessStart()') <
    splash.indexOf("name: 'GuestTabs'"),
);

const overlay = read('src/components/auth/AuthTransitionOverlay.tsx');
assert.match(overlay, /Try again/);
assert.doesNotMatch(overlay, /from '@react-navigation\/native'/);

const processStart = read('src/lib/processStart.ts');
assert.match(processStart, /let processStartConsumed = false/);
assert.doesNotMatch(processStart, /localStorage/);

assert.doesNotMatch(auth, /writeMediaCacheOwner/);
assert.match(auth, /TOKEN_REFRESHED/);
assert.ok(
  auth.indexOf("if (event === 'TOKEN_REFRESHED')") >
    0 &&
    !auth
      .slice(auth.indexOf("if (event === 'TOKEN_REFRESHED')"))
      .includes('reconcileMediaCacheOwner'),
);
assert.match(auth, /markMediaCacheClearPending/);
assert.match(auth, /mediaPauseRef/);
assert.match(auth, /result.reason === 'superseded'/);
assert.doesNotMatch(auth, /consumeProcessStart/);
assert.match(
  auth.slice(auth.indexOf('const signOut = useCallback')),
  /clearMediaImageCache/,
);
const signOutBody = auth.slice(auth.indexOf('const signOut = useCallback'));
assert.match(signOutBody, /markMediaCacheClearPending/);
const mutation = read('src/lib/authSessionMutation.ts');
const attempt = mutation.slice(mutation.indexOf('export async function runSignOutAttempt'));
assert.ok(
  attempt.indexOf('input.markCachePending()') <
    attempt.indexOf('input.signOutLocal()'),
);
const markedFailAt = attempt.indexOf('!marked.ok');
assert.ok(markedFailAt !== -1);
assert.ok(
  attempt.indexOf('input.boundary.fail', markedFailAt) <
    attempt.indexOf('throw new Error', markedFailAt),
);
const applyOutcome = auth.slice(auth.indexOf('const applySignedOutOutcome'));
assert.match(applyOutcome, /clearAuthenticatedState\(\)/);
assert.ok(
  applyOutcome.indexOf('setMediaRetryTick') <
    applyOutcome.indexOf('clearAuthenticatedState()'),
);

const deepLink = read('src/components/auth/AuthDeepLinkListener.tsx');
assert.match(deepLink, /mediaCacheReady/);
assert.match(deepLink, /consumeProcessStart\(\)/);
assert.ok(
  deepLink.indexOf('apiUserRef.current?.id === user.id') <
    deepLink.indexOf('consumeProcessStart()'),
);
assert.ok(
  deepLink.indexOf('consumeProcessStart()') <
    deepLink.indexOf('applyPostAuthDestination(navigationRef.current, dest)'),
);

console.log('media-cache-owner-selftest ok');
