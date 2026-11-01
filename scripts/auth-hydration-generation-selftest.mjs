/**
 * Same-user login hydration versus the two credential generation bumps.
 * Production helpers only. Not a mounted AuthProvider.
 * Run: node --no-warnings --experimental-strip-types scripts/auth-hydration-generation-selftest.mjs
 */
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => (mem.has(key) ? mem.get(key) : null),
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: (key) => mem.delete(key),
};

const { shouldIgnoreStaleAuthResult } = await import(
  '../src/context/authSessionGuard.ts'
);
const {
  applyApiUserAllowed,
  beginQueuedSignOutIfCurrent,
  commitCredentialSession,
  getSessionGeneration,
  resetSessionGenerationForTests,
} = await import('../src/lib/authSignOutSlot.ts');
const {
  beginSignOutTransaction,
  getActiveSignOutTransaction,
  resetSignOutTransactionForTests,
} = await import('../src/lib/signOutTransaction.ts');
const { shouldApplyHydrate401Expiry } = await import(
  '../src/lib/authSessionMutation.ts'
);
const { resetSignedOutReasonForTests, setSignedOutReason } = await import(
  '../src/lib/signedOutReason.ts'
);

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function reset() {
  mem.clear();
  resetSessionGenerationForTests();
  resetSignOutTransactionForTests();
  resetSignedOutReasonForTests();
}

function commit() {
  return commitCredentialSession({
    reason: 'none',
    setReasonNone: () => setSignedOutReason('none'),
  });
}

reset();
setSignedOutReason('logout', USER_A);
const listenerGeneration = commit();
const captured = getSessionGeneration();
assert.equal(listenerGeneration, captured);
const slotGeneration = commit();
assert.equal(slotGeneration, captured + 1);

const superseded = beginQueuedSignOutIfCurrent({
  kind: 'hydrate401',
  expectedUserId: USER_A,
  generationAtCall: captured,
  liveUserId: null,
  begin: beginSignOutTransaction,
});
assert.equal(superseded.status, 'superseded');
assert.equal(getActiveSignOutTransaction(), null);
assert.equal(shouldApplyHydrate401Expiry(captured, getSessionGeneration()), false);

const sameToken = 'token-a';
assert.equal(
  shouldIgnoreStaleAuthResult({
    epochAtStart: 1,
    epochNow: 1,
    requestToken: sameToken,
    trackedToken: sameToken,
    liveToken: sameToken,
  }),
  false,
);
assert.equal(
  applyApiUserAllowed({
    txnStatus: null,
    incomingUserId: USER_A,
    guestChosenInFlight: false,
    ignoreCallbackCommit: false,
  }),
  true,
);

assert.equal(
  shouldIgnoreStaleAuthResult({
    epochAtStart: 1,
    epochNow: 2,
    requestToken: sameToken,
    trackedToken: sameToken,
    liveToken: sameToken,
  }),
  true,
);

const newerToken = 'token-a-2';
assert.equal(
  shouldIgnoreStaleAuthResult({
    epochAtStart: 1,
    epochNow: 1,
    requestToken: sameToken,
    trackedToken: newerToken,
    liveToken: newerToken,
  }),
  true,
);

assert.equal(
  applyApiUserAllowed({
    txnStatus: null,
    incomingUserId: USER_B,
    guestChosenInFlight: false,
    ignoreCallbackCommit: false,
  }),
  true,
);
assert.equal(
  shouldIgnoreStaleAuthResult({
    epochAtStart: 1,
    epochNow: 1,
    requestToken: sameToken,
    trackedToken: 'token-b',
    liveToken: 'token-b',
  }),
  true,
);

assert.equal(shouldApplyHydrate401Expiry(slotGeneration, slotGeneration), true);

const auth = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8'),
);
const signIn = auth.slice(auth.indexOf('const signInWithEmail = useCallback'));
assert.ok(signIn.indexOf('settleEstablishedCredential') < signIn.indexOf('await hydrateBackendUser'));
assert.ok(signIn.includes("throw new AuthFailure('backend_hydration'"));

console.log('auth-hydration-generation-selftest ok');
