/**
 * Settings Phase A: honest shell, read-only account rows, local logout.
 * Source scan only. No network and no simulator.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const settings = read('src/screens/profile/SettingsScreen.tsx');
const sidebar = read('src/components/layout/AppSidebar.tsx');
const auth = read('src/context/AuthContext.tsx');
const prompt = read('src/components/auth/LocalSignOutConfirm.tsx');
const navigator = read('src/navigation/AuthenticatedNavigator.tsx');
const types = read('src/navigation/types.ts');
const confirm = read('src/components/ui/ConfirmActionModal.tsx');

assert.match(settings, /navigate\('EditProfile'\)/);
assert.match(settings, /navigate\('Calendar'\)/);
assert.match(settings, /Constants\.expoConfig\?\.version/);
assert.match(settings, /useLocalSignOutPrompt/);
assert.match(settings, /refreshMe\(\)/);
assert.match(settings, /emailVerified/);
assert.match(settings, /phoneVerified/);
assert.match(settings, /COUNTRY_CATALOG/);
assert.match(settings, /currencyForCountry/);
assert.match(settings, /Used for new jobs and services based on your profile country/);
assert.match(settings, /Existing work keeps its original currency/);
assert.match(settings, /Until then, new jobs and services use SAR/);
assert.match(settings, /label: 'Currency'/);
assert.match(settings, /checkmark-circle-outline/);
assert.match(settings, /alert-circle-outline/);
assert.match(settings, /colors\.success/);
assert.match(settings, /colors\.warning/);
assert.match(settings, /status: phone \? verificationState/);
assert.doesNotMatch(settings, /Email status|Phone status|Job & service currency|Direct requests/);
assert.doesNotMatch(settings, /New work/);
const hydrateApply = auth.indexOf('applyApiUser(user)');
const hydrateGuard = auth.slice(Math.max(0, hydrateApply - 700), hydrateApply);
assert.match(hydrateGuard, /isStale\(/);
const unauthorizedAt = auth.indexOf("err.status === 401");
const unauthorizedBody = auth.slice(Math.max(0, unauthorizedAt - 700), unauthorizedAt);
assert.match(unauthorizedBody, /if \(isStale\(liveToken\)\)/);
assert.match(unauthorizedBody, /supabase\.auth\.getSession\(\)/);
assert.match(auth, /TOKEN_REFRESHED/);
assert.match(auth, /hydrateSessionRef\.current = next/);
const guard = await import('../src/context/authSessionGuard.ts');
const sameSession = {
  epochAtStart: 1,
  epochNow: 1,
  requestToken: 'old',
  trackedToken: 'old',
  liveToken: 'old',
};
assert.equal(guard.shouldIgnoreStaleAuthResult(sameSession), false);
assert.equal(
  guard.shouldIgnoreStaleAuthResult({ ...sameSession, epochNow: 2 }),
  true,
);
assert.equal(
  guard.shouldIgnoreStaleAuthResult({ ...sameSession, trackedToken: 'new' }),
  true,
);
assert.equal(
  guard.shouldIgnoreStaleAuthResult({ ...sameSession, liveToken: 'refreshed' }),
  true,
  'a refreshed token must not be signed out by the old request',
);
assert.doesNotMatch(settings, /normalizeCurrencyCode/);
assert.doesNotMatch(settings, /Mawahib v1\.0\.0/);
assert.doesNotMatch(settings, /Coming soon/i);
assert.doesNotMatch(settings, /ChangeLanguage|Privacy & Security|Help Center|Send Feedback/);
assert.doesNotMatch(settings, /Language/);
assert.doesNotMatch(settings, /Premium|Switch|notificationsEnabled|updateMe|method:\s*'PATCH'/);
assert.doesNotMatch(settings, /Delete Account|Deactivate|Dark Mode|Payment Methods|Forgot Password/i);
assert.doesNotMatch(
  settings,
  /navigation\.reset\(\{\s*index:\s*0,\s*routes:\s*\[\{\s*name:\s*'SignIn'\s*\}\]\s*\}\)/,
);
assert.doesNotMatch(settings, /console\.(log|debug|info)/);

assert.match(sidebar, /useLocalSignOutPrompt/);
assert.match(sidebar, /SidebarCalendarPreview/);
assert.match(sidebar, /route: 'Settings'/);
assert.match(sidebar, /action: 'logout'/);
assert.match(sidebar, /label: 'Change Language'/);
assert.match(sidebar, /route: 'ChangeLanguage'/);
assert.match(sidebar, /trailing: 'العربية'/);
assert.match(sidebar, /Get Premium Features/);
assert.match(sidebar, /Upgrade Plan/);
assert.match(sidebar, /handleNavigate\('Premium'\)/);
assert.doesNotMatch(sidebar, /signOut\(\)/);
assert.doesNotMatch(
  sidebar,
  /navigation\.reset\(\{\s*index:\s*0,\s*routes:\s*\[\{\s*name:\s*'SignIn'\s*\}\]\s*\}\)/,
);

const signOutBody = auth.slice(
  auth.indexOf('const signOut = useCallback'),
  auth.indexOf('const value = useMemo'),
);
assert.match(signOutBody, /supabase\.auth\.signOut\(\{\s*scope:\s*'local'\s*\}\)/);
assert.match(signOutBody, /if \(error\)/);
assert.match(auth, /authEpoch\.current \+= 1/);
const refreshBody = auth.slice(
  auth.indexOf('const refreshMe = useCallback'),
  auth.indexOf('const signInWithEmail = useCallback'),
);
assert.match(refreshBody, /const epoch = authEpoch\.current/);
assert.match(refreshBody, /if \(epoch !== authEpoch\.current\) return user/);
const epochAt = refreshBody.indexOf('const epoch = authEpoch.current');
const getMeAt = refreshBody.indexOf('authApi.getMe(accessToken)');
const applyAt = refreshBody.indexOf('applyApiUser(user)');
assert.equal(epochAt > 0 && getMeAt > epochAt && applyAt > getMeAt, true);
const mutation = read('src/lib/authSessionMutation.ts');
const errorBranch = mutation.slice(
  mutation.indexOf('const signOutError = await input.signOutLocal()'),
  mutation.indexOf('flags.localSignOutDone = true;\n    input.applyOutcome(txnId);'),
);
const failureThrow = errorBranch.lastIndexOf('throw new Error(LOGOUT_FAILURE_MESSAGE)');
const applyBeforeThrow = errorBranch.lastIndexOf('input.applyOutcome', failureThrow);
assert.equal(
  failureThrow > applyBeforeThrow && applyBeforeThrow > 0,
  true,
  'failed local sign-out throws before a later apply',
);
assert.equal(
  errorBranch.slice(failureThrow).includes('input.applyOutcome'),
  false,
  'failed local sign-out does not clear auth',
);
assert.equal(/supabase\.auth\.signOut\(\s*\)/.test(auth), false);
assert.doesNotMatch(auth, /console\.(log|debug|info)/);

assert.match(prompt, /ConfirmActionModal/);
assert.match(prompt, /Are you sure you want to log out of this device\?/);
assert.match(prompt, /running\.current/);
assert.match(prompt, /await signOut\('logout'\)/);
const successAt = prompt.indexOf("await signOut('logout')");
const signedOutAt = prompt.indexOf('onSignedOutRef.current?.()');
const catchAt = prompt.indexOf('} catch {');
assert.equal(successAt > 0 && signedOutAt > successAt && catchAt > signedOutAt, true);
assert.doesNotMatch(prompt, /scope:\s*'global'/);

assert.match(confirm, /if \(busy\) return/);
assert.match(confirm, /loading=\{busy\}/);

assert.match(navigator, /ChangeLanguageScreen/);
assert.match(navigator, /PremiumScreen/);
assert.match(types, /ChangeLanguage:\s*undefined/);
assert.match(types, /Premium:\s*undefined/);
assert.match(types, /Settings:\s*undefined/);
assert.match(types, /Calendar:\s*undefined/);
assert.match(types, /EditProfile:/);

assert.equal(
  fs.existsSync(path.join(root, 'src/screens/profile/ChangeLanguageScreen.tsx')),
  true,
);
assert.equal(fs.existsSync(path.join(root, 'src/data/mock/languages.ts')), true);
assert.equal(
  fs.existsSync(path.join(root, 'src/screens/profile/PremiumScreen.tsx')),
  true,
  'Premium screen stays available from the sidebar',
);
assert.doesNotMatch(
  read('src/screens/profile/PremiumScreen.tsx'),
  /Verified badge/,
);

assert.match(read('src/utils/gregorianCivilDate.ts'), /October/);
assert.doesNotMatch(read('src/screens/profile/CalendarScreen.tsx'), /signOut|SettingsScreen/);

console.log('settings-phase-a-selftest: ok');
