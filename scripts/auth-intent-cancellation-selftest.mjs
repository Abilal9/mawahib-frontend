/**
 * Internal auth-flow Back vs abandonment for return-intent cancellation.
 * Executes the production helper and asserts SignIn/Welcome/header wiring.
 * Run: node --no-warnings --experimental-strip-types scripts/auth-intent-cancellation-selftest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_FLOW_ROUTES,
  shouldInvalidateIntentOnAuthRemove,
} from '../src/lib/authIntentCancellation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const AUTH_STACK = [
  { name: 'GuestTabs' },
  { name: 'Welcome' },
  { name: 'AccountType' },
  { name: 'SignIn' },
];
const JOBS_STACK = [
  { name: 'GuestTabs' },
  { name: 'SignIn' },
];
const WELCOME_ROOT = [{ name: 'Welcome' }];
const SIGNIN_ON_SIGNUP = [
  { name: 'GuestTabs' },
  { name: 'Welcome' },
  { name: 'AccountType' },
  { name: 'SignUp' },
  { name: 'SignIn' },
];

assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: AUTH_STACK,
    index: 3,
  }),
  false,
  'Messages gate → SignIn → Back to Account Type preserves intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: SIGNIN_ON_SIGNUP,
    index: 4,
  }),
  false,
  'Jobs/signup → SignIn → Back to SignUp preserves intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: JOBS_STACK,
    index: 1,
  }),
  true,
  'Back from SignIn to GuestTabs abandons intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: [{ name: 'GuestTabs' }, { name: 'Welcome' }],
    index: 1,
  }),
  true,
  'Back from Welcome to GuestTabs abandons intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: WELCOME_ROOT,
    index: 0,
  }),
  true,
  'Back from Welcome root (negative target) abandons intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'POP',
    routes: AUTH_STACK,
    index: 3,
    count: 2,
  }),
  false,
  'POP(2) landing on Welcome preserves intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'POP',
    routes: AUTH_STACK,
    index: 3,
    count: 3,
  }),
  true,
  'POP(3) landing on GuestTabs invalidates',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'POP_TO_TOP',
    routes: AUTH_STACK,
    index: 3,
  }),
  true,
  'POP_TO_TOP onto GuestTabs invalidates',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'POP_TO_TOP',
    routes: [{ name: 'Welcome' }, { name: 'SignIn' }],
    index: 1,
  }),
  false,
  'POP_TO_TOP onto Welcome preserves intent',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'REPLACE',
    routes: AUTH_STACK,
    index: 3,
  }),
  false,
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'NAVIGATE',
    routes: AUTH_STACK,
    index: 3,
  }),
  false,
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'RESET',
    routes: AUTH_STACK,
    index: 3,
  }),
  false,
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'POP',
    routes: AUTH_STACK,
    index: 3,
  }),
  false,
  'POP without count defaults to 1',
);
assert.equal(
  shouldInvalidateIntentOnAuthRemove({
    actionType: 'GO_BACK',
    routes: [],
    index: 0,
  }),
  true,
  'malformed target invalidates',
);

for (const name of [
  'Welcome',
  'AccountType',
  'SignIn',
  'SignUp',
  'ConfirmCode',
  'VerifyAccount',
  'SignupSuccess',
  'TurnOnNotifications',
]) {
  assert.equal(AUTH_FLOW_ROUTES.has(name), true);
}

const signIn = read('src/screens/auth/SignInScreen.tsx');
assert.match(signIn, /shouldInvalidateIntentOnAuthRemove/);
assert.match(signIn, /POP_TO_TOP/);
assert.match(signIn, /invalidateReturnIntents/);
assert.match(signIn, /hasLiveUnappliedSession/);
assert.match(signIn, /shouldPreventOptionalAuthRemove/);

const welcome = read('src/screens/onboarding/WelcomeScreen.tsx');
assert.match(welcome, /shouldInvalidateIntentOnAuthRemove/);
assert.match(welcome, /invalidateReturnIntents/);
assert.match(welcome, /hasLiveUnappliedSession/);
assert.match(welcome, /shouldPreventOptionalAuthRemove/);
assert.match(welcome, /gestureEnabled: canDismiss/);

const header = read('src/components/layout/GuestAccountEntry.tsx');
assert.match(header, /invalidateReturnIntents\(\)/);
assert.equal(header.includes('clearStagedReturnIntent'), false);

const forgot = read('src/screens/auth/ForgotPasswordScreen.tsx');
assert.match(forgot, /invalidateReturnIntents\(\)/);

const productTree = read('src/lib/productTree.ts');
const enterAuthFn = productTree.slice(
  productTree.indexOf('export function enterAuthenticatedProduct'),
  productTree.indexOf('export function leaveAuthenticatedProduct'),
);
assert.match(enterAuthFn, /consumeReturnIntentRoutes\(\)/);
assert.equal(enterAuthFn.includes('invalidateReturnIntents'), false);

console.log('auth-intent-cancellation-selftest ok');
