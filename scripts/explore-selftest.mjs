import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const screen = read('src/screens/search/SearchScreen.tsx');
const talentCard = read('src/components/explore/ExploreTalentCard.tsx');
const serviceCard = read('src/components/explore/ExploreServiceCard.tsx');
const mosaic = read('src/components/explore/ServiceMediaMosaic.tsx');
const sheet = read('src/components/explore/ExploreFilterSheet.tsx');
const api = read('src/services/exploreApi.ts');
const jobs = read('src/services/marketplaceApi.ts');
const mockExplore = read('src/data/mock/explore.ts');
const mockTalents = read('src/data/mock/talents.ts');

assert.equal(screen.includes('recentSearches'), false);
assert.equal(screen.includes('hourlyRate'), false);
assert.equal(screen.includes('mutualConnections'), false);
assert.equal(screen.includes('Available'), false);
assert.equal(screen.includes('FlatList'), true);
assert.equal(screen.includes('ScrollView'), false);
assert.equal(screen.includes('SEARCH_DEBOUNCE_MS = 300'), true);
assert.equal(screen.includes('requestGen'), true);
assert.equal(screen.includes('PAGE_SIZE = 20'), true);
assert.equal(screen.includes('status=open') || jobs.includes("qs.set('status', 'open')"), true);
assert.equal(screen.includes('listOpenListings'), true);
assert.equal(screen.includes('rememberService'), true);
assert.equal(screen.includes('serviceDetailRoute'), true);
assert.equal(screen.includes('maxLength={120}'), true);
assert.equal(screen.includes('resetHold'), true);
assert.equal(screen.includes('employmentType'), true);
assert.equal(serviceCard.includes('No reviews yet'), true);
assert.equal(screen.includes('Provider ·'), false);
assert.equal(talentCard.includes('Studio'), true);
assert.equal(screen.includes("'incoming'"), true);
assert.equal(screen.includes('request-sent'), true);
assert.equal(screen.includes('No talents found'), true);
assert.equal(screen.includes('No services found'), true);
assert.equal(screen.includes('No jobs found'), true);
assert.equal(screen.includes('Could not load'), true);
assert.equal(screen.includes('ActivityIndicator'), true);
assert.equal(screen.includes('price-low'), false);
assert.equal(screen.includes('price-high'), false);
assert.equal(screen.includes('matchScore'), false);
assert.equal(mockExplore.includes('Saudi Made'), false);
assert.equal(mockExplore.includes('Photographers'), false);
assert.equal(mockTalents.includes('recentSearches'), false);
assert.equal(sheet.includes("'remote'"), false);
assert.equal(sheet.includes('Price:'), false);
assert.equal(sheet.includes('Top rated'), true);
assert.equal(sheet.includes('Newest'), true);
assert.equal(sheet.includes('LocationSelectors'), true);
assert.equal(api.includes('/explore/talents'), true);
assert.equal(api.includes('/explore/businesses'), false);
assert.equal(api.includes('locationCode'), true);
assert.equal(jobs.includes('employmentType'), true);
assert.equal(serviceCard.includes('ServiceMediaMosaic'), true);
assert.equal(screen.includes('ExploreServiceCard'), true);
assert.equal(screen.includes('images[0]'), false);
assert.equal(mosaic.includes('flex: 2'), true);
assert.equal(mosaic.includes('const extra = count - 3'), true);
assert.equal(mosaic.includes('contentFit="cover"'), true);
assert.equal(mosaic.includes('pointerEvents="none"'), true);
assert.equal(screen.includes('listPaddingAboveTabBar'), true);
assert.equal(screen.includes('paddingBottom: listBottomInset'), true);
assert.equal(read('src/components/layout/CustomTabBar.tsx').includes('export function listPaddingAboveTabBar'), true);

const connectStart = screen.indexOf('const handleConnect');
const connectEnd = screen.indexOf('const retry', connectStart);
const handleConnect = screen.slice(connectStart, connectEnd);
assert.equal(handleConnect.includes('requestConnect(userId)'), true);
assert.equal(handleConnect.includes('cancelOutgoing(userId)'), true);
assert.equal(handleConnect.includes('acceptRequest(userId)'), true);
assert.equal(handleConnect.includes('setDisconnectTarget'), true);
assert.equal(handleConnect.includes('disconnect('), false);
assert.equal(screen.includes('title="Disconnect connection?"'), true);
assert.equal(screen.includes('Are you sure you want to disconnect from'), true);
assert.equal(screen.includes('confirmLabel="Disconnect"'), true);
assert.equal(screen.includes('onCancel={() => setDisconnectTarget(null)}'), true);
assert.equal(screen.includes('disconnect(userId)'), true);
assert.equal(screen.includes('ConfirmActionModal'), true);

function exploreConnectTap(relation) {
  if (relation === 'none') return 'send';
  if (relation === 'outgoing') return 'cancel';
  if (relation === 'incoming') return 'accept';
  return 'confirm-disconnect';
}

assert.equal(exploreConnectTap('none'), 'send');
assert.equal(exploreConnectTap('outgoing'), 'cancel');
assert.equal(exploreConnectTap('incoming'), 'accept');
assert.equal(exploreConnectTap('connected'), 'confirm-disconnect');

function confirmDisconnect(choice, calls) {
  if (choice === 'cancel') return { relation: 'connected', calls };
  calls.push('disconnect');
  return { relation: 'none', calls };
}

assert.deepEqual(confirmDisconnect('cancel', []), { relation: 'connected', calls: [] });
const confirmed = confirmDisconnect('disconnect', []);
assert.deepEqual(confirmed.calls, ['disconnect']);
assert.equal(confirmed.relation, 'none');

const ownProfile = read('src/screens/profile/ProfileScreen.tsx');
const visitorProfile = read('src/screens/profile/UserProfileScreen.tsx');
for (const profile of [ownProfile, visitorProfile]) {
  assert.equal(profile.includes('ServiceMediaMosaic'), true);
  assert.equal(profile.includes('height={180}'), true);
  assert.equal(profile.includes('service.images[0]'), false);
  assert.equal(profile.includes('styles.dots'), false);
  assert.equal(profile.includes('dotActive'), false);
}

console.log('explore-selftest ok');
