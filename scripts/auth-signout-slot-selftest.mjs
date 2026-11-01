/**
 * Production queue/session transition helpers used by AuthContext.
 * Not a copied AuthContext replica. Barriers control schedules.
 * Run: node --no-warnings --experimental-strip-types scripts/auth-signout-slot-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enqueueAuthMutation,
  resetAuthMutationQueueForTests,
} from '../src/lib/authMutationQueue.ts';
import {
  applyApiUserAllowed,
  beginQueuedSignOutIfCurrent,
  bumpSessionGeneration,
  commitCredentialSession,
  getSessionGeneration,
  joinOrStartSignOut,
  resetSessionGenerationForTests,
  resetSignOutInflightForTests,
  signOutInflightKey,
} from '../src/lib/authSignOutSlot.ts';
import {
  beginSignOutTransaction,
  clearSignOutTransaction,
  failSignOutTransaction,
  getActiveSignOutTransaction,
  resetSignOutTransactionForTests,
} from '../src/lib/signOutTransaction.ts';
import {
  getSignedOutReason,
  resetSignedOutReasonForTests,
  setSignedOutReason,
} from '../src/lib/signedOutReason.ts';
import {
  shouldClearLogoutReasonForIncomingSession,
  shouldForceCredentialReadiness,
  canDismissOptionalAuth,
  resolveSignedOutBranchEntry,
} from '../src/lib/signedOutBranchEntry.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function reset() {
  resetAuthMutationQueueForTests();
  resetSignOutTransactionForTests();
  resetSignedOutReasonForTests();
  resetSessionGenerationForTests();
  resetSignOutInflightForTests();
}

function noteCredential() {
  return commitCredentialSession({
    reason: getSignedOutReason(),
    setReasonNone: () => setSignedOutReason('none'),
  });
}

function beginLogoutSlot(input) {
  return beginQueuedSignOutIfCurrent({
    kind: input.kind ?? 'logout',
    expectedUserId: input.expectedUserId,
    generationAtCall: input.generationAtCall,
    liveUserId: input.liveUserId,
    begin: beginSignOutTransaction,
  });
}

reset();

// A.1 logout running, then B login queued behind it.
{
  const hold = deferred();
  let live = USER_A;
  const order = [];
  const logout = enqueueAuthMutation(async () => {
    const begun = beginLogoutSlot({
      kind: 'logout',
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      liveUserId: live,
    });
    assert.equal(begun.status, 'started');
    order.push('logout-begun');
    await hold.promise;
    live = null;
    setSignedOutReason('logout', USER_A);
    bumpSessionGeneration();
    clearSignOutTransaction();
    order.push('logout-done');
  });
  const login = enqueueAuthMutation(async () => {
    live = USER_B;
    noteCredential();
    order.push('login-b');
  });
  hold.resolve();
  await Promise.all([logout, login]);
  assert.deepEqual(order, ['logout-begun', 'logout-done', 'login-b']);
  assert.equal(getSignedOutReason(), 'none');
  assert.equal(live, USER_B);
}

// A.2 B login queued/running, then A logout requested.
reset();
{
  const order = [];
  const genAtLogout = getSessionGeneration();
  await Promise.all([
    enqueueAuthMutation(async () => {
      noteCredential();
      order.push('login-b');
    }),
    enqueueAuthMutation(async () => {
      const begun = beginLogoutSlot({
        kind: 'logout',
        expectedUserId: USER_A,
        generationAtCall: genAtLogout,
        liveUserId: USER_B,
      });
      order.push(begun.status);
    }),
  ]);
  assert.equal(order[0], 'login-b');
  assert.ok(
    order[1] === 'superseded' || order[1] === 'skipped-other-user',
    `A logout after B login must not begin, got ${order[1]}`,
  );
  assert.equal(getActiveSignOutTransaction(), null);
  assert.equal(getSignedOutReason(), 'none');
}

// A.3 A logout skipped because B is current → B may apply.
reset();
noteCredential();
{
  const begun = beginLogoutSlot({
    kind: 'logout',
    expectedUserId: USER_A,
    generationAtCall: getSessionGeneration(),
    liveUserId: USER_B,
  });
  assert.equal(begun.status, 'skipped-other-user');
  assert.equal(getActiveSignOutTransaction(), null);
  assert.equal(
    applyApiUserAllowed({
      txnStatus: null,
      expectedUserId: USER_A,
      incomingUserId: USER_B,
      guestChosenInFlight: false,
      ignoreCallbackCommit: false,
    }),
    true,
  );
}

// A.4 A logout failure does not poison B login.
reset();
{
  let loginRan = false;
  await enqueueAuthMutation(async () => {
    throw new Error('logout-failed');
  }).catch((err) => {
    assert.equal(err.message, 'logout-failed');
  });
  await enqueueAuthMutation(async () => {
    noteCredential();
    loginRan = true;
  });
  assert.equal(loginRan, true);
  assert.equal(getSignedOutReason(), 'none');
}

// A.5 A logout succeeds, then B login still runs (queued behind).
reset();
setSignedOutReason('logout', USER_A);
{
  await enqueueAuthMutation(async () => {
    const begun = beginLogoutSlot({
      kind: 'logout',
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      liveUserId: USER_A,
    });
    assert.equal(begun.status, 'started');
    setSignedOutReason('logout', USER_A);
    bumpSessionGeneration();
    clearSignOutTransaction();
  });
  await enqueueAuthMutation(async () => {
    noteCredential();
  });
  assert.equal(getSignedOutReason(), 'none');
}

// A.6 Duplicate logout is identity-aware.
reset();
{
  const hold = deferred();
  let starts = 0;
  const first = joinOrStartSignOut(signOutInflightKey('logout', USER_A), async () => {
    starts += 1;
    await hold.promise;
    return 'a';
  });
  const second = joinOrStartSignOut(signOutInflightKey('logout', USER_A), async () => {
    starts += 1;
    return 'dup';
  });
  const other = joinOrStartSignOut(signOutInflightKey('logout', USER_B), async () => {
    starts += 1;
    return 'b';
  });
  hold.resolve();
  assert.equal(await first, 'a');
  assert.equal(await second, 'a');
  assert.equal(await other, 'b');
  assert.equal(starts, 2);
}

// Duplicate failure rejects both callers and releases ownership.
reset();
{
  const hold = deferred();
  const boom = new Error('logout-failed');
  const first = joinOrStartSignOut(signOutInflightKey('logout', USER_A), async () => {
    await hold.promise;
    throw boom;
  });
  const second = joinOrStartSignOut(signOutInflightKey('logout', USER_A), async () => {
    return 'nope';
  });
  hold.resolve();
  await assert.rejects(first, boom);
  await assert.rejects(second, boom);
  const begun = beginSignOutTransaction({ kind: 'logout', expectedUserId: USER_A });
  assert.equal(begun.status, 'started');
  clearSignOutTransaction();
}

// A.7 Suspension logout with no application profile.
reset();
{
  const begun = beginLogoutSlot({
    kind: 'suspensionLogout',
    generationAtCall: getSessionGeneration(),
    liveUserId: null,
  });
  assert.equal(begun.status, 'started');
  clearSignOutTransaction();
}

// A.8 Callback establishes B while stale A cleanup is pending.
reset();
{
  const genAtA = getSessionGeneration();
  noteCredential();
  const begun = beginLogoutSlot({
    kind: 'logout',
    expectedUserId: USER_A,
    generationAtCall: genAtA,
    liveUserId: USER_B,
  });
  assert.equal(begun.status, 'superseded');
  assert.equal(getActiveSignOutTransaction(), null);
}

// A.9 Delayed A hydration after B is current.
reset();
{
  const txn = beginSignOutTransaction({
    kind: 'logout',
    expectedUserId: USER_A,
  });
  assert.equal(txn.status, 'started');
  assert.equal(
    applyApiUserAllowed({
      txnStatus: 'started',
      expectedUserId: USER_A,
      incomingUserId: USER_A,
      guestChosenInFlight: false,
      ignoreCallbackCommit: false,
    }),
    false,
  );
  assert.equal(
    applyApiUserAllowed({
      txnStatus: 'started',
      expectedUserId: USER_A,
      incomingUserId: USER_B,
      guestChosenInFlight: false,
      ignoreCallbackCommit: false,
    }),
    true,
  );
  clearSignOutTransaction();
}

// A.10 Queue rejection then a valid operation.
reset();
await assert.rejects(
  enqueueAuthMutation(async () => {
    throw new Error('rejected');
  }),
);
let recovered = false;
await enqueueAuthMutation(async () => {
  recovered = true;
});
assert.equal(recovered, true);

// A.12 Failed transaction does not stay started.
reset();
{
  const begun = beginSignOutTransaction({ kind: 'logout', expectedUserId: USER_A });
  failSignOutTransaction(begun.txn.id);
  assert.equal(getActiveSignOutTransaction()?.status, 'failed');
  const next = beginSignOutTransaction({ kind: 'logout', expectedUserId: USER_A });
  assert.equal(next.status, 'started');
  clearSignOutTransaction();
}

// B. Same-user credential vs restore/refresh.
reset();
setSignedOutReason('logout', USER_A);
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'logout',
    signedOutUserId: USER_A,
    incomingUserId: USER_A,
    establishment: 'credential',
  }),
  true,
);
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'logout',
    signedOutUserId: USER_A,
    incomingUserId: USER_A,
    establishment: 'restore',
  }),
  false,
);
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'logout',
    signedOutUserId: USER_A,
    incomingUserId: USER_A,
    establishment: 'refresh',
  }),
  false,
);
noteCredential();
assert.equal(getSignedOutReason(), 'none');
assert.equal(
  resolveSignedOutBranchEntry({
    handoff: null,
    recoveryLocked: false,
    hasSession: true,
    renderedUserId: USER_A,
    productActive: false,
    reason: 'none',
    signedOutUserId: null,
  }).name,
  'SignIn',
);

reset();
setSignedOutReason('logout', USER_A);
assert.equal(
  resolveSignedOutBranchEntry({
    handoff: null,
    recoveryLocked: false,
    hasSession: true,
    renderedUserId: USER_A,
    productActive: false,
    reason: 'logout',
    signedOutUserId: USER_A,
  }).name,
  'GuestTabs',
);

assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'none',
    routes: [{ name: 'GuestTabs' }, { name: 'SignIn' }],
    index: 1,
    hasLiveUnappliedSession: true,
  }),
  false,
);
assert.equal(
  shouldForceCredentialReadiness({
    currentRoute: 'GuestTabs',
    hasSession: true,
    isSignedIn: false,
    recoveryLocked: false,
    reason: 'none',
  }),
  true,
);
assert.equal(
  shouldForceCredentialReadiness({
    currentRoute: 'SignIn',
    hasSession: true,
    isSignedIn: false,
    recoveryLocked: false,
    reason: 'none',
  }),
  false,
);
assert.equal(
  shouldForceCredentialReadiness({
    currentRoute: 'GuestTabs',
    hasSession: true,
    isSignedIn: false,
    recoveryLocked: false,
    reason: 'logout',
  }),
  false,
);

// Stale queued logout after same-user re-login is superseded.
reset();
setSignedOutReason('logout', USER_A);
{
  const genAtLogout = getSessionGeneration();
  noteCredential();
  const begun = beginLogoutSlot({
    kind: 'logout',
    expectedUserId: USER_A,
    generationAtCall: genAtLogout,
    liveUserId: USER_A,
  });
  assert.equal(begun.status, 'superseded');
  assert.equal(getSignedOutReason(), 'none');
}

// Applied logout then queued hydrate401 is superseded.
reset();
{
  const genAtHydrate = getSessionGeneration();
  bumpSessionGeneration();
  const begun = beginLogoutSlot({
    kind: 'hydrate401',
    expectedUserId: USER_A,
    generationAtCall: genAtHydrate,
    liveUserId: null,
  });
  assert.equal(begun.status, 'superseded');
}

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /beginQueuedSignOutIfCurrent/);
assert.match(auth, /applyApiUserAllowed/);
assert.match(auth, /commitCredentialSession/);
assert.match(auth, /joinOrStartSignOut/);
assert.match(auth, /generationAtCall/);
assert.match(auth, /establishment: 'restore'/);
assert.match(auth, /AuthFailure\('superseded'/);

const signOutStart = auth.indexOf('const signOut = useCallback');
const discardStart = auth.indexOf('const discardInterruptedRecovery');
assert.ok(signOutStart !== -1 && discardStart > signOutStart);
const signOutBody = auth.slice(signOutStart, discardStart);
assert.match(signOutBody, /runSignOutAttempt/);
assert.equal(signOutBody.includes('beginSignOutTransaction({'), false);
const signOutAttempt = read('src/lib/authSessionMutation.ts').slice(
  read('src/lib/authSessionMutation.ts').indexOf(
    'export async function runSignOutAttempt',
  ),
);
assert.equal(
  signOutAttempt.includes('enqueueAuthMutation'),
  false,
  'sign-out attempt must not nested-await the queue',
);

assert.match(auth, /event === 'TOKEN_REFRESHED'/);
const tokenBlock = auth.slice(
  auth.indexOf("event === 'TOKEN_REFRESHED'"),
  auth.indexOf("event === 'SIGNED_IN'"),
);
assert.equal(tokenBlock.includes('commitCredentialSession'), false);

const registerFn = auth.slice(
  auth.indexOf('const registerWithEmail'),
  auth.indexOf('const verifySignupOtp'),
);
assert.match(registerFn, /enqueueAuthMutation/);
assert.match(registerFn, /supabase\.auth\.signUp/);
assert.ok(registerFn.indexOf('enqueueAuthMutation') < registerFn.indexOf('supabase.auth.signUp'));
assert.match(registerFn, /loadRecoveryState\(\)/);
assert.ok(registerFn.indexOf('loadRecoveryState()') < registerFn.indexOf('enqueueAuthMutation'));

const verifyFn = auth.slice(
  auth.indexOf('const verifySignupOtp'),
  auth.indexOf('const sendPhoneOtp'),
);
assert.match(verifyFn, /enqueueAuthMutation/);
assert.match(verifyFn, /supabase\.auth\.verifyOtp/);
assert.ok(verifyFn.indexOf('enqueueAuthMutation') < verifyFn.indexOf('supabase.auth.verifyOtp'));
assert.match(verifyFn, /loadRecoveryState\(\)/);
assert.ok(verifyFn.indexOf('loadRecoveryState()') < verifyFn.indexOf('enqueueAuthMutation'));

const changePassword = auth.slice(
  auth.indexOf('const changePassword'),
  auth.indexOf('const value = useMemo'),
);
assert.match(changePassword, /runPasswordChange/);
assert.match(changePassword, /signInWithPassword/);
const passwordChange = read('src/lib/authSessionMutation.ts');
assert.ok(
  passwordChange.indexOf('export async function runPasswordChange') <
    passwordChange.indexOf('return input.enqueue'),
);

const deepLink = read('src/lib/authDeepLink.ts');
assert.match(deepLink, /commitCredentialSession/);
const exchangeSlot = deepLink.slice(deepLink.indexOf('exchangeCodeForSession'));
assert.ok(
  exchangeSlot.indexOf('stale: true') !== -1 &&
    exchangeSlot.indexOf('stale: true') <
      exchangeSlot.indexOf('commitCredentialSession'),
);
const setSessionSlot = deepLink.slice(deepLink.indexOf('supabase.auth.setSession'));
assert.ok(
  setSessionSlot.indexOf('stale: true') !== -1 &&
    setSessionSlot.indexOf('stale: true') <
      setSessionSlot.indexOf('commitCredentialSession'),
);

const rootNavigator = read('src/navigation/RootNavigator.tsx');
assert.match(rootNavigator, /shouldForceCredentialReadiness/);
assert.match(rootNavigator, /navigateSignedOut\('SignIn'\)/);
const navigationRefSource = read('src/navigation/navigationRef.ts');
assert.match(navigationRefSource, /routeNames\.includes\(name\)/);
assert.ok(
  navigationRefSource.indexOf('mountedNavigatorHas(name)') <
    navigationRefSource.indexOf("navigationRef.navigate('SignIn'"),
);
const branch = rootNavigator.slice(
  rootNavigator.indexOf('function SignedOutBranch'),
  rootNavigator.indexOf('export default function RootNavigator'),
);
assert.equal(branch.includes('key={'), false);
assert.equal(branch.includes('hasSession'), true);

console.log('auth-signout-slot-selftest ok');
