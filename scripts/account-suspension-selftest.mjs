/**
 * Account suspension is a backend 403, not a 401 sign-out.
 * Source scan only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const api = read('src/lib/apiClient.ts');
const fences = read('src/lib/identityFences.ts');
const auth = read('src/context/AuthContext.tsx');
const navigator = read('src/navigation/RootNavigator.tsx');
const screen = read('src/screens/auth/AccountSuspendedScreen.tsx');
const catalog = read('src/i18n/catalogs/authFlow.ts');
const deepLink = read('src/components/auth/AuthDeepLinkListener.tsx');
const signIn = read('src/screens/auth/SignInScreen.tsx');
const strategyNote = read('docs/AUTH.md');

assert.match(api, /ACCOUNT_SUSPENDED/);
assert.match(fences, /status === 403/);
assert.match(fences, /isAccountSuspendedError/);
assert.ok(
  fences.lastIndexOf('assertLivePrincipal(deps.principal, deps);') <
    fences.indexOf('deps.onAccountSuspended'),
);
assert.match(api, /subscribeAccountSuspended/);
assert.equal(api.includes('signOut'), false);
assert.equal(api.includes("scope: 'local'"), false);

const hydrate = auth.slice(
  auth.indexOf('const hydrateBackendUser'),
  auth.indexOf('const refreshMe'),
);
const suspendedAt = hydrate.indexOf('isAccountSuspendedError');
const bootstrapAt = hydrate.indexOf('authApi.bootstrap');
assert.ok(suspendedAt !== -1 && bootstrapAt !== -1 && suspendedAt < bootstrapAt);
assert.match(auth, /accountSuspended/);
assert.match(auth, /markAccountSuspended/);
assert.match(auth, /suspensionEpoch/);
assert.ok(
  hydrate.indexOf('suspensionEpoch.current !== suspensionAtStart') !== -1 &&
    hydrate.indexOf('suspensionEpoch.current !== suspensionAtStart') <
      hydrate.indexOf('applyApiUser(user)'),
);
assert.match(auth, /recheckAccountStatus/);
assert.match(auth, /accessTokenSubject/);
assert.match(auth, /kind: 'account_suspended'|account_suspended/);

const logout = auth.slice(
  auth.indexOf('const signOut = useCallback'),
  auth.indexOf('const completePasswordReset'),
);
assert.match(logout, /scope: 'local'/);
assert.equal(logout.includes("scope: 'global'"), false);

assert.match(navigator, /accountSuspended && !recovery/);
assert.match(navigator, /AccountSuspended/);
const suspendedBranch = navigator.slice(
  navigator.indexOf('if (accountSuspended && !recovery)'),
  navigator.indexOf('const initialRouteName'),
);
assert.equal(suspendedBranch.includes('navigation.reset'), false);
assert.equal(suspendedBranch.includes('MainTabs'), false);
assert.equal(suspendedBranch.includes('GuestTabs'), false);

assert.match(screen, /auth\.suspendedTitle/);
assert.match(screen, /auth\.reachSupport/);
assert.match(catalog, /Account suspended/);
assert.match(catalog, /reach out to support/);
assert.match(screen, /mailto:support@mawahib\.io/);
assert.equal(screen.includes('mailto:support@mawahib.io?'), false);
assert.match(screen, /Linking\.openURL\(SUPPORT_MAILTO\)/);
assert.equal(screen.includes('info@mawahib.io'), false);
assert.equal(/access_token|refresh_token|Authorization/i.test(screen), false);
assert.match(catalog, /Unable to open your email app/);
assert.match(screen, /auth\.checkAgain/);
assert.match(screen, /auth\.logOut/);
assert.match(screen, /recheckAccountStatus/);
assert.match(screen, /signOut/);
assert.match(screen, /signOut\('suspensionLogout'\)/);
assert.equal(screen.includes('leaveAuthenticatedProduct'), false);
assert.equal(/appeal/i.test(screen), false);

assert.match(deepLink, /accountSuspendedRef\.current/);
assert.match(deepLink, /isAccountSuspendedError/);
assert.match(signIn, /isAccountSuspendedFailure/);
assert.match(strategyNote, /account_status/);
assert.match(strategyNote, /scope: 'local'/);
assert.match(auth, /loadRecoveryState\(\)/);
assert.match(auth, /PASSWORD_RECOVERY/);

console.log('account-suspension-selftest: ok');
