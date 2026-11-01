/**
 * Phase E: signed-out / authenticated tree isolation and Guest tabs.
 * Source scan only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function screenNames(source) {
  return [...source.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
}

const signedOut = read('src/navigation/SignedOutNavigator.tsx');
const authenticated = read('src/navigation/AuthenticatedNavigator.tsx');
const guestTabs = read('src/navigation/GuestTabs.tsx');
const mainTabs = read('src/navigation/MainTabs.tsx');
const types = read('src/navigation/types.ts');
const rootNavigator = read('src/navigation/RootNavigator.tsx');
const app = read('App.tsx');
const splash = read('src/screens/onboarding/SplashScreen2.tsx');
const guestHome = read('src/screens/guest/GuestHomeScreen.tsx');
const guestExplore = read('src/screens/guest/GuestExploreScreen.tsx');
const guestAccount = read('src/screens/guest/GuestAccountScreen.tsx');
const guestCreate = read('src/components/layout/GuestCreateMenu.tsx');
const guestHeader = read('src/components/layout/GuestAppHeader.tsx');

const PRIVATE_ROUTES = [
  'Chat',
  'Saved',
  'Settings',
  'Notifications',
  'WorkRequestDetail',
  'ConfirmPayment',
  'ApplePay',
  'CardPayment',
  'Connections',
  'PostCreate',
  'PostJob',
  'EditProfile',
  'ChangePassword',
  'ArchivedConversations',
  'ConversationMedia',
];

const signedOutScreens = screenNames(signedOut);
const authenticatedScreens = screenNames(authenticated);
const guestTabScreens = screenNames(guestTabs);
const mainTabScreens = screenNames(mainTabs);

assert.deepEqual(guestTabScreens, [
  'HomeTab',
  'SearchTab',
  'CreateTab',
  'MessagesTab',
  'JobsTab',
]);
assert.equal(guestTabScreens.includes('AccountTab'), false);
assert.match(guestTabs, /onGatedTabPress/);
assert.match(guestTabs, /action: name === 'MessagesTab' \? 'messages' : 'jobs'/);
assert.match(guestTabs, /CreateTabPlaceholder/);
assert.equal(guestTabs.includes('MessagesInboxScreen'), false);
assert.equal(guestTabs.includes('UserJobs'), false);

assert.deepEqual(mainTabScreens, [
  'HomeTab',
  'SearchTab',
  'CreateTab',
  'MessagesTab',
  'JobsTab',
]);

for (const route of PRIVATE_ROUTES) {
  assert.equal(
    signedOutScreens.includes(route),
    false,
    `signed-out tree must not register ${route}`,
  );
  assert.equal(
    signedOut.includes(`name="${route}"`),
    false,
    `signed-out source must not mention ${route} as a screen`,
  );
}

assert.equal(signedOutScreens.includes('Chat'), false);
assert.equal(signedOutScreens.includes('Settings'), false);
assert.equal(signedOutScreens.includes('Saved'), false);
assert.equal(signedOutScreens.includes('Notifications'), false);
assert.equal(authenticatedScreens.includes('Chat'), true);
assert.equal(authenticatedScreens.includes('Settings'), true);
assert.equal(authenticatedScreens.includes('Saved'), true);
assert.equal(authenticatedScreens.includes('Notifications'), true);
assert.equal(authenticatedScreens.includes('MainTabs'), true);
assert.equal(authenticatedScreens.includes('WorkRequestDetail'), true);
assert.equal(authenticatedScreens.includes('ConfirmPayment'), true);
assert.equal(authenticatedScreens.includes('Connections'), true);

const signedOutTypeStart = types.indexOf(
  'export type SignedOutStackParamList',
);
const signedOutTypeEnd = types.indexOf('export type RootStackParamList');
assert.ok(signedOutTypeStart !== -1 && signedOutTypeEnd > signedOutTypeStart);
const signedOutTypes = types.slice(signedOutTypeStart, signedOutTypeEnd);
for (const route of ['Chat', 'Saved', 'Settings', 'Notifications', 'MainTabs']) {
  assert.equal(
    new RegExp(`(^|\\n)\\s+${route}:`, 'm').test(signedOutTypes),
    false,
    `SignedOutStackParamList must not declare ${route}`,
  );
}

assert.match(rootNavigator, /key=\{apiUser\.id\}/);
assert.match(authenticated, /key=\{`authenticated-\$\{userId\}`\}/);
assert.match(signedOut, /key="signed-out"/);
assert.equal(rootNavigator.includes('signed-out-recovery'), false);
assert.match(rootNavigator, /isAuthenticatedProductActive\(\)/);
assert.match(rootNavigator, /leaveAuthenticatedProduct\(\)/);
assert.match(rootNavigator, /hasSession=\{Boolean\(session \|\| apiUser\)\}/);
assert.match(rootNavigator, /key="app"/);
assert.match(rootNavigator, /key="media-hold"/);
assert.match(rootNavigator, /key="account-suspended"/);
assert.equal(rootNavigator.includes('NavigationContainer'), false);
assert.match(app, /<NavigationContainer/);
assert.match(app, /<\/NavigationContainer>/);
assert.equal(app.split('<NavigationContainer').length, 2);
assert.match(app, /AuthGateProvider/);
assert.match(app, /AuthGateSheet/);

assert.match(splash, /consumeProcessStart\(\)/);
assert.match(splash, /enterSignedOutAt\(\{ name: 'GuestTabs' \}\)/);
assert.equal(splash.includes('isGuestBrowsingEnabled'), false);
assert.ok(
  splash.indexOf('resolveColdStartDestination') <
    splash.indexOf("name: 'GuestTabs'"),
);

assert.equal(guestHome.includes('publicRequest'), false);
assert.equal(guestExplore.includes('publicRequest'), false);
assert.equal(guestExplore.includes('useSaved'), false);
assert.equal(guestExplore.includes('useConnections'), false);
assert.equal(guestExplore.includes('useMyProfile'), false);
assert.equal(guestCreate.includes("navigate('PostCreate')"), false);
assert.equal(guestCreate.includes("navigate('PostJob'"), false);
assert.equal(guestCreate.includes("navigate('PhotoCapture')"), false);
assert.match(guestCreate, /Sign in to create/);
assert.match(guestAccount, /navigate\('SignIn'\)/);
assert.match(guestAccount, /navigate\('Welcome'/);
assert.equal(guestAccount.includes("navigate('Settings')"), false);
assert.equal(guestHeader.includes('useMyProfile'), false);
assert.equal(guestHeader.includes('notifications-outline'), false);
assert.equal(guestHeader.includes('UserAvatar'), false);
assert.match(guestHeader, /GuestAccountEntry/);
assert.match(guestExplore, /GuestAccountEntry/);
assert.equal(guestExplore.includes('GuestAppHeader'), false);

assert.match(signedOut, /GuestUserProfileScreen/);
assert.equal(signedOut.includes('component={UserProfileScreen}'), false);
assert.equal(signedOut.includes('component={ServiceDetailScreen}'), false);
assert.equal(signedOut.includes('component={PostDetailScreen}'), false);
assert.equal(signedOut.includes('component={ReviewsScreen}'), false);
assert.equal(signedOut.includes('component={PortfolioProjectDetailScreen}'), false);
assert.equal(
  signedOut.includes('component={JobListingDetailScreen}'),
  false,
);
assert.equal(guestTabs.includes('AppSidebar'), false);
assert.equal(guestTabs.includes('CreateActionMenu'), false);
assert.match(guestTabs, /showUnreadIndicators=\{false\}/);
assert.match(guestTabs, /GuestCreateMenu/);

const productTree = read('src/lib/productTree.ts');
const leaveFn = productTree.slice(
  productTree.indexOf('export function leaveAuthenticatedProduct'),
  productTree.indexOf('export function enterSignedOutAt'),
);
assert.match(leaveFn, /consumeProcessStart\(\)/);
assert.match(leaveFn, /resetPrivateModuleCaches\(\)/);
const enterAuthFn = productTree.slice(
  productTree.indexOf('export function enterAuthenticatedProduct'),
  productTree.indexOf('export function leaveAuthenticatedProduct'),
);
assert.match(enterAuthFn, /resetPrivateModuleCaches\(\)/);

const postAuthNav = read('src/lib/postAuthNavigation.ts');
assert.ok(
  postAuthNav.indexOf('enterSignedOutAt') <
    postAuthNav.indexOf('navigation.reset'),
);

console.log('guest-navigation-selftest ok');
