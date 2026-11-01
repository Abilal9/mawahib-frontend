/**
 * Phase H: armed callback transactions, one-shot fingerprints, logout invalidation.
 * Run: node --no-warnings --experimental-strip-types scripts/auth-callback-transaction-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  armAuthCallback,
  beginCallbackSessionCommit,
  endCallbackSessionCommit,
  evaluateAuthCallback,
  getInflightCallbackEmail,
  invalidateAuthCallbacks,
  isCallbackSessionCommitInFlight,
  isCallbackSessionCommitStale,
  shouldIgnoreAuthEventForCallbackCommit,
  peekCallbackFingerprint,
  resetAuthCallbackForTests,
} from '../src/lib/authCallbackTransaction.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const signupUrl =
  'mawahib://auth/callback#access_token=aaa&refresh_token=bbb&type=signup&email=a@example.com';
const recoveryUrl =
  'mawahib://auth/callback#access_token=aaa&refresh_token=bbb&type=recovery&email=a@example.com';
const otherSignupUrl =
  'mawahib://auth/callback#access_token=ccc&refresh_token=ddd&type=signup&email=b@example.com';

function reset() {
  resetAuthCallbackForTests();
}

reset();
assert.deepEqual(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }),
  { type: 'reject', reason: 'not-armed' },
);
assert.equal(peekCallbackFingerprint(signupUrl), 'rejected');

armAuthCallback({ flow: 'signup', email: 'a@example.com' });
assert.deepEqual(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }),
  { type: 'reject', reason: 'fingerprint-rejected' },
);

reset();
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
assert.deepEqual(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }),
  { type: 'accept', flow: 'signup', email: 'a@example.com' },
);
assert.deepEqual(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }),
  { type: 'reject', reason: 'fingerprint-consumed' },
);

reset();
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
assert.equal(
  evaluateAuthCallback({
    url: recoveryUrl,
    flow: 'recovery',
    email: 'a@example.com',
  }).reason,
  'flow-mismatch',
);

reset();
armAuthCallback({ flow: 'recovery', email: 'a@example.com' });
assert.equal(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }).reason,
  'flow-mismatch',
);

reset();
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
assert.equal(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'b@example.com',
  }).reason,
  'email-mismatch',
);

reset();
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
invalidateAuthCallbacks();
assert.equal(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }).reason,
  'not-armed',
);

reset();
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
evaluateAuthCallback({
  url: signupUrl,
  flow: 'signup',
  email: 'a@example.com',
});
armAuthCallback({ flow: 'signup', email: 'b@example.com' });
assert.equal(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'b@example.com',
  }).reason,
  'fingerprint-consumed',
);
assert.deepEqual(
  evaluateAuthCallback({
    url: otherSignupUrl,
    flow: 'signup',
    email: 'b@example.com',
  }),
  { type: 'accept', flow: 'signup', email: 'b@example.com' },
);

reset();
beginCallbackSessionCommit(0, 'a@example.com');
assert.equal(isCallbackSessionCommitInFlight(), true);
assert.equal(isCallbackSessionCommitStale(), false);
assert.equal(getInflightCallbackEmail(), 'a@example.com');
assert.equal(shouldIgnoreAuthEventForCallbackCommit('a@example.com'), true);
assert.equal(shouldIgnoreAuthEventForCallbackCommit('b@example.com'), true);
invalidateAuthCallbacks();
assert.equal(isCallbackSessionCommitStale(), true);
assert.equal(shouldIgnoreAuthEventForCallbackCommit('a@example.com'), true);
assert.equal(shouldIgnoreAuthEventForCallbackCommit('b@example.com'), false);
assert.equal(shouldIgnoreAuthEventForCallbackCommit(null), true);
endCallbackSessionCommit();
assert.equal(isCallbackSessionCommitInFlight(), false);
assert.equal(shouldIgnoreAuthEventForCallbackCommit('a@example.com'), false);

reset();
const initial = evaluateAuthCallback({
  url: signupUrl,
  flow: 'signup',
  email: 'a@example.com',
});
assert.equal(initial.reason, 'not-armed');
armAuthCallback({ flow: 'signup', email: 'a@example.com' });
assert.equal(
  evaluateAuthCallback({
    url: signupUrl,
    flow: 'signup',
    email: 'a@example.com',
  }).reason,
  'fingerprint-rejected',
);

const deepLink = read('src/lib/authDeepLink.ts');
assert.match(deepLink, /evaluateAuthCallback/);
assert.match(deepLink, /peekCallbackFingerprint/);
assert.match(deepLink, /getAuthCallbackEpoch\(\)/);
assert.match(deepLink, /beginCallbackSessionCommit/);
assert.match(deepLink, /endCallbackSessionCommit/);
assert.match(deepLink, /stale-callback-session/);
assert.match(deepLink, /getActiveSignOutTransaction/);
assert.match(deepLink, /isGuestChosenInFlight/);
assert.match(deepLink, /authLifecycleBlocksCallback/);
assert.match(deepLink, /enqueueAuthMutation/);
assert.ok(
  deepLink.indexOf("callbackType(url) === 'recovery'") <
    deepLink.indexOf('supabase.auth.setSession'),
);
assert.ok(
  deepLink.indexOf("callbackType(url) === 'recovery'") <
    deepLink.indexOf('exchangeCodeForSession'),
);
assert.match(deepLink, /loadPendingSignup\(\)/);
assert.ok(
  deepLink.indexOf('loadPendingSignup()') <
    deepLink.indexOf('supabase.auth.setSession'),
);

const supabase = read('src/lib/supabase.ts');
assert.match(supabase, /detectSessionInUrl:\s*false/);

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /invalidateAuthCallbacks\(\)/);
assert.match(auth, /shouldIgnoreAuthEventForCallbackCommit/);
const listener = read('src/components/auth/AuthDeepLinkListener.tsx');
assert.match(listener, /stale-callback-session/);
assert.match(listener, /endCallbackSessionCommit/);
assert.equal(listener.includes('identityMismatch'), false);
assert.equal(listener.includes('signOut'), false);
assert.match(deepLink, /releaseStaleCallbackSession/);
const firstRelease = deepLink.indexOf('await releaseStaleCallbackSession');
const firstCommit = deepLink.indexOf('commitCredentialSession({');
assert.ok(firstRelease !== -1 && firstRelease < firstCommit);
const secondRelease = deepLink.indexOf(
  'await releaseStaleCallbackSession',
  firstRelease + 1,
);
const secondCommit = deepLink.indexOf('commitCredentialSession({', firstCommit + 1);
assert.ok(secondRelease !== -1 && secondRelease < secondCommit);

const confirm = read('src/screens/auth/ConfirmCodeScreen.tsx');
assert.match(confirm, /armAuthCallback\(\{ flow: 'signup'/);
const forgot = read('src/screens/auth/ForgotPasswordScreen.tsx');
assert.match(forgot, /armAuthCallback\(\{ flow: 'recovery'/);
const signUp = read('src/screens/auth/SignUpScreen.tsx');
assert.match(signUp, /armAuthCallback\(\{ flow: 'signup'/);

console.log('auth-callback-transaction-selftest ok');
