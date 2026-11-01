/**
 * Phase G: Guest participation actions use requireAuth. No mutation replay.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const MUTATIONS = [
  'toggleLike',
  'likePost',
  'savePost',
  'createComment',
  'requestConnect',
  'openOrCreateConversation',
  'applyToListing',
  'marketplaceApi.',
  'jobService.create',
  'postService.',
  'setDesired',
];

const guestFiles = {
  home: read('src/screens/guest/GuestHomeScreen.tsx'),
  explore: read('src/screens/guest/GuestExploreScreen.tsx'),
  profile: read('src/screens/guest/GuestUserProfileScreen.tsx'),
  post: read('src/screens/guest/GuestPostDetailScreen.tsx'),
  service: read('src/screens/guest/GuestServiceDetailScreen.tsx'),
  job: read('src/screens/guest/GuestJobListingDetailScreen.tsx'),
  reviews: read('src/screens/guest/GuestReviewsScreen.tsx'),
  portfolio: read('src/screens/guest/GuestPortfolioProjectDetailScreen.tsx'),
  create: read('src/components/layout/GuestCreateMenu.tsx'),
  account: read('src/screens/guest/GuestAccountScreen.tsx'),
};

for (const [name, source] of Object.entries(guestFiles)) {
  for (const marker of MUTATIONS) {
    assert.equal(
      source.includes(marker),
      false,
      `${name} must not include ${marker}`,
    );
  }
  assert.equal(source.includes('user == null'), false, `${name} Guest inference`);
}

assert.match(guestFiles.home, /action: 'save'/);
assert.match(guestFiles.home, /action: 'like'/);
assert.match(guestFiles.home, /action: 'comment'/);
assert.match(guestFiles.home, /requireAuth/);

assert.match(guestFiles.explore, /action: 'save'/);
assert.match(guestFiles.explore, /requireAuth/);

assert.match(guestFiles.profile, /gate\('connect'\)/);
assert.match(guestFiles.profile, /gate\('message'\)/);
assert.match(guestFiles.profile, /gate\('request'\)/);
assert.match(guestFiles.profile, /action: 'connect' \| 'message' \| 'request'/);
assert.match(guestFiles.profile, /action: 'like'/);
assert.match(guestFiles.profile, /action: 'save'/);
assert.equal(guestFiles.profile.includes("navigate('Chat')"), false);
assert.equal(guestFiles.profile.includes("navigate('SignIn')"), false);

assert.match(guestFiles.post, /gatePost\('like'\)/);
assert.match(guestFiles.post, /gatePost\('comment'\)/);
assert.match(guestFiles.post, /gatePost\('save'\)/);
assert.match(guestFiles.post, /action: 'like' \| 'comment' \| 'save'/);
assert.match(guestFiles.post, /requireAuth/);
assert.equal(guestFiles.post.includes('PostLikesModal'), false);
assert.equal(guestFiles.post.includes('focusComments'), false);

assert.match(guestFiles.service, /action: 'request'/);
assert.match(guestFiles.service, /action: 'save'/);
assert.equal(guestFiles.service.includes("navigate('SignIn')"), false);
assert.equal(guestFiles.service.includes("navigate('RequestService')"), false);

assert.match(guestFiles.job, /action: 'apply'/);
assert.match(guestFiles.job, /action: 'save'/);
assert.equal(guestFiles.job.includes("navigate('SignIn')"), false);
assert.equal(guestFiles.job.includes('applyToListing'), false);

assert.equal(guestFiles.reviews.includes('WriteReview'), false);
assert.equal(guestFiles.reviews.includes('requireAuth'), false);

assert.match(guestFiles.create, /action: 'create'/);
assert.match(guestFiles.create, /requireAuth/);
assert.match(guestFiles.create, /Sign in to create/);
assert.equal(guestFiles.create.includes("navigate('PostCreate')"), false);
assert.equal(guestFiles.create.includes("navigate('PostJob')"), false);
assert.equal(guestFiles.create.includes("navigate('PhotoCapture')"), false);

assert.match(guestFiles.account, /navigate\('SignIn'\)/);
assert.match(guestFiles.account, /navigate\('Welcome'/);
assert.equal(guestFiles.account.includes("navigate('Saved')"), false);
assert.equal(guestFiles.account.includes("navigate('Settings')"), false);
assert.equal(guestFiles.account.includes("navigate('Notifications')"), false);

const returnIntent = read('src/lib/returnIntent.ts');
assert.match(returnIntent, /'Chat'/);
assert.match(returnIntent, /'Saved'/);
assert.match(returnIntent, /'Settings'/);
assert.equal(returnIntent.includes("route: 'Saved'"), false);
assert.match(returnIntent, /REJECTED_ROUTES/);

const consume = returnIntent.slice(
  returnIntent.indexOf('export function consumeReturnIntentRoutes'),
  returnIntent.indexOf('export function resetReturnIntentForTests'),
);
assert.equal(consume.includes('applyToListing'), false);
assert.equal(consume.includes('toggleLike'), false);
assert.equal(consume.includes('openOrCreateConversation'), false);
assert.equal(consume.includes('RequestService'), false);
assert.equal(consume.includes('PostCreate'), false);
assert.equal(consume.includes('WriteReview'), false);

const cards = read('src/components/guest/GuestDiscoveryCards.tsx');
assert.match(cards, /saved=\{false\}/);
assert.equal(cards.includes('useSaved'), false);
assert.equal(cards.includes('isSaved'), false);
assert.equal(cards.includes('isLiked'), false);

const authenticatedJob = read('src/screens/jobs/JobListingDetailScreen.tsx');
assert.match(authenticatedJob, /applyToListing/);
assert.equal(authenticatedJob.includes('useAuthGate'), false);

const authenticatedService = read('src/screens/profile/ServiceDetailScreen.tsx');
assert.equal(authenticatedService.includes('useAuthGate'), false);

console.log('guest-action-gate-selftest ok');
