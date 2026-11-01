/**
 * Signed-out destination selection and optional-auth dismissal.
 * Executes the decision table, including stale rendered session snapshots.
 * Run: node --no-warnings --experimental-strip-types scripts/signed-out-branch-entry-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canDismissOptionalAuth,
  isTrustedGuestLanding,
  mainTabsGateLeaveAction,
  localSignOutDecision,
  resolveSignedOutBranchEntry,
  shouldApplySignOutOutcome,
  shouldClearLogoutReasonForIncomingSession,
  shouldForceCredentialReadiness,
  shouldPreventOptionalAuthRemove,
} from '../src/lib/signedOutBranchEntry.ts';
import {
  getSignedOutReason,
  getSignedOutUserId,
  resetSignedOutReasonForTests,
  setSignedOutReason,
} from '../src/lib/signedOutReason.ts';
import {
  beginSignOutTransaction,
  failSignOutTransaction,
  getActiveSignOutTransaction,
  interpretSignedOut,
  resetSignOutTransactionForTests,
} from '../src/lib/signOutTransaction.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function resolve(overrides = {}) {
  return resolveSignedOutBranchEntry({
    handoff: null,
    recoveryLocked: false,
    hasSession: false,
    renderedUserId: null,
    productActive: false,
    reason: 'none',
    signedOutUserId: null,
    wasAuthenticated: false,
    txn: null,
    ...overrides,
  });
}

const guestHandoff = { name: 'GuestTabs' };

// Completed logout + stale React session/profile of A → Guest Home.
assert.equal(
  resolve({
    handoff: guestHandoff,
    hasSession: true,
    renderedUserId: USER_A,
    productActive: false,
    reason: 'logout',
    signedOutUserId: USER_A,
  }).name,
  'GuestTabs',
);

// Handoff already consumed; reason still logout; stale session remains.
assert.equal(
  resolve({
    handoff: null,
    hasSession: true,
    renderedUserId: USER_A,
    reason: 'logout',
    signedOutUserId: USER_A,
  }).name,
  'GuestTabs',
);

// Suspension logout uses the same trusted landing.
assert.equal(
  resolve({
    handoff: guestHandoff,
    hasSession: true,
    renderedUserId: USER_A,
    reason: 'logout',
    signedOutUserId: USER_A,
    txn: {
      kind: 'suspensionLogout',
      status: 'completed',
      destination: 'GuestTabs',
    },
  }).name,
  'GuestTabs',
);

// Remount sequence: consume handoff, resolve again with stale session.
const first = resolve({
  handoff: guestHandoff,
  hasSession: true,
  renderedUserId: USER_A,
  reason: 'logout',
  signedOutUserId: USER_A,
});
const second = resolve({
  handoff: null,
  hasSession: true,
  renderedUserId: USER_A,
  reason: 'logout',
  signedOutUserId: USER_A,
});
assert.equal(first.name, 'GuestTabs');
assert.equal(second.name, 'GuestTabs');

// Untrusted GuestTabs while a live session exists and reason is none → Sign In.
assert.equal(
  resolve({
    handoff: guestHandoff,
    hasSession: true,
    renderedUserId: USER_A,
    reason: 'none',
    signedOutUserId: null,
  }).name,
  'SignIn',
);

// No handoff, session/readiness still present → Sign In.
assert.equal(
  resolve({
    hasSession: true,
    renderedUserId: USER_A,
    reason: 'none',
  }).name,
  'SignIn',
);

// Unexpected expiry.
assert.equal(
  resolve({
    reason: 'expired',
    hasSession: false,
  }).name,
  'SignIn',
);
assert.equal(
  resolve({
    reason: 'expired',
    hasSession: false,
  }).params?.notice,
  'session-expired',
);

// Recovery lock ignores GuestTabs even after logout reason.
assert.equal(
  resolve({
    handoff: guestHandoff,
    recoveryLocked: true,
    reason: 'logout',
    signedOutUserId: USER_A,
    renderedUserId: USER_A,
  }).name,
  'SignIn',
);
assert.equal(
  resolve({
    handoff: { name: 'ForgotPassword' },
    recoveryLocked: true,
    reason: 'logout',
    signedOutUserId: USER_A,
  }).name,
  'ForgotPassword',
);

// Splash GuestTabs with no session is still Guest Home.
assert.equal(
  resolve({
    handoff: guestHandoff,
    hasSession: false,
    reason: 'none',
  }).name,
  'GuestTabs',
);

// Account B rendered after A's logout must not inherit Guest Home.
assert.equal(
  resolve({
    handoff: null,
    hasSession: true,
    renderedUserId: USER_B,
    reason: 'logout',
    signedOutUserId: USER_A,
  }).name,
  'SignIn',
);
assert.equal(
  resolve({
    handoff: guestHandoff,
    hasSession: true,
    renderedUserId: USER_B,
    reason: 'guestChosen',
    signedOutUserId: null,
  }).name,
  'SignIn',
);

// Explicit later writer (ForgotPassword / SignIn) wins over trusted Guest.
assert.equal(
  resolve({
    handoff: { name: 'ForgotPassword' },
    reason: 'logout',
    signedOutUserId: USER_A,
    renderedUserId: USER_A,
  }).name,
  'ForgotPassword',
);

// Product still marked authenticated with no trusted logout → Sign In.
assert.equal(
  resolve({
    handoff: guestHandoff,
    productActive: true,
    hasSession: false,
    reason: 'none',
  }).name,
  'SignIn',
);

// wasAuthenticated + reason none, no session (unready) → Sign In.
assert.equal(
  resolve({
    wasAuthenticated: true,
    reason: 'none',
    hasSession: false,
  }).name,
  'SignIn',
);

// Continue as Guest.
assert.equal(
  resolve({
    reason: 'guestChosen',
    signedOutUserId: null,
    hasSession: false,
  }).name,
  'GuestTabs',
);

assert.equal(
  isTrustedGuestLanding({
    reason: 'logout',
    signedOutUserId: USER_A,
    renderedUserId: USER_A,
    recoveryLocked: false,
  }),
  true,
);
assert.equal(
  isTrustedGuestLanding({
    reason: 'logout',
    signedOutUserId: USER_A,
    renderedUserId: USER_B,
    recoveryLocked: false,
  }),
  false,
);

// Failed logout never produces a leave interpretation from a failed txn.
resetSignOutTransactionForTests();
beginSignOutTransaction({ kind: 'logout', expectedUserId: USER_A });
failSignOutTransaction();
assert.equal(getActiveSignOutTransaction()?.status, 'failed');
assert.deepEqual(
  interpretSignedOut({
    hadAuthenticatedProduct: true,
    recoveryLocked: false,
    processStarted: true,
  }),
  { reason: 'expired', destination: 'SignIn', apply: true },
);
resetSignOutTransactionForTests();

// Duplicate SIGNED_OUT after logout completed: no txn, process mark already cleared.
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: false,
    recoveryLocked: false,
    processStarted: true,
  }).apply,
  false,
);
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: false,
    recoveryLocked: false,
    processStarted: true,
  }).reason,
  'none',
);

// Stale A's completion must not apply onto B.
assert.equal(
  shouldApplySignOutOutcome({ expectedUserId: USER_A, liveUserId: USER_B }),
  false,
);
assert.equal(
  shouldApplySignOutOutcome({ expectedUserId: USER_A, liveUserId: USER_A }),
  true,
);
assert.equal(
  shouldApplySignOutOutcome({ expectedUserId: USER_A, liveUserId: null }),
  true,
);

assert.equal(
  localSignOutDecision({ expectedUserId: USER_A, liveUserId: USER_B }),
  'stale-other-user',
);
assert.equal(
  localSignOutDecision({ expectedUserId: USER_A, liveUserId: USER_A }),
  'sign-out',
);
assert.equal(
  localSignOutDecision({ expectedUserId: USER_A, liveUserId: null }),
  'already-gone',
);

// Incoming session B clears sticky logout reason; A's own id does not.
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'logout',
    signedOutUserId: USER_A,
    incomingUserId: USER_B,
  }),
  true,
);
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'logout',
    signedOutUserId: USER_A,
    incomingUserId: USER_A,
  }),
  false,
);
assert.equal(
  shouldClearLogoutReasonForIncomingSession({
    reason: 'expired',
    signedOutUserId: null,
    incomingUserId: USER_B,
  }),
  false,
);
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
    reason: 'guestChosen',
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

resetSignedOutReasonForTests();
setSignedOutReason('logout', USER_A);
assert.equal(getSignedOutReason(), 'logout');
assert.equal(getSignedOutUserId(), USER_A);
setSignedOutReason('none');
assert.equal(getSignedOutUserId(), null);

// MainTabsGate: do not overwrite after the product already left.
assert.equal(
  mainTabsGateLeaveAction({
    authLoading: false,
    productActive: false,
    recoveryLocked: false,
    isSignedIn: false,
    hasVerifiedProfile: false,
  }),
  'none',
);
assert.equal(
  mainTabsGateLeaveAction({
    authLoading: false,
    productActive: true,
    recoveryLocked: false,
    isSignedIn: false,
    hasVerifiedProfile: false,
  }),
  'SignIn',
);
assert.equal(
  mainTabsGateLeaveAction({
    authLoading: false,
    productActive: true,
    recoveryLocked: true,
    isSignedIn: true,
    hasVerifiedProfile: true,
  }),
  'SignIn',
);
assert.equal(
  mainTabsGateLeaveAction({
    authLoading: false,
    productActive: true,
    recoveryLocked: false,
    isSignedIn: true,
    hasVerifiedProfile: false,
  }),
  'SignIn',
);
assert.equal(
  mainTabsGateLeaveAction({
    authLoading: true,
    productActive: true,
    recoveryLocked: false,
    isSignedIn: false,
    hasVerifiedProfile: false,
  }),
  'none',
);

// Optional-auth back: Guest-rooted stack only.
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'none',
    routes: [{ name: 'GuestTabs' }, { name: 'SignIn' }],
    index: 1,
  }),
  true,
);
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'none',
    routes: [
      { name: 'GuestTabs' },
      { name: 'Welcome' },
      { name: 'AccountType' },
      { name: 'SignIn' },
    ],
    index: 3,
  }),
  true,
);
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'expired',
    routes: [{ name: 'SignIn' }],
    index: 0,
  }),
  false,
);
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'none',
    routes: [{ name: 'SignIn' }],
    index: 0,
  }),
  false,
);
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: true,
    reason: 'none',
    routes: [{ name: 'GuestTabs' }, { name: 'SignIn' }],
    index: 1,
  }),
  false,
);
assert.equal(
  canDismissOptionalAuth({
    recoveryLocked: false,
    reason: 'none',
    routes: [{ name: 'ForgotPassword' }, { name: 'SignIn' }],
    index: 1,
  }),
  false,
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
assert.equal(
  shouldPreventOptionalAuthRemove({
    loading: false,
    recoveryLocked: false,
    reason: 'none',
    hasLiveUnappliedSession: true,
  }),
  true,
);
assert.equal(
  shouldPreventOptionalAuthRemove({
    loading: true,
    recoveryLocked: false,
    reason: 'none',
  }),
  true,
);
assert.equal(
  shouldPreventOptionalAuthRemove({
    recoveryLocked: false,
    reason: 'expired',
  }),
  true,
);
assert.equal(
  shouldPreventOptionalAuthRemove({
    loading: false,
    recoveryLocked: false,
    reason: 'none',
    hasLiveUnappliedSession: false,
  }),
  false,
);

const rootNavigator = read('src/navigation/RootNavigator.tsx');
assert.match(rootNavigator, /resolveSignedOutBranchEntry/);
assert.equal(rootNavigator.includes('handoff.name !== \'GuestTabs\''), false);

const signIn = read('src/screens/auth/SignInScreen.tsx');
assert.match(signIn, /canDismissOptionalAuth/);
assert.match(signIn, /shouldPreventOptionalAuthRemove/);
assert.match(signIn, /onBack=\{canDismiss \? \(\) => navigation.goBack\(\)/);

const welcome = read('src/screens/onboarding/WelcomeScreen.tsx');
assert.match(welcome, /canDismissOptionalAuth/);
assert.match(welcome, /invalidateReturnIntents/);
assert.match(welcome, /beforeRemove/);
assert.match(welcome, /AuthBrandHeader/);

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /shouldApplySignOutOutcome/);
assert.match(auth, /shouldClearLogoutReasonForIncomingSession/);
assert.match(auth, /establishment: 'restore'/);
assert.match(auth, /beginQueuedSignOutIfCurrent/);
assert.match(auth, /commitCredentialSession/);
assert.match(auth, /localSignOutDecision/);
assert.match(auth, /hydrateSessionRef\.current\?\.user\?\.id/);
assert.match(auth, /await enqueueAuthMutation\(async \(\) => \{/);
assert.match(signIn, /gestureEnabled: canDismiss/);
assert.match(signIn, /shouldPreventOptionalAuthRemove/);

const gate = read('src/navigation/AuthenticatedNavigator.tsx');
assert.match(gate, /mainTabsGateLeaveAction/);

console.log('signed-out-branch-entry-selftest ok');
