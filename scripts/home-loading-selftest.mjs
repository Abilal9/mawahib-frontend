/**
 * Home loading coordination for Guest and signed-in Home.
 * Executes the presentation table; also checks screens do not stack
 * competing Home spinners.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearFeedRequest,
  feedInitialPending,
  initialFeedRequest,
  replaceFeedRequest,
  settleFeedFailure,
  settleFeedSuccess,
} from '../src/lib/feedLifecycle.ts';
import {
  resolveHomeInitialLoader,
  resolveHomePageEmpty,
  resolveHomePaginationIndicator,
  resolveHomeSectionAppearance,
  sectionHasVisibleError,
} from '../src/lib/homeLoadingPresentation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// Initial: all pending, no content → one loader.
assert.equal(
  resolveHomeInitialLoader({
    hasContent: false,
    anyPending: true,
    refreshing: false,
    hasVisibleError: false,
  }),
  true,
);

// Fast section with items dismisses the initial loader.
assert.equal(
  resolveHomeInitialLoader({
    hasContent: true,
    anyPending: true,
    refreshing: false,
    hasVisibleError: false,
  }),
  false,
);
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 3,
    loading: false,
    error: null,
    showInitialLoader: false,
  }),
  'content',
);
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 0,
    loading: true,
    error: null,
    showInitialLoader: false,
  }),
  'placeholder',
);

// Empty settled section while others pending: keep the page loader, omit empty copy.
assert.equal(
  resolveHomeInitialLoader({
    hasContent: false,
    anyPending: true,
    refreshing: false,
    hasVisibleError: false,
  }),
  true,
);
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 0,
    loading: false,
    error: null,
    showInitialLoader: true,
    showSettledEmpty: true,
  }),
  'omit',
);

// One failed section with no content: do not take over with the initial loader.
assert.equal(
  sectionHasVisibleError({ error: 'unavailable', itemCount: 0 }),
  true,
);
assert.equal(
  resolveHomeInitialLoader({
    hasContent: false,
    anyPending: true,
    refreshing: false,
    hasVisibleError: true,
  }),
  false,
);
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 0,
    loading: false,
    error: 'unavailable',
    showInitialLoader: false,
  }),
  'error',
);

// Section retry while other errors remain: placeholder, not page loader.
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 0,
    loading: true,
    error: null,
    showInitialLoader: false,
  }),
  'placeholder',
);

// All empty settled.
assert.equal(
  resolveHomePageEmpty({
    hasContent: false,
    anyPending: false,
    allFailed: false,
  }),
  'empty',
);
assert.equal(
  resolveHomeInitialLoader({
    hasContent: false,
    anyPending: false,
    refreshing: false,
    hasVisibleError: false,
  }),
  false,
);
assert.equal(
  resolveHomeSectionAppearance({
    itemCount: 0,
    loading: false,
    error: null,
    showInitialLoader: false,
    showSettledEmpty: true,
  }),
  'empty',
);

// All failed settled.
assert.equal(
  resolveHomePageEmpty({
    hasContent: false,
    anyPending: false,
    allFailed: true,
  }),
  'error',
);

// Refresh with content: native refresh only.
assert.equal(
  resolveHomeInitialLoader({
    hasContent: true,
    anyPending: true,
    refreshing: true,
    hasVisibleError: false,
  }),
  false,
);

// Pagination footer only after the initial loader is gone.
assert.equal(
  resolveHomePaginationIndicator({
    showInitialLoader: true,
    loadingMore: true,
  }),
  false,
);
assert.equal(
  resolveHomePaginationIndicator({
    showInitialLoader: false,
    loadingMore: true,
  }),
  true,
);

const splashDots = read('src/components/onboarding/SplashLoadingDots.tsx');
assert.match(splashDots, /duration: 350/);
assert.match(splashDots, /Animated\.delay\(delay\)/);
assert.match(splashDots, /animate\(dot2, 150\)/);
assert.match(splashDots, /animate\(dot3, 300\)/);
assert.match(splashDots, /opacity: dot, transform: \[\{ scale: dot \}\]/);
assert.match(splashDots, /backgroundColor: colors\.primary/);
assert.match(splashDots, /width: 10/);
assert.match(splashDots, /gap: spacing\.sm/);
assert.match(splashDots, /a1\.stop\(\)/);
assert.equal(splashDots.includes('setTimeout'), false);
assert.equal(splashDots.includes('AccessibilityInfo'), false);

const splash2 = read('src/screens/onboarding/SplashScreen2.tsx');
assert.match(splash2, /<SplashLoadingDots \/>/);

const loader = read('src/components/ui/HomeSplashLoader.tsx');
assert.match(loader, /<SplashLoadingDots \/>/);
assert.match(loader, /splashLoadingDotStyles/);
assert.match(loader, /isReduceMotionEnabled/);
assert.match(loader, /reduceMotionChanged/);
assert.match(loader, /pointerEvents="none"/);
assert.match(loader, /fill \? styles\.fill/);
assert.match(loader, /accessibilityLabel/);
assert.equal(loader.includes('useAuth'), false);
assert.equal(loader.includes('fetch('), false);
assert.equal(loader.includes('ActivityIndicator'), false);
assert.equal(loader.includes('setTimeout'), false);
assert.equal(loader.includes('translateY'), false);
assert.equal(loader.includes('duration:'), false);

const placeholder = read('src/components/ui/HomePendingPlaceholder.tsx');
assert.equal(placeholder.includes('Animated'), false);
assert.equal(placeholder.includes('ActivityIndicator'), false);

const guestHome = read('src/screens/guest/GuestHomeScreen.tsx');
assert.match(guestHome, /HomeSplashLoader fill/);
assert.match(guestHome, /HomePendingPlaceholder/);
assert.match(guestHome, /resolveHomeInitialLoader/);
assert.equal(guestHome.includes('GuestStatusBlock loading'), false);
assert.equal(guestHome.includes('ActivityIndicator'), false);
assert.equal(guestHome.includes('Promise.all('), false);

function presentFeed(phase, count, error, refreshing) {
  const feedPending = feedInitialPending(phase);
  const hasContent = count > 0;
  const showInitialLoader = resolveHomeInitialLoader({
    hasContent,
    anyPending: feedPending,
    refreshing,
    hasVisibleError: Boolean(error) && count === 0,
  });
  const appearance = resolveHomeSectionAppearance({
    itemCount: count,
    loading: feedPending,
    error,
    showInitialLoader,
    showSettledEmpty: true,
  });
  return { showInitialLoader, appearance };
}

const idle = initialFeedRequest();
assert.equal(idle.phase, 'idle');
assert.deepEqual(presentFeed('idle', 0, null, false), {
  showInitialLoader: true,
  appearance: 'omit',
});

const pending = replaceFeedRequest(idle, 'account-a');
assert.equal(pending.phase, 'pending');
assert.equal(presentFeed(pending.phase, 0, null, false).showInitialLoader, true);

const withPosts = settleFeedSuccess(pending, 'account-a', pending.requestId);
assert.equal(withPosts.phase, 'ready');
assert.deepEqual(presentFeed('ready', 2, null, false), {
  showInitialLoader: false,
  appearance: 'content',
});

const emptyReady = settleFeedSuccess(pending, 'account-a', pending.requestId);
assert.equal(emptyReady.phase, 'ready');
assert.equal(feedInitialPending('ready'), false);
function previousHomeFeedPending(input) {
  const feedAttempted = Boolean(input.loading || input.error || input.count > 0);
  return !feedAttempted || input.loading;
}
assert.equal(
  previousHomeFeedPending({ loading: false, error: null, count: 0 }),
  true,
);
assert.deepEqual(presentFeed('ready', 0, null, false), {
  showInitialLoader: false,
  appearance: 'empty',
});
assert.equal(feedInitialPending('idle'), true);

const failed = settleFeedFailure(pending, 'account-a', pending.requestId);
assert.equal(failed.phase, 'error');
assert.deepEqual(presentFeed('error', 0, 'unavailable', false), {
  showInitialLoader: false,
  appearance: 'error',
});

const refreshing = replaceFeedRequest(emptyReady, 'account-a');
assert.equal(refreshing.phase, 'ready');
assert.equal(refreshing.requestId, emptyReady.requestId + 1);
assert.equal(presentFeed(refreshing.phase, 0, null, true).showInitialLoader, false);
const refreshed = settleFeedSuccess(refreshing, 'account-a', refreshing.requestId);
assert.equal(refreshed.phase, 'ready');

const accountB = replaceFeedRequest(pending, 'account-b');
assert.equal(accountB.phase, 'pending');
assert.equal(accountB.ownerId, 'account-b');
const lateA = settleFeedSuccess(accountB, 'account-a', pending.requestId);
assert.equal(lateA, accountB);
assert.equal(lateA.phase, 'pending');
const readyB = settleFeedSuccess(accountB, 'account-b', accountB.requestId);
assert.equal(readyB.phase, 'ready');
assert.equal(readyB.ownerId, 'account-b');

const signedOut = clearFeedRequest(readyB);
assert.equal(signedOut.phase, 'idle');
const lateAfterSignOut = settleFeedSuccess(signedOut, 'account-b', readyB.requestId);
assert.equal(lateAfterSignOut, signedOut);

const signedInHome = read('src/screens/home/HomeScreen.tsx');
assert.match(signedInHome, /feedInitialPending\(feedPhase\)/);
assert.equal(signedInHome.includes('feedAttempted'), false);
const postsProvider = read('src/context/PostsContext.tsx');
assert.match(postsProvider, /settleFeedSuccess/);
assert.match(postsProvider, /replaceFeedRequest/);
assert.match(signedInHome, /HomeSplashLoader fill/);
assert.match(signedInHome, /resolveHomeInitialLoader/);
assert.equal(signedInHome.includes('Loading feed'), false);
assert.equal(signedInHome.includes('Loading jobs'), false);
assert.equal(signedInHome.includes('Loading more'), false);
assert.match(signedInHome, /RefreshControl/);
assert.match(signedInHome, /showPagination \? <HomeSplashLoader compact/);
assert.match(signedInHome, /catalogLoading/);
assert.match(signedInHome, /setCatalogError/);

console.log('home-loading-selftest ok');
