/**
 * Phase F: Guest Home/Explore/profile/detail use public APIs only.
 * No authenticated providers, viewer flags, or mutations.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const PRIVATE_HOOKS = [
  'useSaved',
  'useConnections',
  'useMyProfile',
  'usePosts',
  'useNotifications',
  'useUserJobs',
  'useVisitorUser',
  'useVisitorProfessionalProfile',
  'useAuth(',
];

const PRIVATE_PROVIDERS = [
  'SavedProvider',
  'ProfileProvider',
  'PostsProvider',
  'NotificationsProvider',
  'MessagingUnreadProvider',
  'UserJobsProvider',
  'ConnectionsProvider',
  'ProfileContext',
  'SavedContext',
  'PostsContext',
  'ConnectionsContext',
];

const MUTATION_MARKERS = [
  'toggleLike',
  'setDesired',
  'likePost',
  'savePost',
  'createComment',
  'requestConnect',
  'openOrCreateConversation',
  'applyToListing',
  'marketplaceApi.',
  'jobService.',
  'catalogService.',
  'postService.',
  'loadTaxonomy(',
  'exploreApi.',
  'apiRequest(',
  'GET /media/',
  '/media/',
];

const guestDir = join(root, 'src/screens/guest');
const hookDir = join(root, 'src/hooks');
const guestFiles = [
  ...readdirSync(guestDir).map((name) => `src/screens/guest/${name}`),
  'src/components/guest/GuestDiscoveryCards.tsx',
  'src/components/guest/GuestScreenHeader.tsx',
  'src/components/layout/GuestCreateMenu.tsx',
  'src/components/layout/GuestAppHeader.tsx',
  'src/hooks/useGuestHome.ts',
  'src/hooks/useGuestExplore.ts',
  'src/hooks/useGuestProfile.ts',
  'src/hooks/useGuestPost.ts',
  'src/hooks/useGuestService.ts',
  'src/hooks/useGuestJob.ts',
  'src/hooks/useGuestReviews.ts',
];

for (const file of guestFiles) {
  const source = read(file);
  for (const hook of PRIVATE_HOOKS) {
    assert.equal(source.includes(hook), false, `${file} must not use ${hook}`);
  }
  for (const provider of PRIVATE_PROVIDERS) {
    assert.equal(
      source.includes(provider),
      false,
      `${file} must not use ${provider}`,
    );
  }
  for (const marker of MUTATION_MARKERS) {
    assert.equal(
      source.includes(marker),
      false,
      `${file} must not include ${marker}`,
    );
  }
  assert.equal(source.includes('isSaved'), false, `${file} must not expect isSaved`);
  assert.equal(source.includes('isLiked'), false, `${file} must not expect isLiked`);
}

const home = read('src/screens/guest/GuestHomeScreen.tsx');
const homeHook = read('src/hooks/useGuestHome.ts');
assert.match(home, /useGuestHome/);
assert.match(homeHook, /fetchPublicExploreTalents/);
assert.match(homeHook, /fetchPublicExploreServices/);
assert.match(homeHook, /fetchPublicJobListings/);
assert.match(homeHook, /fetchPublicFeed/);
assert.match(home, /UserProfile/);
assert.match(home, /ServiceDetail/);
assert.match(home, /JobListingDetail/);
assert.match(home, /PostDetail/);
assert.equal(homeHook.includes('/feed'), false);
assert.equal(homeHook.includes("'/posts"), false);

const explore = read('src/screens/guest/GuestExploreScreen.tsx');
const exploreHook = read('src/hooks/useGuestExplore.ts');
assert.match(explore, /ExploreTaxonomyChipRow/);
assert.match(explore, /useGuestExplore/);
assert.match(exploreHook, /fetchPublicExploreTalents/);
assert.match(exploreHook, /fetchPublicExploreServices/);
assert.match(exploreHook, /fetchPublicJobListings/);
assert.match(exploreHook, /fetchPublicTaxonomy/);
assert.match(exploreHook, /GUEST_EXPLORE_DEBOUNCE_MS = 300/);
assert.match(exploreHook, /resolveGuestExploreQuery/);
assert.match(read('src/lib/guestExploreQuery.ts'), /SEARCH_Q_MIN_LENGTH = 2/);
assert.match(read('src/lib/guestExploreQuery.ts'), /blocked: true/);
assert.match(exploreHook, /categoryIds: search.categoryIds/);
assert.equal(exploreHook.includes('selectedCategoryName'), false);
assert.equal(explore.includes('useSaved'), false);
assert.equal(explore.includes('Saved'), false);

const profile = read('src/screens/guest/GuestUserProfileScreen.tsx');
const profileHook = read('src/hooks/useGuestProfile.ts');
assert.match(profile, /useGuestProfile/);
assert.match(profileHook, /fetchPublicUser/);
assert.match(profileHook, /fetchPublicUserPosts/);
assert.match(profileHook, /fetchPublicUserServices/);
assert.match(profileHook, /fetchPublicUserPortfolio/);
assert.equal(profileHook.includes('fetchPublicUserReviews'), false);
assert.match(profile, /requireAuth/);
assert.match(profile, /ProfileVisitorActions/);
assert.match(profile, /ProfileHeaderChrome/);
assert.match(profile, /ProfileCollapsingHeader/);
assert.match(profile, /AboutTab/);
assert.match(profile, /accessibilityLabel="Connect"|onConnect/);
assert.equal(profile.includes('variant="ghost"'), false);
assert.equal(profile.includes('requestConnect'), false);
assert.equal(profile.includes("navigate('SignIn')"), false);

const post = read('src/screens/guest/GuestPostDetailScreen.tsx');
assert.match(post, /useGuestPost/);
assert.match(post, /requireAuth/);
assert.match(post, /Comments thread is not loaded/);
assert.equal(post.includes('focusComments'), false);
assert.equal(post.includes('PostLikesModal'), false);
assert.equal(post.includes("navigate('SignIn')"), false);

const service = read('src/screens/guest/GuestServiceDetailScreen.tsx');
assert.match(service, /useGuestService/);
assert.match(service, /requireAuth/);
assert.match(service, /Request Service/);
assert.equal(service.includes("navigate('SignIn')"), false);
assert.equal(service.includes('RequestService'), false);

const job = read('src/screens/guest/GuestJobListingDetailScreen.tsx');
assert.match(job, /useGuestJob/);
assert.match(job, /requireAuth/);
assert.match(job, /title="Apply"/);
assert.equal(job.includes("navigate('SignIn')"), false);
assert.equal(job.includes('applyToListing'), false);
assert.equal(job.includes('applications'), false);

const reviews = read('src/screens/guest/GuestReviewsScreen.tsx');
assert.match(reviews, /useGuestReviews/);
assert.match(reviews, /ReviewSummaryCard/);
assert.match(reviews, /ReviewRow/);
assert.equal(reviews.includes('count: 1'), false);
const reviewsHook = read('src/hooks/useGuestReviews.ts');
assert.match(reviewsHook, /fetchPublicUserReviews/);
assert.match(reviewsHook, /fetchPublicServiceReviews/);
assert.match(reviewsHook, /role/);
assert.match(read('src/components/guest/GuestDiscoveryCards.tsx'), /guestServiceCardPrice/);
assert.equal(
  read('src/components/guest/GuestDiscoveryCards.tsx').includes(
    'summary={{ average: review.rating, count: 1 }}',
  ),
  false,
);

const portfolio = read('src/screens/guest/GuestPortfolioProjectDetailScreen.tsx');
assert.match(portfolio, /already-fetched public project payload/);
assert.equal(portfolio.includes('useMyProfile'), false);
assert.equal(portfolio.includes('useVisitorProfessionalProfile'), false);

const homeScreen = read('src/screens/home/HomeScreen.tsx');
assert.match(homeScreen, /usePosts/);
assert.match(homeScreen, /useSaved/);
assert.equal(homeScreen.includes('fetchPublicFeed'), false);
assert.equal(homeScreen.includes('/public/feed'), false);

const searchScreen = read('src/screens/search/SearchScreen.tsx');
assert.match(searchScreen, /exploreApi/);
assert.match(searchScreen, /loadTaxonomy/);
assert.equal(searchScreen.includes('fetchPublicExploreTalents'), false);

const create = read('src/components/layout/GuestCreateMenu.tsx');
assert.match(create, /Sign in to create/);
assert.equal(create.includes("navigate('PostCreate')"), false);

const currencyIcon = read('src/components/ui/CurrencyIcon.tsx');
assert.match(currencyIcon, /useOptionalMyProfile/);
assert.equal(currencyIcon.includes('useMyProfile()'), false);
assert.match(read('src/components/guest/GuestDiscoveryCards.tsx'), /guestServiceCardPrice/);
assert.match(read('src/components/explore/ExploreServiceCard.tsx'), /MoneyAmount/);
assert.match(read('src/context/ProfileContext.tsx'), /useOptionalMyProfile/);

console.log('guest-public-screens-selftest ok');
