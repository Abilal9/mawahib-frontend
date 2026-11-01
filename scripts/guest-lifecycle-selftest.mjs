/**
 * Phase H: Guest signed-out lifecycle wiring, providers, return intent, back stack.
 * Run: node --no-warnings scripts/guest-lifecycle-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const auth = read('src/context/AuthContext.tsx');
const rootNavigator = read('src/navigation/RootNavigator.tsx');
const authenticated = read('src/navigation/AuthenticatedNavigator.tsx');
const providers = read('src/navigation/AuthenticatedProviders.tsx');
const productTree = read('src/lib/productTree.ts');
const signIn = read('src/screens/auth/SignInScreen.tsx');
const splash = read('src/screens/onboarding/SplashScreen2.tsx');
const app = read('App.tsx');
const returnIntent = read('src/lib/returnIntent.ts');

assert.match(auth, /signedOutReason/);
assert.match(auth, /continueAsGuest/);
assert.match(auth, /interpretSignedOut/);
assert.match(auth, /isCallbackSessionCommitInFlight\(\)/);
assert.match(auth, /shouldIgnoreAuthEventForCallbackCommit/);
assert.match(auth, /isGuestChosenInFlight/);
assert.match(auth, /beginGuestChosen\(\)/);
assert.match(auth, /kind === 'identityMismatch'/);
assert.match(auth, /enqueueAuthMutation/);
assert.match(auth, /invalidateAuthCallbacks\(\)/);
assert.match(auth, /leaveAuthenticatedProduct/);
assert.match(auth, /enterSignedOutAt\(\{ name: 'GuestTabs' \}\)/);
assert.match(auth, /enterAuthenticatedProduct\(\)/);
assert.match(read('src/lib/authSessionMutation.ts'), /signOutError/);
assert.match(auth, /resetToSignedOut\('GuestTabs'\)/);
assert.match(auth, /isMawahibProfileMissingError/);
assert.ok(
  auth.indexOf('isMawahibProfileMissingError') <
    auth.indexOf("err.status === 401"),
);
assert.match(auth, /isAccountSuspendedError/);
assert.ok(
  auth.indexOf('isAccountSuspendedError(err)') <
    auth.indexOf("err.status === 401"),
);

assert.match(rootNavigator, /resolveSignedOutBranchEntry/);
assert.match(rootNavigator, /AuthenticatedProviders key=\{apiUser\.id\}/);
assert.match(rootNavigator, /leaveAuthenticatedProduct\(\)/);
assert.match(rootNavigator, /processStarted && !mediaCacheReady/);
assert.match(rootNavigator, /accountSuspended && !recovery/);
assert.equal(rootNavigator.includes('NavigationContainer'), false);
assert.equal(app.split('<NavigationContainer').length, 2);

assert.match(authenticated, /leaveAuthenticatedProduct\(\{ name: 'SignIn' \}\)/);
assert.match(providers, /MessagingUnreadProvider|Unread|Notifications|Saved|UserJobs|Connections|Posts/);

assert.match(productTree, /resetPrivateModuleCaches\(\)/);
assert.match(productTree, /invalidateReturnIntents\(\)/);
assert.match(productTree, /markAuthenticatedProcess\(\)/);

assert.match(signIn, /Continue as Guest/);
assert.match(signIn, /beforeRemove/);
assert.match(signIn, /invalidateReturnIntents/);

assert.match(splash, /GuestTabs/);
assert.match(splash, /consumeProcessStart\(\)/);
assert.equal(splash.includes('isGuestBrowsingEnabled'), false);
assert.equal(splash.includes("name: 'Welcome'"), false);

assert.match(returnIntent, /invalidateReturnIntents/);
assert.match(auth, /invalidateReturnIntents\(\)/);
assert.equal(auth.includes('isGuestBrowsingEnabled'), false);
assert.equal(auth.includes('EXPO_PUBLIC_GUEST_BROWSING'), false);
assert.match(auth, /refreshSession\(\)/);
assert.ok(
  auth.indexOf('supabase.auth.refreshSession()') <
    auth.indexOf('await hydrateBackendUser(session)'),
);

const callSites = [
  ["src/context/AuthContext.tsx", "signOut('hydrate401'"],
  ["src/context/AuthContext.tsx", "signOut('recoveryAbort'"],
  ["src/lib/authDeepLink.ts", "releaseStaleCallbackSession"],
  ["src/lib/authSessionMutation.ts", "kind: 'recoveryComplete'"],
  ["src/components/auth/LocalSignOutConfirm.tsx", "signOut('logout')"],
  ["src/screens/auth/AccountSuspendedScreen.tsx", "signOut('suspensionLogout')"],
  ["src/screens/auth/ForgotPasswordScreen.tsx", "signOut('sessionClearForRecovery'"],
];
for (const [file, marker] of callSites) {
  assert.match(read(file), new RegExp(marker.replace(/[()']/g, '\\$&')));
}

const remaining = [
  'src/components/auth/LocalSignOutConfirm.tsx',
  'src/screens/auth/AccountSuspendedScreen.tsx',
  'src/screens/profile/SettingsScreen.tsx',
  'src/components/layout/AppSidebar.tsx',
  'src/screens/auth/ChangePasswordScreen.tsx',
];
for (const file of remaining) {
  const source = read(file);
  assert.equal(
    source.includes('leaveAuthenticatedProduct'),
    false,
    `${file} must not choose the signed-out destination`,
  );
}

console.log('guest-lifecycle-selftest ok');
