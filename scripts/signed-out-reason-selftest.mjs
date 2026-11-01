/**
 * Phase H: process-memory signedOutReason. expired is never persisted.
 * Run: node --no-warnings --experimental-strip-types scripts/signed-out-reason-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  beginGuestChosen,
  clearAuthenticatedProcess,
  endGuestChosen,
  getSignedOutReason,
  getSignedOutUserId,
  isGuestChosenInFlight,
  markAuthenticatedProcess,
  resetSignedOutReasonForTests,
  setSignedOutReason,
  signedOutDestinationName,
  wasAuthenticatedProcess,
} from '../src/lib/signedOutReason.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

resetSignedOutReasonForTests();
assert.equal(getSignedOutReason(), 'none');
assert.equal(wasAuthenticatedProcess(), false);
assert.equal(signedOutDestinationName({}), 'GuestTabs');

setSignedOutReason('logout', '11111111-1111-4111-8111-111111111111');
assert.equal(signedOutDestinationName({}), 'GuestTabs');
assert.equal(getSignedOutUserId(), '11111111-1111-4111-8111-111111111111');

setSignedOutReason('guestChosen');
assert.equal(signedOutDestinationName({}), 'GuestTabs');

setSignedOutReason('expired');
assert.equal(signedOutDestinationName({}), 'SignIn');

assert.equal(
  signedOutDestinationName({ recoveryLocked: true }),
  'SignIn',
);

resetSignedOutReasonForTests();
markAuthenticatedProcess();
assert.equal(wasAuthenticatedProcess(), true);
clearAuthenticatedProcess();
assert.equal(wasAuthenticatedProcess(), false);

assert.equal(isGuestChosenInFlight(), false);
beginGuestChosen();
assert.equal(isGuestChosenInFlight(), true);
endGuestChosen();
assert.equal(isGuestChosenInFlight(), false);

const reason = read('src/lib/signedOutReason.ts');
assert.equal(reason.includes('localStorage'), false);
assert.equal(reason.includes('AsyncStorage'), false);
assert.match(reason, /'none' \| 'logout' \| 'expired' \| 'guestChosen'/);

const auth = read('src/context/AuthContext.tsx');
assert.match(auth, /commitSignedOutReason\('expired'\)|reason === 'expired'|hydrate401/);
assert.match(auth, /commitSignedOutReason\('guestChosen',\s*null\)/);
assert.equal(auth.includes("if (!user) guest"), false);
assert.equal(auth.includes('if (!apiUser) guest'), false);

const dest = read('src/lib/signedOutDestination.ts');
assert.match(dest, /notice: 'session-expired'/);
assert.match(dest, /GuestTabs/);
assert.match(dest, /wasAuthenticatedProcess\(\)/);
assert.match(dest, /reason === 'none'/);

const signIn = read('src/screens/auth/SignInScreen.tsx');
assert.match(signIn, /Continue as Guest/);
assert.match(signIn, /continueAsGuest/);
assert.match(signIn, /session-expired|sessionExpired/);

console.log('signed-out-reason-selftest ok');
