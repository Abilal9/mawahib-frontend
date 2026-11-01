/**
 * Phase H: typed sign-out transactions and cache-safe conflict rules.
 * Run: node --no-warnings --experimental-strip-types scripts/signout-transaction-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  beginSignOutTransaction,
  completeSignOutTransaction,
  destinationForSignOutKind,
  failSignOutTransaction,
  getActiveSignOutTransaction,
  interpretSignedOut,
  resetSignOutTransactionForTests,
} from '../src/lib/signOutTransaction.ts';
import {
  enqueueAuthMutation,
  resetAuthMutationQueueForTests,
} from '../src/lib/authMutationQueue.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function reset() {
  resetSignOutTransactionForTests();
}

reset();
assert.equal(destinationForSignOutKind('logout'), 'GuestTabs');
assert.equal(destinationForSignOutKind('suspensionLogout'), 'GuestTabs');
assert.equal(destinationForSignOutKind('hydrate401'), 'SignIn');
assert.equal(destinationForSignOutKind('recoveryAbort'), 'SignIn');
assert.equal(destinationForSignOutKind('recoveryComplete'), 'SignIn');
assert.equal(destinationForSignOutKind('identityMismatch'), 'SignIn');
assert.equal(destinationForSignOutKind('sessionClearForRecovery'), 'ForgotPassword');

reset();
const first = beginSignOutTransaction({ kind: 'logout' });
assert.equal(first.status, 'started');
const dup = beginSignOutTransaction({ kind: 'logout' });
assert.equal(dup.status, 'duplicate');
assert.equal(dup.txn.id, first.txn.id);
reset();
beginSignOutTransaction({ kind: 'logout', expectedUserId: 'user-a' });
const otherOwner = beginSignOutTransaction({
  kind: 'logout',
  expectedUserId: 'user-b',
});
assert.equal(otherOwner.status, 'conflict');
const conflict = beginSignOutTransaction({
  kind: 'hydrate401',
  });
assert.equal(conflict.status, 'conflict');
assert.equal(conflict.txn.kind, 'logout');

reset();
beginSignOutTransaction({ kind: 'logout' });
failSignOutTransaction();
assert.equal(getActiveSignOutTransaction()?.status, 'failed');
const afterFail = beginSignOutTransaction({
  kind: 'suspensionLogout',
  });
assert.equal(afterFail.status, 'started');

reset();
beginSignOutTransaction({ kind: 'logout' });
completeSignOutTransaction();
assert.equal(getActiveSignOutTransaction()?.status, 'completed');
const afterComplete = beginSignOutTransaction({
  kind: 'hydrate401',
  });
assert.equal(afterComplete.status, 'started');

const kinds = [
  'logout',
  'suspensionLogout',
  'hydrate401',
  'recoveryAbort',
  'sessionClearForRecovery',
  'recoveryComplete',
  'identityMismatch',
];
for (const kind of kinds) {
  reset();
  beginSignOutTransaction({ kind });
  const interpreted = interpretSignedOut({
    hadAuthenticatedProduct: true,
    recoveryLocked: false,
    processStarted: true,
      });
  assert.equal(interpreted.apply, true);
  assert.equal(interpreted.destination, destinationForSignOutKind(kind));
}

reset();
assert.deepEqual(
  interpretSignedOut({
    hadAuthenticatedProduct: true,
    recoveryLocked: false,
    processStarted: true,
      }),
  { reason: 'expired', destination: 'SignIn', apply: true },
);

reset();
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: false,
    recoveryLocked: false,
    processStarted: false,
      }).reason,
  'none',
);
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: false,
    recoveryLocked: false,
    processStarted: false,
      }).apply,
  false,
);

reset();
beginSignOutTransaction({ kind: 'sessionClearForRecovery' });
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: true,
    recoveryLocked: true,
    processStarted: true,
      }).destination,
  'ForgotPassword',
);

reset();
assert.equal(
  interpretSignedOut({
    hadAuthenticatedProduct: true,
    recoveryLocked: true,
    processStarted: true,
      }).apply,
  false,
);

const auth = read('src/context/AuthContext.tsx');
const mutation = read('src/lib/authSessionMutation.ts');
assert.match(auth, /runSignOutAttempt/);
assert.match(auth, /markMediaCacheClearPending/);
assert.match(auth, /clearMediaImageCache/);
assert.match(mutation, /boundary\.fail\(txnId\)/);
assert.match(auth, /signOut\('hydrate401'/);
assert.match(auth, /signOut\('recoveryAbort'/);
const signOutFn = auth.slice(auth.indexOf('const signOut = useCallback'));
const snapWrite = signOutFn.indexOf('recoveryCleanupSnapRef.current = cleanupSnap');
const queueWrite = signOutFn.indexOf('enqueueAuthMutation');
assert.ok(snapWrite > queueWrite);
assert.equal(
  read('src/components/auth/AuthDeepLinkListener.tsx').includes('identityMismatch'),
  false,
);
assert.match(mutation, /kind: 'recoveryComplete'/);
assert.match(mutation, /Could not log out\. You are still signed in on this device\./);
assert.match(auth, /setLogoutFailureNotice/);
assert.match(mutation, /signOutError/);
assert.match(mutation, /kind === 'identityMismatch'/);
assert.match(auth, /enqueueAuthMutation/);
assert.match(mutation, /beginQueued:/);
assert.match(auth, /joinOrStartSignOut/);
assert.ok(
  mutation.indexOf("input.kind === 'identityMismatch'") !== -1,
);

const signOutBody = mutation.slice(
  mutation.indexOf('export async function runSignOutAttempt'),
);
assert.ok(
  signOutBody.indexOf('onPause(txnId)') < signOutBody.indexOf('signOutLocal()'),
);
const afterLocalAttempt = signOutBody.slice(signOutBody.indexOf('const signOutError'));
assert.ok(
  afterLocalAttempt.indexOf('if (signOutError)') <
    afterLocalAttempt.indexOf('flags.localSignOutDone = true'),
);
const markedFailAt = signOutBody.indexOf('if (!marked.ok)');
assert.ok(markedFailAt !== -1);
assert.ok(
  signOutBody.indexOf('boundary.fail(txnId)', markedFailAt) <
    signOutBody.indexOf('throw new Error', markedFailAt),
);

const confirm = read('src/components/auth/LocalSignOutConfirm.tsx');
assert.match(confirm, /signOut\('logout'\)/);
assert.equal(confirm.includes('leaveAuthenticatedProduct'), false);

const settings = read('src/screens/profile/SettingsScreen.tsx');
assert.equal(settings.includes("name: 'SignIn'"), false);
assert.match(settings, /useLocalSignOutPrompt\(\)/);

const sidebar = read('src/components/layout/AppSidebar.tsx');
assert.equal(sidebar.includes("name: 'SignIn'"), false);
assert.match(sidebar, /useLocalSignOutPrompt\(\)/);

const suspended = read('src/screens/auth/AccountSuspendedScreen.tsx');
assert.match(suspended, /signOut\('suspensionLogout'\)/);
assert.equal(suspended.includes('leaveAuthenticatedProduct'), false);

const forgot = read('src/screens/auth/ForgotPasswordScreen.tsx');
assert.match(forgot, /signOut\('sessionClearForRecovery'/);
assert.equal(forgot.includes("await signOut()"), false);

assert.equal(
  /supabase\.auth\.signOut\(\s*\)/.test(auth),
  false,
);
assert.equal(auth.includes("scope: 'others'"), true);

resetAuthMutationQueueForTests();
const order = [];
await Promise.all([
  enqueueAuthMutation(async () => {
    order.push('a-start');
    await Promise.resolve();
    order.push('a-end');
  }),
  enqueueAuthMutation(async () => {
    order.push('b-start');
    order.push('b-end');
  }),
]);
assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);

console.log('signout-transaction-selftest ok');
