/**
 * Password recovery lock and change-password boundaries.
 * Source scan only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const deepLink = read('src/lib/authDeepLink.ts');
const listener = read('src/components/auth/AuthDeepLinkListener.tsx');
const auth = read('src/context/AuthContext.tsx');
const forgot = read('src/screens/auth/ForgotPasswordScreen.tsx');
const reset = read('src/screens/auth/ResetPasswordScreen.tsx');
const change = read('src/screens/auth/ChangePasswordScreen.tsx');
const splash = read('src/screens/onboarding/SplashScreen2.tsx');
const navigator = read('src/navigation/RootNavigator.tsx');
const signedOutNavigator = read('src/navigation/SignedOutNavigator.tsx');
const authenticatedNavigator = read('src/navigation/AuthenticatedNavigator.tsx');
const settings = read('src/screens/profile/SettingsScreen.tsx');
const recovery = read('src/lib/recoveryState.ts');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start !== -1 && end !== -1, `missing slice ${startMarker}`);
  return source.slice(start, end);
}

const recoveryRejectAt = deepLink.indexOf("callbackType(url) === 'recovery'");
const setSessionAt = deepLink.indexOf('supabase.auth.setSession');
const exchangeAt = deepLink.indexOf('supabase.auth.exchangeCodeForSession');
assert.ok(recoveryRejectAt !== -1 && recoveryRejectAt < setSessionAt);
assert.ok(recoveryRejectAt < exchangeAt);
assert.match(deepLink, /claims\.methods\.includes\('recovery'\)/);
assert.match(deepLink, /loadPendingSignup\(\)/);
assert.ok(deepLink.indexOf("claims.methods.includes('recovery')") < setSessionAt);
assert.ok(deepLink.indexOf('loadPendingSignup()') < setSessionAt);
assert.match(recovery, /storage read failure stays locked/);

const rejected = between(
  listener,
  "result.type === 'recovery-rejected'",
  "result.type === 'error'",
);
assert.equal(rejected.includes('resolvePostAuthDestination'), false);
assert.equal(rejected.includes('setSession'), false);
assert.equal(rejected.includes('exchangeCodeForSession'), false);
assert.match(listener, /if \(loadRecoveryState\(\)\) return/);

const hydrate = between(
  auth,
  'const hydrateBackendUser = useCallback',
  'useEffect(() => {',
);
assert.match(hydrate, /if \(loadRecoveryState\(\)\) return null/);
const recoveryEventAt = auth.indexOf("event === 'PASSWORD_RECOVERY'");
const signedInAt = auth.indexOf("event === 'SIGNED_IN'");
assert.ok(recoveryEventAt !== -1 && recoveryEventAt < signedInAt);
assert.match(auth, /if \(loadRecoveryState\(\)\) \{\s*return;\s*\}/);
assert.match(
  auth,
  /if \(loadRecoveryState\(\)\) \{\s*const discarded = await discardInterruptedRecovery\(\);/,
);

const mutation = read('src/lib/authSessionMutation.ts');
const recoveryRun = between(
  mutation,
  'export async function runRecoveryCompletion',
  'export async function runPasswordChange',
);
assert.ok(
  recoveryRun.indexOf('live.userId !== lock.userId') <
    recoveryRun.indexOf('updatePassword()'),
);
assert.ok(
  recoveryRun.indexOf('signOutGlobal()') <
    recoveryRun.indexOf('clearLockIfSame(lock)'),
);
assert.match(recoveryRun, /'sign-out-failed'/);
const resetFn = between(auth, 'const completePasswordReset', 'const changePassword');
assert.match(resetFn, /runRecoveryCompletion/);
assert.match(resetFn, /enqueueAuthMutation/);
assert.ok(
  resetFn.indexOf("scope: 'global'") < resetFn.indexOf('clearRecoveryState()'),
);

const passwordRun = between(
  mutation,
  'export async function runPasswordChange',
  'function refuseUserFacing',
);
assert.ok(
  passwordRun.indexOf('input.enqueue') <
    passwordRun.indexOf('input.signIn(original.email)'),
);
assert.ok(
  passwordRun.indexOf('sameOwnedSession(written, live)') <
    passwordRun.indexOf('updatePassword()'),
);
assert.ok(passwordRun.indexOf('updatePassword()') < passwordRun.indexOf('signOutOthers()'));
const changeFn = between(auth, 'const changePassword', 'const value = useMemo');
assert.ok(changeFn.indexOf('signInWithPassword') < changeFn.indexOf('updatePassword('));
assert.ok(changeFn.indexOf('updatePassword(') < changeFn.indexOf("scope: 'others'"));
assert.match(changeFn, /runPasswordChange/);
assert.match(changeFn, /updatePassword\(newPassword\)/);

const verifySignup = between(auth, 'const verifySignupOtp', 'const sendPhoneOtp');
assert.match(verifySignup, /type: 'email'/);
assert.equal(verifySignup.includes("type: 'recovery'"), false);

const logout = between(auth, 'const signOut = useCallback', 'const completePasswordReset');
assert.match(logout, /scope: 'local'/);
assert.equal(logout.includes("scope: 'global'"), false);

const verifyCode = between(forgot, 'const verifyCode', 'return (');
assert.ok(
  verifyCode.indexOf('armRecoveryVerification') < verifyCode.indexOf('verifyOtp'),
);
assert.match(verifyCode, /type: 'recovery'/);
assert.match(verifyCode, /code\.join\(''\)/);
assert.match(forgot, /OtpCodeInput/);
const otpInput = read('src/components/auth/OtpCodeInput.tsx');
const confirmCode = read('src/screens/auth/ConfirmCodeScreen.tsx');
assert.match(otpInput, /autoComplete="one-time-code"/);
assert.match(otpInput, /textContentType="oneTimeCode"/);
assert.match(otpInput, /digits\.length > 1/);
assert.match(confirmCode, /OtpCodeInput/);
assert.match(confirmCode, /verifySignupOtp/);
assert.equal(confirmCode.includes("type: 'recovery'"), false);
assert.equal(forgot.includes('redirectTo'), false);
assert.match(forgot, /resetPasswordForEmail/);
assert.match(forgot, /RECOVERY_REQUEST_COPY/);
assert.match(recovery, /If an account exists for that email/);
assert.match(recovery, /Unreadable recovery lock stays locked/);
assert.match(forgot, /verifyRef\.current \|\| sendRef\.current/);
assert.match(forgot, /releaseVerifyingLock/);
assert.match(auth, /suppressSameUserHydrateRef/);

assert.match(reset, /completePasswordReset/);
assert.match(reset, /PasswordRequirements/);
assert.match(splash, /loadRecoveryState\(\) \|\| recoveryRestart/);
assert.match(navigator, /recovery \|\| loadRecoveryState\(\)/);
assert.equal(navigator.includes('signed-out-recovery'), false);
assert.match(signedOutNavigator, /ForgotPassword/);
assert.match(signedOutNavigator, /ResetPassword/);
assert.match(authenticatedNavigator, /ChangePassword/);

assert.match(settings, /Change Password/);
assert.match(settings, /navigate\('ChangePassword'\)/);
assert.equal(/Forgot Password/i.test(settings), false);
assert.match(change, /changePassword\(currentPassword, password\)/);
assert.equal(change.includes('resetPasswordForEmail'), false);

for (const source of [forgot, reset, change, auth, recovery]) {
  assert.equal(source.includes('console.log'), false);
  assert.equal(source.includes('console.debug'), false);
}

console.log('password-recovery-selftest: ok');
