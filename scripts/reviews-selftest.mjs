/**
 * Reviews + ratings source contract.
 * Double-blind copy, account-switch clearing, and no client-side review CRUD.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const composer = read('src/screens/jobs/WriteReviewScreen.tsx');
const prompt = read('src/components/job/EngagementReviewPrompt.tsx');
const jobs = read('src/context/UserJobsContext.tsx');
const reviews = read('src/screens/profile/ReviewsScreen.tsx');
const api = read('src/services/marketplaceApi.ts');
const explore = read('src/services/exploreApi.ts');
const services = read('src/services/servicesApi.ts');
const header = read('src/components/profile/ProfileCollapsingHeader.tsx');
const ownProfile = read('src/screens/profile/ProfileScreen.tsx');
const search = read('src/screens/search/SearchScreen.tsx');
const exploreTalentCard = read('src/components/explore/ExploreTalentCard.tsx');
const exploreServiceCard = read('src/components/explore/ExploreServiceCard.tsx');
const reviewSummary = read('src/components/reviews/ReviewSummaryCard.tsx');
const home = read('src/screens/home/HomeScreen.tsx');
const sidebar = read('src/components/layout/AppSidebar.tsx');
const auth = read('src/services/authApi.ts');
const summary = read('src/utils/reviewSummary.ts');
const pkg = read('package.json');
const client = read('src/lib/apiClient.ts');

assert.match(composer, /Submit review\?/);
assert.match(composer, /won't be able to edit this review after submitting/);
assert.match(
  composer,
  /Your review will stay private until the other person submits theirs/,
);
assert.match(composer, /maxLength=\{2000\}/);
assert.match(composer, /rating < 1/);
assert.match(composer, /boundAuthor/);
assert.match(composer, /apiUser\?\.id/);
assert.match(composer, /authorRef\.current !== owner/);
assert.match(composer, /reviewState\.canSubmit/);
assert.match(prompt, /Leave a review/);
assert.match(prompt, /Review period ended/);
assert.match(prompt, /Submitted/);
assert.equal(prompt.includes('otherPartyReview'), false);
assert.equal(api.includes('otherPartyReview'), false);
assert.equal(jobs.includes('otherPartyReview'), false);
assert.match(api, /canSubmit/);
assert.match(api, /role/);
assert.match(api, /nextCursor/);
assert.equal(api.includes('supabase'), false);
assert.equal(client.includes("from('engagement_reviews')"), false);
assert.equal(services.includes("from('engagement_reviews')"), false);

assert.match(jobs, /boundUser/);
assert.match(jobs, /fetchGen/);
assert.match(jobs, /userIdRef\.current !== forUser/);
assert.match(reviews, /boundTarget/);
assert.match(reviews, /boundRole/);
assert.match(reviews, /loadGen/);
assert.match(reviews, /No reviews yet/);
assert.match(reviews, /As Talent/);
assert.match(reviews, /As Client/);
assert.match(reviews, /useState<RoleFilter>\('all'\)/);
assert.match(reviews, /forRole === 'all'/);
assert.match(reviews, /refreshMe\(token\)/);
assert.match(reviews, /accessTokenSubject\(token\) !== targetId/);
assert.match(reviews, /listSupersedes/);
assert.match(ownProfile, /refreshMe\(token\)/);
assert.match(ownProfile, /accessTokenSubject\(token\) === user\.id/);
assert.equal(reviews.includes('headlineRole'), false);
assert.equal(reviews.includes('accountType'), false);
assert.match(header, /No reviews yet/);
assert.match(header, /reviewCountLabel/);
assert.match(header, /overallAggregate/);
assert.equal(header.includes('secondaryAggregate'), false);
assert.equal(header.includes('As a client'), false);
assert.equal(header.includes('As a provider'), false);
assert.match(summary, /overallAggregate/);
assert.match(auth, /overallAggregate/);
assert.match(explore, /overallAggregate/);
assert.match(explore, /ratingFields\(row\.reviewSummary\)/);
assert.equal(explore.includes('ratingAvg'), false);
assert.equal(explore.includes('headlineAggregate'), false);
assert.match(services, /reviewSummary/);
assert.match(services, /ratingFields\(api\.reviewSummary\)/);
assert.match(services, /\/services\/\$\{serviceId\}\/reviews/);
assert.equal(services.includes('overallAggregate'), false);
assert.match(exploreServiceCard, /No reviews yet/);
assert.match(reviewSummary, /No reviews yet/);
assert.match(exploreTalentCard, /talent\.reviewCount/);
assert.match(search, /talent\.reviewCount/);
assert.match(search, /service\.reviewCount/);
assert.equal(search.includes('Provider ·'), false);
assert.match(home, /talent\.reviewCount/);
assert.match(home, /service\.reviewCount/);
assert.match(sidebar, /hasRealReviews/);
assert.match(sidebar, /user\.rating/);
assert.equal(sidebar.includes('As a client'), false);
assert.equal(sidebar.includes('As Talent'), false);

assert.match(pkg, /reviews-selftest\.mjs/);
assert.match(pkg, /password-recovery-selftest\.mjs/);
assert.match(pkg, /account-suspension-selftest\.mjs/);
assert.match(pkg, /saved-selftest\.mjs/);
