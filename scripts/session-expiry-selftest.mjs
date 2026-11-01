/**
 * Phase H: raw SIGNED_OUT, warm expiry, cold no-session, no splash replay.
 * Run: node --no-warnings --experimental-strip-types scripts/session-expiry-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  beginSignOutTransaction,
  interpretSignedOut,
  resetSignOutTransactionForTests,
} from '../src/lib/signOutTransaction.ts';
import {
  markAuthenticatedProcess,
  resetSignedOutReasonForTests,
  setSignedOutReason,
  signedOutDestinationName,
} from '../src/lib/signedOutReason.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function interpret(overrides = {}) {
  return interpretSignedOut({
    hadAuthenticatedProduct: false,
    recoveryLocked: false,
    processStarted: false,
        ...overrides,
  });
}

resetSignOutTransactionForTests();
resetSignedOutReasonForTests();

assert.equal(interpret().destination, 'GuestTabs');
assert.equal(interpret().apply, false);

beginSignOutTransaction({ kind: 'logout' });
assert.equal(interpret({ hadAuthenticatedProduct: true, processStarted: true }).destination, 'GuestTabs');
resetSignOutTransactionForTests();

beginSignOutTransaction({ kind: 'suspensionLogout' });
assert.equal(interpret({ hadAuthenticatedProduct: true, processStarted: true }).destination, 'GuestTabs');
resetSignOutTransactionForTests();

beginSignOutTransaction({ kind: 'recoveryComplete' });
assert.equal(interpret({ recoveryLocked: true, processStarted: true }).destination, 'SignIn');
resetSignOutTransactionForTests();

beginSignOutTransaction({ kind: 'recoveryAbort' });
assert.equal(interpret({ recoveryLocked: true, processStarted: true }).destination, 'SignIn');
resetSignOutTransactionForTests();

beginSignOutTransaction({ kind: 'identityMismatch' });
assert.equal(interpret({ hadAuthenticatedProduct: true, processStarted: true }).destination, 'SignIn');
resetSignOutTransactionForTests();

assert.deepEqual(
  interpret({
    hadAuthenticatedProduct: true,
    processStarted: true,
      }),
  { reason: 'expired', destination: 'SignIn', apply: true },
);

assert.equal(
  interpret({
    hadAuthenticatedProduct: true,
    recoveryLocked: true,
    processStarted: true,
      }).apply,
  false,
);

resetSignedOutReasonForTests();
markAuthenticatedProcess();
setSignedOutReason('expired');
assert.equal(signedOutDestinationName({}), 'SignIn');
resetSignedOutReasonForTests();
assert.equal(signedOutDestinationName({}), 'GuestTabs');

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /event === 'SIGNED_OUT'/);
assert.match(auth, /refreshSession\(\)/);
assert.match(auth, /interpretSignedOut/);
assert.match(auth, /continueAsGuest/);
assert.match(auth, /getSignedOutReason\(\) !== 'expired'/);
assert.match(auth, /if \(first\.data\.session\) return false/);
assert.match(auth, /if \(second\.data\.session\) return false/);
assert.match(auth, /beginGuestChosen\(\)/);
assert.match(auth, /isCallbackSessionCommitInFlight\(\)/);

const rootNavigator = read('src/navigation/RootNavigator.tsx');
assert.match(rootNavigator, /leaveAuthenticatedProduct\(\)/);
assert.equal(rootNavigator.includes("leaveAuthenticatedProduct({ name: 'SignIn' })"), false);
assert.match(rootNavigator, /accountSuspended \|\| recovery/);
assert.match(rootNavigator, /resolveSignedOutBranchEntry/);
assert.equal(rootNavigator.includes("handoff.name !== 'GuestTabs'"), false);
assert.match(rootNavigator, /hasConsumedProcessStart/);
assert.match(rootNavigator, /key="app"/);
assert.equal(rootNavigator.includes("initialRouteName: 'Splash1'"), false);

const productTree = read('src/lib/productTree.ts');
assert.match(productTree, /consumeProcessStart\(\)/);
assert.match(productTree, /resetPrivateModuleCaches\(\)/);
assert.match(productTree, /resolveSignedOutDestination\(\)/);

const app = read('App.tsx');
assert.equal(app.split('<NavigationContainer').length, 2);

const splash = read('src/screens/onboarding/SplashScreen2.tsx');
assert.match(splash, /consumeProcessStart\(\)/);
assert.match(splash, /resolveColdStartDestination/);

const signIn = read('src/screens/auth/SignInScreen.tsx');
assert.match(signIn, /beforeRemove/);
assert.match(signIn, /invalidateReturnIntents/);
assert.match(signIn, /Continue as Guest/);

console.log('session-expiry-selftest ok');
