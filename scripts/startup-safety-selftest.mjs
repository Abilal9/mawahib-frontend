/**
 * Cold-start routing and cross-account identity isolation.
 * Route decisions and the identity guard are executed.
 * Splash, font fallback, and context wiring are source-checked.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveColdStartDestination,
  showsProfileRetry,
} from '../src/lib/coldStartRoute.ts';
import { resolvePostAuthDestination, shouldEnterAuthenticatedProduct, phoneForPostAuth } from '../src/lib/postAuthGate.ts';
import { authenticatedEntryDecision } from '../src/lib/authenticatedEntry.ts';
import { shouldIgnoreStaleIdentityResult } from '../src/context/identityGuard.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function user(id, email, emailVerified = true) {
  return {
    id,
    email,
    emailVerified,
    accountType: 'talent',
    displayName: id,
    username: id,
    isVerified: false,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    reviewSummary: {
      overall: { average: null, count: 0 },
      asProvider: { average: null, count: 0 },
      asClient: { average: null, count: 0 },
    },
    bio: '',
    title: null,
    locationCity: null,
    locationCountry: null,
    avatarUrl: null,
    coverUrl: null,
    skills: [],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
  };
}

function sessionFor(email) {
  return {
    user: {
      email,
      email_confirmed_at: '2020-01-01T00:00:00Z',
    },
  };
}

const signedOut = resolveColdStartDestination({
  recovery: false,
  isSignedIn: false,
  apiUser: null,
  session: null,
  authError: null,
});
assert.deepEqual(signedOut, { kind: 'welcome' });

const hydratedUser = user('user-a', 'a@example.com');
const hydratedSession = sessionFor('a@example.com');
const hydrated = resolveColdStartDestination({
  recovery: false,
  isSignedIn: true,
  apiUser: hydratedUser,
  session: hydratedSession,
  authError: null,
  pendingEmail: 'stale@example.com',
  pendingResumable: true,
});
assert.equal(hydrated.kind, 'hydrated');
assert.equal(
  resolvePostAuthDestination({
    flow: 'restore',
    apiUser: hydratedUser,
    session: hydratedSession,
  }).name,
  'MainTabs',
);

const phonePendingUser = {
  ...hydratedUser,
  phoneE164: '+966538434738',
  phoneVerified: false,
};
assert.equal(
  resolvePostAuthDestination({
    flow: 'verify',
    apiUser: phonePendingUser,
    session: hydratedSession,
  }).name,
  'VerifyAccount',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'restore',
    apiUser: phonePendingUser,
    session: hydratedSession,
  }).name,
  'MainTabs',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'signin',
    apiUser: phonePendingUser,
    session: hydratedSession,
    pendingPhoneE164: '+966538434738',
  }).name,
  'MainTabs',
);
assert.equal(
  resolvePostAuthDestination({
    flow: 'deeplink',
    apiUser: phonePendingUser,
    session: hydratedSession,
  }).name,
  'VerifyAccount',
);
assert.equal(
  phoneForPostAuth({
    apiUser: { ...phonePendingUser, id: 'new-user', phoneE164: '' },
    pendingPhoneE164: '+966538434738',
    pendingUserId: 'deleted-user',
    pendingEmail: phonePendingUser.email,
  }),
  '',
);
const phoneVerifiedUser = { ...phonePendingUser, phoneVerified: true };
assert.equal(
  resolvePostAuthDestination({
    flow: 'verify',
    apiUser: phoneVerifiedUser,
    session: hydratedSession,
  }).name,
  'TurnOnNotifications',
);
assert.equal(
  shouldEnterAuthenticatedProduct({
    emailVerified: true,
    flow: 'signin',
  }),
  true,
);
assert.equal(
  shouldEnterAuthenticatedProduct({
    emailVerified: true,
    flow: 'restore',
  }),
  true,
);
assert.equal(
  shouldEnterAuthenticatedProduct({
    emailVerified: true,
    flow: 'verify',
  }),
  false,
);
assert.equal(
  shouldEnterAuthenticatedProduct({
    emailVerified: false,
    flow: 'signin',
  }),
  false,
);
const profileEntry = [
  { name: 'MainTabs' },
  { name: 'Profile' },
];
assert.equal(
  authenticatedEntryDecision({
    pending: profileEntry,
    routeNames: ['SignIn', 'SignUp'],
    consumed: false,
  }).type,
  'wait',
);
assert.deepEqual(
  authenticatedEntryDecision({
    pending: profileEntry,
    routeNames: ['MainTabs', 'Profile'],
    consumed: false,
  }),
  { type: 'reset', index: 1, routes: profileEntry },
);
assert.equal(
  authenticatedEntryDecision({
    pending: [{ name: 'MainTabs' }],
    routeNames: ['MainTabs', 'Profile'],
    consumed: false,
  }).type,
  'done',
);

const nestDown = resolveColdStartDestination({
  recovery: false,
  isSignedIn: false,
  apiUser: null,
  session: sessionFor('a@example.com'),
  authError: 'Failed to restore session',
  pendingEmail: 'stale@example.com',
  pendingResumable: true,
});
assert.deepEqual(nestDown, { kind: 'sign-in' });
assert.equal(
  showsProfileRetry({
    session: sessionFor('a@example.com'),
    apiUser: null,
    authError: 'Failed to restore session',
    recovery: false,
  }),
  true,
);

const retainedWithoutMessage = resolveColdStartDestination({
  recovery: false,
  isSignedIn: false,
  apiUser: null,
  session: sessionFor('a@example.com'),
  authError: null,
  pendingEmail: 'stale@example.com',
  pendingResumable: true,
});
assert.equal(retainedWithoutMessage.kind, 'sign-in');

const retriedUser = user('user-a', 'a@example.com');
const afterRetry = resolveColdStartDestination({
  recovery: false,
  isSignedIn: true,
  apiUser: retriedUser,
  session: sessionFor('a@example.com'),
  authError: null,
});
assert.equal(afterRetry.kind, 'hydrated');
assert.equal(
  resolvePostAuthDestination({
    flow: 'restore',
    apiUser: retriedUser,
    session: sessionFor('a@example.com'),
  }).name,
  'MainTabs',
);

const pendingOnly = resolveColdStartDestination({
  recovery: false,
  isSignedIn: false,
  apiUser: null,
  session: null,
  authError: null,
  pendingEmail: 'new@example.com',
  pendingResumable: true,
});
assert.deepEqual(pendingOnly, {
  kind: 'confirm-code',
  email: 'new@example.com',
});

const unverifiedUser = user('user-a', 'real@example.com', false);
const unverifiedSession = { user: { email: 'real@example.com' } };
const unverified = resolveColdStartDestination({
  recovery: false,
  isSignedIn: true,
  apiUser: unverifiedUser,
  session: unverifiedSession,
  authError: null,
  pendingEmail: 'stale@example.com',
  pendingResumable: true,
});
assert.equal(unverified.kind, 'hydrated');
const unverifiedDest = resolvePostAuthDestination({
  flow: 'restore',
  apiUser: unverifiedUser,
  session: unverifiedSession,
});
assert.equal(unverifiedDest.name, 'ConfirmCode');
assert.equal(unverifiedDest.params.email, 'real@example.com');

assert.equal(
  showsProfileRetry({
    session: null,
    apiUser: null,
    authError: 'Failed to restore session',
    recovery: false,
  }),
  false,
);

function account() {
  return { userId: null, epoch: 0, items: [], unread: 0 };
}

function changeUser(state, userId) {
  if (state.userId !== userId) {
    state.userId = userId;
    state.epoch += 1;
    state.items = [];
    state.unread = 0;
  }
}

function begin(state) {
  return { userId: state.userId, epoch: state.epoch };
}

function apply(state, started, payload) {
  if (
    shouldIgnoreStaleIdentityResult({
      startedUserId: started.userId,
      currentUserId: state.userId,
      epochAtStart: started.epoch,
      epochNow: state.epoch,
    })
  ) {
    return false;
  }
  state.items = payload.items;
  state.unread = payload.unread;
  return true;
}

const logout = account();
changeUser(logout, 'A');
const logoutRequest = begin(logout);
changeUser(logout, null);
assert.equal(apply(logout, logoutRequest, { items: ['a-private'], unread: 4 }), false);
assert.deepEqual(logout.items, []);
assert.equal(logout.unread, 0);

const switchAb = account();
changeUser(switchAb, 'A');
const aRequest = begin(switchAb);
changeUser(switchAb, 'B');
assert.equal(apply(switchAb, aRequest, { items: ['a-private'], unread: 4 }), false);
assert.deepEqual(switchAb.items, []);
const bRequest = begin(switchAb);
assert.equal(apply(switchAb, bRequest, { items: ['b-private'], unread: 1 }), true);
assert.deepEqual(switchAb.items, ['b-private']);
assert.equal(switchAb.unread, 1);

const logoutThenB = account();
changeUser(logoutThenB, 'A');
const beforeLogout = begin(logoutThenB);
changeUser(logoutThenB, null);
changeUser(logoutThenB, 'B');
assert.equal(
  apply(logoutThenB, beforeLogout, { items: ['a-private'], unread: 2 }),
  false,
);
const bAfterLogout = begin(logoutThenB);
assert.equal(
  apply(logoutThenB, bAfterLogout, { items: ['b-only'], unread: 0 }),
  true,
);
assert.deepEqual(logoutThenB.items, ['b-only']);

const backToA = account();
changeUser(backToA, 'A');
const firstA = begin(backToA);
changeUser(backToA, 'B');
changeUser(backToA, 'A');
assert.equal(apply(backToA, firstA, { items: ['old-a'], unread: 9 }), false);
assert.deepEqual(backToA.items, []);
const secondA = begin(backToA);
assert.equal(apply(backToA, secondA, { items: ['new-a'], unread: 1 }), true);
assert.deepEqual(backToA.items, ['new-a']);

assert.equal(
  shouldIgnoreStaleIdentityResult({
    startedUserId: null,
    currentUserId: null,
    epochAtStart: 0,
    epochNow: 0,
  }),
  true,
);

const auth = read('src/context/AuthContext.tsx');
const keepAt = auth.indexOf('Keep Supabase session');
const keep = auth.slice(keepAt, auth.indexOf('return null;', keepAt));
assert.equal(keep.includes('signOut'), false);
assert.match(keep, /setAuthError/);
assert.match(keep, /setApiUser\(null\)/);
assert.match(keep, /setIsSignedIn\(false\)/);

const splash = read('src/screens/onboarding/SplashScreen2.tsx');
assert.match(splash, /resolveColdStartDestination/);
assert.match(splash, /mediaCacheReady/);
assert.match(splash, /consumeProcessStart\(\)/);
assert.match(splash, /resolvePostAuthDestination/);
assert.match(splash, /loadRecoveryState\(\) \|\| recoveryRestart/);
assert.match(splash, /enterSignedOutAt\(\{ name: 'GuestTabs' \}\)/);
assert.ok(
  splash.indexOf('resolveColdStartDestination') <
    splash.indexOf("name: 'GuestTabs'"),
);

const route = read('src/lib/coldStartRoute.ts');
const sessionGate = route.indexOf('input.session && !input.apiUser');
const pendingGate = route.indexOf('input.pendingEmail && input.pendingResumable');
const welcomeGate = route.indexOf("return { kind: 'welcome' }");
assert.ok(sessionGate !== -1 && pendingGate !== -1 && welcomeGate !== -1);
assert.ok(sessionGate < pendingGate && pendingGate < welcomeGate);

const navigator = read('src/navigation/RootNavigator.tsx');
assert.match(navigator, /hasConsumedProcessStart/);
assert.match(navigator, /: 'Splash1'/);
assert.match(navigator, /MediaHoldScreen/);

const signIn = read('src/screens/auth/SignInScreen.tsx');
assert.match(signIn, /showsProfileRetry/);
assert.match(signIn, /Retry profile load/);
assert.match(signIn, /bootstrapSession/);

const app = read('App.tsx');
assert.match(app, /NavigationContainer/);
assert.match(app, /AuthTransitionOverlay/);
assert.match(app, /const \[fontsLoaded, fontError\] = useFonts/);
assert.match(app, /fontsLoaded \|\| fontError != null/);
assert.match(app, /SplashScreen\.hideAsync\(\)/);
assert.match(app, /SplashScreen\.preventAutoHideAsync\(\)/);

const profile = read('src/context/ProfileContext.tsx');
assert.match(profile, /shouldIgnoreStaleIdentityResult/);
assert.match(profile, /boundUser\.current !== userId/);
assert.match(profile, /epochRef\.current \+= 1/);
assert.match(profile, /shownContent/);
assert.match(profile, /next\.id !== userIdRef\.current/);
assert.match(profile, /refreshed\.id !== startedUserId/);
assert.match(profile, /accessTokenRef\.current/);
assert.match(profile, /accessTokenSubject\(token\) !== startedUserId/);
assert.match(profile, /authApi\.updateMe\(payload, token\)/);
assert.match(profile, /refreshMe\(token\)/);
const refreshBody = auth.slice(
  auth.indexOf('const refreshMe = useCallback'),
  auth.indexOf('const signInWithEmail = useCallback'),
);
assert.match(refreshBody, /authApi\.getMe\(accessToken\)/);
assert.match(refreshBody, /shouldIgnoreStaleAuthResult/);
const getMeAt = refreshBody.indexOf('authApi.getMe(accessToken)');
const guardAt = refreshBody.indexOf('shouldIgnoreStaleAuthResult');
const applyAt = refreshBody.indexOf('applyApiUser(user)');
assert.equal(getMeAt > 0 && guardAt > getMeAt && applyAt > guardAt, true);
assert.match(profile, /portfolioApi\.listMine\(token\)/);
assert.match(profile, /servicesApi\.listMine\(token\)/);
assert.match(profile, /portfolioApi\.create\(/);
assert.match(profile, /servicesApi\.update\(serviceId, input, token\)/);

const notifications = read('src/context/NotificationsContext.tsx');
assert.match(notifications, /shouldIgnoreStaleIdentityResult/);
assert.match(notifications, /boundUser\.current !== userId/);
assert.match(notifications, /shownNotifications/);
assert.equal(notifications.includes('nextCursor'), false);
assert.match(notifications, /accessTokenRef\.current/);
assert.match(notifications, /accessTokenSubject\(token\) !== startedUserId/);
assert.match(notifications, /notificationService\.list\(token\)/);
assert.match(notifications, /notificationService\.unreadCount\(token\)/);
assert.match(notifications, /notificationService\.markRead\(id, token\)/);
assert.match(notifications, /notificationService\.markAllRead\(token\)/);
const notificationService = read('src/services/notificationService.ts');
assert.match(notificationService, /notificationsApi\.list\(accessToken\)/);
assert.match(notificationService, /notificationsApi\.markRead\(id, accessToken\)/);
assert.match(notificationService, /notificationsApi\.markAllRead\(accessToken\)/);
assert.match(notificationService, /notificationsApi\.unreadSummary\(accessToken\)/);
const apiClient = read('src/lib/apiClient.ts');
assert.equal(apiClient.includes('getSession()'), false);
assert.match(apiClient, /registerAuthRequestRuntime/);
assert.match(apiClient, /capturePrincipal/);
assert.equal(apiClient.includes('resolveAccessToken'), false);
assert.ok(
  notifications.indexOf('shouldIgnoreStaleIdentityResult') <
    notifications.indexOf('setNotifications(items)'),
);

console.log('startup-safety-selftest ok');
