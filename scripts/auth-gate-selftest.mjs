/**
 * Phase G: centralized Auth Gate sheet, requireAuth, Sign In / Create Account / Cancel.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const gate = read('src/context/AuthGateContext.tsx');
const sheet = read('src/components/auth/AuthGateSheet.tsx');
const app = read('App.tsx');

assert.match(gate, /export function AuthGateProvider/);
assert.match(gate, /requireAuth: \(request: AuthGateRequest\) => void/);
assert.match(gate, /isAuthenticatedProductActive\(\)/);
assert.match(gate, /stageReturnIntent\(request\)/);
assert.match(gate, /clearStagedReturnIntent\(\)/);
assert.match(gate, /persistStagedReturnIntent\(intent\)/);
assert.match(gate, /navigateSignedOut\('SignIn'\)/);
assert.match(gate, /navigateSignedOut\('Welcome', \{ step: 1 \}\)/);
assert.match(gate, /busyRef/);
assert.equal(gate.includes('user == null'), false);
assert.equal(gate.includes('!user'), false);
assert.equal(gate.includes('onSuccess'), false);
assert.equal(gate.includes('mutation'), false);
assert.equal(gate.includes('applyToListing'), false);

const requireAuthFn = gate.slice(
  gate.indexOf('const requireAuth = useCallback'),
  gate.indexOf('const cancel = useCallback'),
);
assert.match(requireAuthFn, /if \(isAuthenticatedProductActive\(\)\) return/);
assert.match(requireAuthFn, /if \(busyRef\.current\) return/);
assert.match(gate, /subscribeProductTree/);
assert.match(gate, /clearStagedReturnIntent\(\)/);

const cancelFn = gate.slice(
  gate.indexOf('const cancel = useCallback'),
  gate.indexOf('const releaseBusy'),
);
assert.match(cancelFn, /clearStagedReturnIntent\(\)/);
assert.equal(cancelFn.includes('persistStagedReturnIntent'), false);
assert.equal(cancelFn.includes('navigateSignedOut'), false);

assert.match(sheet, /Sign in to continue/);
assert.match(sheet, /title="Sign In"/);
assert.match(sheet, /title="Create Account"/);
assert.match(sheet, /title="Cancel"/);
assert.match(sheet, /manage your work and applications/);
assert.match(sheet, /Public job listings stay on Home and Explore/);
assert.match(sheet, /open your messages/);
assert.match(sheet, /chooseSignIn/);
assert.match(sheet, /chooseCreateAccount/);
assert.match(sheet, /cancel/);

assert.match(app, /AuthGateProvider/);
assert.match(app, /AuthGateSheet/);
assert.ok(
  app.indexOf('<AuthProvider>') < app.indexOf('<AuthGateProvider>'),
);
assert.ok(
  app.indexOf('<AuthGateProvider>') < app.indexOf('<AppProviders />'),
);
assert.ok(app.indexOf('<AuthGateSheet />') < app.indexOf('</AuthGateProvider>'));

const home = read('src/screens/home/HomeScreen.tsx');
assert.equal(home.includes('useAuthGate'), false);
assert.equal(home.includes('requireAuth'), false);
assert.match(home, /toggleLike/);
assert.match(home, /useSaved/);

const post = read('src/screens/home/PostDetailScreen.tsx');
assert.equal(post.includes('useAuthGate'), false);
assert.match(post, /toggleLike/);

console.log('auth-gate-selftest ok');
