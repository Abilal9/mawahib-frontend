/**
 * Phase G: typed return intent allowlist, params, TTL, epoch, one-shot consume.
 * Run: node --no-warnings --experimental-strip-types scripts/return-intent-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => (mem.has(key) ? mem.get(key) : null),
  setItem: (key, value) => {
    mem.set(key, String(value));
  },
  removeItem: (key) => {
    mem.delete(key);
  },
};

const {
  ALLOWED_RETURN_ROUTES,
  RETURN_INTENT_TTL_MS,
  RETURN_INTENT_STORAGE_KEY,
  sanitizeReturnIntentInput,
  stageReturnIntent,
  persistStagedReturnIntent,
  peekReturnIntent,
  takeReturnIntent,
  consumeReturnIntentRoutes,
  invalidateReturnIntents,
  isReturnIntentFresh,
  parseStoredIntent,
  mapReturnIntentToAuthenticated,
  resetReturnIntentForTests,
  getReturnIntentGeneration,
  getReturnIntentProcessId,
} = await import('../src/lib/returnIntent.ts');
const { saveRecoveryState, clearRecoveryState } = await import(
  '../src/lib/recoveryState.ts'
);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const USER = 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111';
const POST = 'aaaaaaaa-bbbb-4ccc-8ddd-222222222222';
const SERVICE = 'aaaaaaaa-bbbb-4ccc-8ddd-333333333333';
const JOB = 'aaaaaaaa-bbbb-4ccc-8ddd-444444444444';
const PROJECT = 'aaaaaaaa-bbbb-4ccc-8ddd-555555555555';

function reset() {
  mem.clear();
  resetReturnIntentForTests();
  clearRecoveryState();
}

assert.equal(RETURN_INTENT_TTL_MS, 10 * 60 * 1000);
assert.deepEqual([...ALLOWED_RETURN_ROUTES], [
  'GuestTabs',
  'UserProfile',
  'PostDetail',
  'ServiceDetail',
  'JobListingDetail',
  'Reviews',
  'PortfolioProjectDetail',
]);

reset();
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'UserProfile',
    params: { userId: USER },
    action: 'message',
  }),
  { route: 'UserProfile', params: { userId: USER }, action: 'message' },
);
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'PostDetail',
    params: { postId: POST },
    action: 'like',
  }),
  { route: 'PostDetail', params: { postId: POST }, action: 'like' },
);
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'ServiceDetail',
    params: { serviceId: SERVICE },
    action: 'request',
  }),
  { route: 'ServiceDetail', params: { serviceId: SERVICE }, action: 'request' },
);
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'JobListingDetail',
    params: { listingId: JOB },
    action: 'apply',
  }),
  { route: 'JobListingDetail', params: { listingId: JOB }, action: 'apply' },
);
assert.ok(
  sanitizeReturnIntentInput({
    route: 'Reviews',
    params: { userId: USER },
  }),
);
assert.ok(
  sanitizeReturnIntentInput({
    route: 'PortfolioProjectDetail',
    params: { projectId: PROJECT, userId: USER },
  }),
);
assert.ok(
  sanitizeReturnIntentInput({
    route: 'GuestTabs',
    params: { screen: 'HomeTab' },
    action: 'create',
  }),
);
assert.ok(
  sanitizeReturnIntentInput({
    route: 'GuestTabs',
    params: { screen: 'SearchTab' },
  }),
);
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'GuestTabs',
    params: { screen: 'MessagesTab' },
    action: 'messages',
  }),
  {
    route: 'GuestTabs',
    params: { screen: 'MessagesTab' },
    action: 'messages',
  },
);
assert.deepEqual(
  sanitizeReturnIntentInput({
    route: 'GuestTabs',
    params: { screen: 'JobsTab' },
    action: 'jobs',
  }),
  {
    route: 'GuestTabs',
    params: { screen: 'JobsTab' },
    action: 'jobs',
  },
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'GuestTabs',
    params: { screen: 'MessagesTab', conversationId: USER },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'MessagesTab',
    params: {},
    action: 'messages',
  }),
  null,
);

for (const route of [
  'Chat',
  'Saved',
  'Settings',
  'Notifications',
  'ConfirmPayment',
  'WorkRequestDetail',
  'Messages',
  'PostCreate',
  'RequestService',
  'WriteReview',
  'MainTabs',
  'not-a-route',
]) {
  assert.equal(
    sanitizeReturnIntentInput({ route, params: { userId: USER } }),
    null,
    `must reject ${route}`,
  );
}

assert.equal(
  sanitizeReturnIntentInput({
    route: 'UserProfile',
    params: { userId: 'not-a-uuid' },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'PostDetail',
    params: { postId: '11111111-1111-1111-1111-111111111111' },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'UserProfile',
    params: { userId: USER, extra: 'nope' },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'PostDetail',
    params: { postId: POST, focusComments: true },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'UserProfile',
    params: { userId: () => 'x' },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'UserProfile',
    params: { userId: { nested: USER } },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'PortfolioProjectDetail',
    params: {
      projectId: PROJECT,
      title: 'Guest DTO',
      images: ['https://example.com/a.jpg'],
    },
  }),
  null,
);
assert.equal(
  sanitizeReturnIntentInput({
    route: 'JobListingDetail',
    params: { jobId: JOB },
  }),
  null,
);

const now = 1_700_000_000_000;
reset();
const liveProcessId = getReturnIntentProcessId();
assert.equal(
  isReturnIntentFresh(
    { createdAt: now, epoch: 0, processId: liveProcessId, consumed: false },
    now,
    0,
  ),
  true,
);
assert.equal(
  isReturnIntentFresh(
    {
      createdAt: now - (RETURN_INTENT_TTL_MS - 1),
      epoch: 0,
      processId: liveProcessId,
      consumed: false,
    },
    now,
    0,
  ),
  true,
);
assert.equal(
  isReturnIntentFresh(
    {
      createdAt: now - RETURN_INTENT_TTL_MS,
      epoch: 0,
      processId: liveProcessId,
      consumed: false,
    },
    now,
    0,
  ),
  false,
);
assert.equal(
  isReturnIntentFresh(
    { createdAt: now, epoch: 0, processId: liveProcessId, consumed: true },
    now,
    0,
  ),
  false,
);
assert.equal(
  isReturnIntentFresh(
    { createdAt: now, epoch: 0, processId: liveProcessId, consumed: false },
    now,
    1,
  ),
  false,
);
assert.equal(
  isReturnIntentFresh(
    { createdAt: now + 1, epoch: 0, processId: liveProcessId, consumed: false },
    now,
    0,
  ),
  false,
);
assert.equal(
  isReturnIntentFresh(
    { createdAt: now, epoch: 0, processId: 'other-process', consumed: false },
    now,
    0,
  ),
  false,
);

reset();
stageReturnIntent({
  route: 'UserProfile',
  params: { userId: USER },
  action: 'message',
  now: Date.now(),
});
assert.equal(peekReturnIntent()?.route, 'UserProfile');
assert.equal(takeReturnIntent(Date.now()), null);
assert.equal(peekReturnIntent(), null);

reset();
const liveNow = Date.now();
const staged = stageReturnIntent({
  route: 'UserProfile',
  params: { userId: USER },
  action: 'message',
  now: liveNow,
});
assert.equal(staged?.epoch, 0);
assert.equal(persistStagedReturnIntent(staged), true);
assert.equal(peekReturnIntent()?.route, 'UserProfile');
const first = takeReturnIntent(liveNow);
assert.deepEqual(first, {
  name: 'UserProfile',
  params: { userId: USER },
});
assert.equal(peekReturnIntent(), null);
assert.equal(mem.has(RETURN_INTENT_STORAGE_KEY), false);
assert.equal(takeReturnIntent(liveNow), null);
assert.equal(consumeReturnIntentRoutes(liveNow), null);

reset();
stageReturnIntent({
  route: 'JobListingDetail',
  params: { listingId: JOB },
  action: 'apply',
  now: Date.now(),
});
persistStagedReturnIntent();
assert.deepEqual(consumeReturnIntentRoutes(Date.now()), [
  { name: 'MainTabs' },
  { name: 'JobListingDetail', params: { listingId: JOB } },
]);
assert.equal(consumeReturnIntentRoutes(Date.now()), null);

reset();
stageReturnIntent({
  route: 'GuestTabs',
  params: { screen: 'SearchTab' },
  now: Date.now(),
});
assert.deepEqual(mapReturnIntentToAuthenticated(peekReturnIntent()), {
  name: 'MainTabs',
  params: { screen: 'SearchTab' },
});

reset();
stageReturnIntent({
  route: 'GuestTabs',
  params: { screen: 'MessagesTab' },
  action: 'messages',
  now: Date.now(),
});
persistStagedReturnIntent();
assert.deepEqual(consumeReturnIntentRoutes(Date.now()), [
  { name: 'MainTabs', params: { screen: 'MessagesTab' } },
]);

reset();
stageReturnIntent({
  route: 'GuestTabs',
  params: { screen: 'JobsTab' },
  action: 'jobs',
  now: Date.now(),
});
persistStagedReturnIntent();
assert.deepEqual(consumeReturnIntentRoutes(Date.now()), [
  { name: 'MainTabs', params: { screen: 'JobsTab' } },
]);

reset();
stageReturnIntent({
  route: 'Reviews',
  params: { serviceId: SERVICE },
  now: Date.now(),
});
assert.deepEqual(mapReturnIntentToAuthenticated(peekReturnIntent()), {
  name: 'ServiceDetail',
  params: { serviceId: SERVICE },
});

reset();
const likeAt = Date.now();
stageReturnIntent({
  route: 'PostDetail',
  params: { postId: POST },
  action: 'like',
  now: likeAt,
});
persistStagedReturnIntent();
assert.equal(takeReturnIntent(likeAt + RETURN_INTENT_TTL_MS), null);

reset();
stageReturnIntent({
  route: 'ServiceDetail',
  params: { serviceId: SERVICE },
  now: Date.now(),
});
persistStagedReturnIntent();
invalidateReturnIntents();
assert.ok(getReturnIntentGeneration() > 0);
assert.equal(takeReturnIntent(Date.now()), null);

reset();
stageReturnIntent({
  route: 'UserProfile',
  params: { userId: USER },
  now: Date.now(),
});
persistStagedReturnIntent();
assert.equal(
  saveRecoveryState({ email: 'a@example.com', phase: 'verifying' }),
  true,
);
assert.equal(takeReturnIntent(Date.now()), null);

reset();
mem.set(
  RETURN_INTENT_STORAGE_KEY,
  JSON.stringify({
    route: 'UserProfile',
    params: { userId: USER },
    epoch: 0,
    createdAt: Date.now() + 60_000,
    consumed: false,
  }),
);
assert.equal(takeReturnIntent(Date.now()), null);

reset();
mem.set(RETURN_INTENT_STORAGE_KEY, '{not-json');
assert.equal(peekReturnIntent(), null);
assert.equal(mem.has(RETURN_INTENT_STORAGE_KEY), false);

reset();
mem.set(
  RETURN_INTENT_STORAGE_KEY,
  JSON.stringify({
    route: 'Chat',
    params: { conversationId: USER },
    epoch: 0,
    createdAt: now,
    consumed: false,
  }),
);
assert.equal(parseStoredIntent(JSON.parse(mem.get(RETURN_INTENT_STORAGE_KEY))), null);
assert.equal(peekReturnIntent(), null);

reset();
assert.doesNotThrow(() =>
  parseStoredIntent({
    route: 'UserProfile',
    params: { userId: USER, onSuccess: () => {} },
    epoch: 0,
    createdAt: now,
    consumed: false,
  }),
);
assert.equal(
  parseStoredIntent({
    route: 'UserProfile',
    params: { userId: USER, onSuccess: 'fn' },
    epoch: 0,
    createdAt: now,
    consumed: false,
  }),
  null,
);

reset();
stageReturnIntent({
  route: 'UserProfile',
  params: { userId: USER },
  now: Date.now(),
});
assert.equal(persistStagedReturnIntent(), true);
const leftover = mem.get(RETURN_INTENT_STORAGE_KEY);
resetReturnIntentForTests();
mem.set(RETURN_INTENT_STORAGE_KEY, leftover);
assert.equal(
  takeReturnIntent(Date.now()),
  null,
  'prior-process leftovers must not restore after restart',
);

reset();
stageReturnIntent({
  route: 'UserProfile',
  params: { userId: USER },
  now: Date.now(),
});
assert.equal(persistStagedReturnIntent(), true);
const originalRemove = globalThis.localStorage.removeItem;
const originalSet = globalThis.localStorage.setItem;
globalThis.localStorage.removeItem = () => {
  throw new Error('quota');
};
globalThis.localStorage.setItem = () => {
  throw new Error('quota');
};
assert.equal(takeReturnIntent(Date.now()), null);
globalThis.localStorage.removeItem = originalRemove;
globalThis.localStorage.setItem = originalSet;
resetReturnIntentForTests();
assert.equal(
  takeReturnIntent(Date.now()),
  null,
  'failed consumption plus restart must not restore',
);
reset();

const returnIntent = read('src/lib/returnIntent.ts');
assert.equal(returnIntent.includes('applyToListing'), false);
assert.equal(returnIntent.includes('toggleLike'), false);
assert.equal(returnIntent.includes('openOrCreateConversation'), false);
assert.equal(returnIntent.includes('likePost'), false);
assert.equal(returnIntent.includes('createComment'), false);
assert.match(returnIntent, /One-shot consume/);

const productTree = read('src/lib/productTree.ts');
const enterAuthFn = productTree.slice(
  productTree.indexOf('export function enterAuthenticatedProduct'),
  productTree.indexOf('export function leaveAuthenticatedProduct'),
);
assert.match(enterAuthFn, /consumeReturnIntentRoutes\(\)/);
assert.equal(enterAuthFn.includes('applyToListing'), false);
const leaveFn = productTree.slice(
  productTree.indexOf('export function leaveAuthenticatedProduct'),
  productTree.indexOf('export function enterSignedOutAt'),
);
assert.match(leaveFn, /invalidateReturnIntents\(\)/);

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /invalidateReturnIntents\(\)/);
const clearState = auth.slice(
  auth.indexOf('const clearAuthenticatedState'),
  auth.indexOf('const discardInterruptedRecovery'),
);
assert.match(clearState, /invalidateReturnIntents\(\)/);
const armRecovery = auth.slice(
  auth.indexOf('const armRecoveryVerification'),
  auth.indexOf('const commitRecoverySession'),
);
assert.match(armRecovery, /invalidateReturnIntents\(\)/);
const suspend = auth.slice(
  auth.indexOf('const markAccountSuspended'),
  auth.indexOf('const sameLiveSubject'),
);
assert.match(suspend, /invalidateReturnIntents\(\)/);
const hydrateStart = auth.indexOf('const hydrateBackendUser = useCallback');
assert.ok(hydrateStart !== -1);
const hydrate = auth.slice(
  hydrateStart,
  auth.indexOf('useEffect(() => {', hydrateStart + 1),
);
assert.ok(hydrate.includes('previousUserId !== active.user.id'));
assert.ok(
  hydrate.indexOf('previousUserId !== active.user.id') <
    hydrate.indexOf('invalidateReturnIntents()'),
);

const forgot = read('src/screens/auth/ForgotPasswordScreen.tsx');
assert.match(forgot, /invalidateReturnIntents\(\)/);

const header = read('src/components/layout/GuestAccountEntry.tsx');
assert.match(header, /invalidateReturnIntents\(\)/);
assert.equal(header.includes('clearStagedReturnIntent'), false);

console.log('return-intent-selftest ok');
