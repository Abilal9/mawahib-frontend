/**
 * Explore pagination must keep the list open after a 429.
 * Exercises the production state helpers used by useGuestExplore.
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./ts-selftest-loader.mjs', import.meta.url), {
  parentURL: import.meta.url,
});

const { ApiError } = await import('../src/lib/identityFences.ts');
const {
  expireExploreRefresh,
  exploreBucketAfterFailure,
  exploreBucketAfterPage,
  exploreLoadMoreBlocked,
  exploreMoreDispatch,
  exploreResultIsCurrent,
  releaseExploreMoreLock,
} = await import('../src/lib/guestExploreLoadState.ts');
const { PUBLIC_RATE_LIMIT_MESSAGE, publicErrorMessage } = await import(
  '../src/lib/publicErrors.ts'
);

const page = [{ id: 'row-1' }, { id: 'row-2' }];
const loaded = {
  items: page,
  error: null,
  initialLoading: false,
  refreshing: false,
  loadingMore: true,
  hasMore: true,
};

const limited = exploreBucketAfterFailure(loaded, 'more', new ApiError(429, 'Request failed (429)'));
assert.deepEqual(limited.items, page);
assert.equal(limited.items.length, loaded.items.length);
assert.equal(limited.hasMore, true);
assert.equal(limited.loadingMore, false);
assert.equal(limited.initialLoading, false);
assert.equal(limited.refreshing, false);
assert.equal(limited.error, PUBLIC_RATE_LIMIT_MESSAGE);
assert.equal(publicErrorMessage(new ApiError(429, 'raw')), PUBLIC_RATE_LIMIT_MESSAGE);

const refreshed = exploreBucketAfterFailure(
  { ...loaded, refreshing: true, loadingMore: false },
  'refresh',
  new ApiError(429, 'raw'),
);
assert.deepEqual(refreshed.items, page);
assert.equal(refreshed.hasMore, true);
assert.equal(refreshed.refreshing, false);

const reset = exploreBucketAfterFailure(loaded, 'reset', new ApiError(429, 'raw'));
assert.deepEqual(reset.items, []);
assert.equal(reset.hasMore, false);
assert.equal(reset.initialLoading, false);

const serverError = exploreBucketAfterFailure(loaded, 'more', new ApiError(500, 'nope'));
assert.deepEqual(serverError.items, page);
assert.equal(serverError.hasMore, false);
assert.equal(serverError.error, 'Something went wrong. Try again.');

const retried = exploreBucketAfterPage(
  limited,
  'more',
  [{ id: 'row-3' }],
  1,
  limited.items.length,
  20,
  200,
);
assert.deepEqual(
  retried.items.map((item) => item.id),
  ['row-1', 'row-2', 'row-3'],
);
assert.equal(retried.error, null);
assert.equal(retried.loadingMore, false);
assert.equal(retried.hasMore, false);

const newer = {
  ...loaded,
  items: [{ id: 'newer' }],
  loadingMore: true,
};
assert.equal(exploreResultIsCurrent(1, 2, true), false);
assert.equal(exploreResultIsCurrent(2, 2, false), false);
assert.equal(exploreResultIsCurrent(2, 2, true), true);
const stale = exploreResultIsCurrent(1, 2, true)
  ? exploreBucketAfterFailure(newer, 'more', new ApiError(429, 'raw'))
  : newer;
assert.equal(stale, newer);
assert.deepEqual(stale.items, [{ id: 'newer' }]);
assert.equal(stale.loadingMore, true);
assert.equal(stale.hasMore, true);

const blockedInput = {
  searchBlocked: false,
  initialLoading: false,
  refreshing: false,
  loadingMore: false,
  hasMore: limited.hasMore,
  itemCount: limited.items.length,
  maxSkip: 200,
  error: limited.error,
};
assert.equal(exploreLoadMoreBlocked(blockedInput), true);
assert.equal(
  exploreLoadMoreBlocked({ ...blockedInput, refreshing: true, error: null }),
  true,
);
assert.equal(exploreLoadMoreBlocked({ ...blockedInput, error: null }), false);
assert.equal(exploreMoreDispatch({ blocked: false, inFlight: true }), 'ignore');
assert.equal(exploreMoreDispatch({ blocked: false, inFlight: false }), 'start');
assert.equal(exploreMoreDispatch({ blocked: true, inFlight: false }), 'ignore');
assert.equal(releaseExploreMoreLock(4, 4), 0);
assert.equal(releaseExploreMoreLock(4, 7), 7);
const expiredGen = expireExploreRefresh(4, 4);
assert.equal(expiredGen, 5);
assert.equal(exploreResultIsCurrent(4, expiredGen, true), false);
assert.equal(expireExploreRefresh(3, 4), null);

console.log('guest explore rate-limit selftest ok');
