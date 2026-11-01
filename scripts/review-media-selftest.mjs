/**
 * Review media MIME handling and rating presentation helpers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isReviewImageMime,
  isReviewVideoMime,
  reviewHasUnsupportedVideo,
  reviewImageUrls,
} from '../src/lib/reviewMedia.ts';
import { distributionFromStars } from '../src/lib/reviewDistribution.ts';
import { guestAboutToProfileContent } from '../src/lib/guestAbout.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

assert.equal(isReviewImageMime('image/jpeg'), true);
assert.equal(isReviewImageMime('video/mp4'), false);
assert.equal(isReviewVideoMime('video/mp4'), true);
assert.equal(isReviewImageMime(null), true);

const urls = reviewImageUrls(
  [
    { url: 'https://cdn.example/a.jpg', mimeType: 'image/jpeg' },
    { url: 'https://cdn.example/b.mp4', mimeType: 'video/mp4' },
    { url: 'https://cdn.example/c.png', mimeType: 'image/png' },
  ],
  ['https://cdn.example/fallback.jpg'],
  4,
);
assert.deepEqual(urls, [
  'https://cdn.example/a.jpg',
  'https://cdn.example/c.png',
]);
assert.equal(
  reviewHasUnsupportedVideo([
    { url: 'https://cdn.example/b.mp4', mimeType: 'video/mp4' },
  ]),
  true,
);

assert.equal(distributionFromStars(undefined, 4), null);
assert.deepEqual(distributionFromStars([0, 0, 1, 2, 1], 4), [
  { stars: 5, percent: 0.25 },
  { stars: 4, percent: 0.5 },
  { stars: 3, percent: 0.25 },
  { stars: 2, percent: 0 },
  { stars: 1, percent: 0 },
]);

const about = guestAboutToProfileContent({
  bio: 'Hello',
  skills: ['Design'],
  about: {
    languages: [{ id: 'l1', name: 'Arabic', level: 'NATIVE', flag: '🇸🇦' }],
    education: [{ id: 'e1', school: 'KSU' }],
    experience: [{ id: 'x1', title: 'Designer', company: 'Studio' }],
    certifications: [
      {
        id: 'c1',
        name: 'Cert',
        credentialUrl: 'https://secret.example/cert',
        credentialId: 'hidden',
      },
    ],
  },
});
assert.equal(about.languages[0].name, 'Arabic');
assert.equal(about.talents[0], 'Design');
assert.equal(about.certifications[0].name, 'Cert');
assert.equal(about.certifications[0].credentialUrl, undefined);
assert.equal(about.certifications[0].credentialId, undefined);

const row = read('src/components/reviews/ReviewRow.tsx');
assert.match(row, /reviewImageUrls/);
assert.match(row, /isReviewVideoMime|reviewHasUnsupportedVideo/);
assert.equal(row.includes('count: 1'), false);
assert.equal(row.includes('GuestRating'), false);

const guestCards = read('src/components/guest/GuestDiscoveryCards.tsx');
assert.equal(
  guestCards.includes('summary={{ average: review.rating, count: 1 }}'),
  false,
);
assert.match(guestCards, /connectStatus="connect"/);

const chips = read('src/components/explore/ExploreTaxonomyChipRow.tsx');
assert.match(chips, /minHeight: 36/);
assert.match(chips, /flexShrink: 0/);
assert.equal(chips.includes('loadTaxonomy'), false);
assert.equal(chips.includes('useSaved'), false);

console.log('review-media-selftest ok');
