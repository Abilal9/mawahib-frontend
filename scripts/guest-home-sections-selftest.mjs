/**
 * Guest Home section publication fences and signed-in jobs loading status.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyGuestHomeSectionFailure,
  applyGuestHomeSectionSuccess,
  emptyGuestHomeSection,
  releaseGuestHomeSectionPending,
  shouldClearGuestHomeRefresh,
} from '../src/lib/guestHomeSections.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const pending = emptyGuestHomeSection();
assert.deepEqual(pending, { items: [], loading: true, error: null });

const loaded = applyGuestHomeSectionSuccess(pending, [{ id: 'a' }], {
  requestGen: 1,
  liveGen: 1,
  mounted: true,
});
assert.deepEqual(loaded, { items: [{ id: 'a' }], loading: false, error: null });

const staleSuccess = applyGuestHomeSectionSuccess(loaded, [{ id: 'old' }], {
  requestGen: 1,
  liveGen: 2,
  mounted: true,
});
assert.equal(staleSuccess, loaded);

const unmounted = applyGuestHomeSectionSuccess(loaded, [{ id: 'x' }], {
  requestGen: 2,
  liveGen: 2,
  mounted: false,
});
assert.equal(unmounted, loaded);

const failed = applyGuestHomeSectionFailure(loaded, 'unavailable', {
  requestGen: 3,
  liveGen: 3,
  mounted: true,
  preserveItems: true,
});
assert.deepEqual(failed, {
  items: [{ id: 'a' }],
  loading: false,
  error: 'unavailable',
});

const resetFail = applyGuestHomeSectionFailure(pending, 'unavailable', {
  requestGen: 1,
  liveGen: 1,
  mounted: true,
  preserveItems: false,
});
assert.deepEqual(resetFail, { items: [], loading: false, error: 'unavailable' });

assert.equal(
  shouldClearGuestHomeRefresh({ requestGen: 4, liveGen: 4, mounted: true }),
  true,
);
assert.equal(
  shouldClearGuestHomeRefresh({ requestGen: 4, liveGen: 5, mounted: true }),
  false,
);

const withItems = { items: [{ id: 'a' }], loading: true, error: null };
const staleCurrent = releaseGuestHomeSectionPending(withItems, {
  requestGen: 2,
  liveGen: 2,
  mounted: true,
});
assert.deepEqual(staleCurrent, { items: [{ id: 'a' }], loading: false, error: null });

const emptyPending = emptyGuestHomeSection();
const staleEmpty = releaseGuestHomeSectionPending(emptyPending, {
  requestGen: 1,
  liveGen: 1,
  mounted: true,
});
assert.deepEqual(staleEmpty, { items: [], loading: false, error: null });
assert.equal(staleEmpty.error, null);

const newer = { items: [], loading: true, error: null };
const supersededFirst = releaseGuestHomeSectionPending(newer, {
  requestGen: 1,
  liveGen: 2,
  mounted: true,
});
assert.equal(supersededFirst, newer);

const settledB = applyGuestHomeSectionSuccess(newer, [{ id: 'b' }], {
  requestGen: 2,
  liveGen: 2,
  mounted: true,
});
const lateA = releaseGuestHomeSectionPending(settledB, {
  requestGen: 1,
  liveGen: 2,
  mounted: true,
});
assert.equal(lateA, settledB);

const unmountedStale = releaseGuestHomeSectionPending(emptyPending, {
  requestGen: 4,
  liveGen: 4,
  mounted: false,
});
assert.equal(unmountedStale, emptyPending);

const afterCancel = releaseGuestHomeSectionPending(emptyPending, {
  requestGen: 5,
  liveGen: 5,
  mounted: true,
});
const refreshed = applyGuestHomeSectionSuccess(afterCancel, [{ id: 'next' }], {
  requestGen: 6,
  liveGen: 6,
  mounted: true,
});
assert.deepEqual(refreshed, { items: [{ id: 'next' }], loading: false, error: null });

const homeHook = read('src/hooks/useGuestHome.ts');
assert.match(homeHook, /releaseGuestHomeSectionPending/);
assert.match(homeHook, /Promise\.allSettled/);
assert.match(homeHook, /GUEST_HOME_REFRESH_WATCHDOG_MS/);
assert.equal(homeHook.includes('apiRequest'), false);
assert.equal(homeHook.includes('/feed?'), false);

const homeScreen = read('src/screens/guest/GuestHomeScreen.tsx');
assert.match(homeScreen, /GuestAppHeader/);
assert.match(homeScreen, /section\.loading/);
assert.match(homeScreen, /HomeSplashLoader/);
assert.equal(homeScreen.includes('Promise.all'), false);

const signedInHome = read('src/screens/home/HomeScreen.tsx');
assert.match(signedInHome, /jobsLoading/);
assert.match(signedInHome, /resolveHomeSectionAppearance/);
assert.ok(
  signedInHome.indexOf('const [jobsLoading, setJobsLoading] = useState(true)') <
    signedInHome.indexOf('No open job listings yet.'),
);
assert.ok(
  signedInHome.indexOf("jobsAppearance === 'empty'") <
    signedInHome.indexOf('No open job listings yet.'),
);

console.log('guest-home-sections-selftest ok');
