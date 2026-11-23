/**
 * Temporary honesty copy for unfinished report and notification flows.
 * Source scan only. Does not replace scripts/truthfulness-selftest.mjs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const workRequest = read('src/screens/jobs/WorkRequestDetailScreen.tsx');
const postDetail = read('src/screens/home/PostDetailScreen.tsx');
const notifications = read('src/screens/onboarding/TurnOnNotificationsScreen.tsx');
const catalog = read('src/i18n/catalogs/authFlow.ts');
const successModal = read('src/components/ui/SuccessConfirmationModal.tsx');

const PRE_SUBMIT = 'sending this does not file a report yet.';
const COMPLETION_TITLE = 'Report not sent';
const COMPLETION_MESSAGE =
  'BETA — nothing was sent for review, and no one from Mawahib will contact you about it.';
const NOTIFICATIONS_COPY =
  'notifications are not turned on from this screen yet. Updates still appear in the app’s Notifications inbox.';

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start !== -1 && end !== -1, `missing slice ${startMarker}`);
  return source.slice(start, end);
}

function assertHonestReport(source, placeholder) {
  assert.equal(source.includes('Report Submitted'), false);
  assert.equal(source.includes('Our team has received'), false);
  assert.equal(source.includes('will review it'), false);
  assert.equal(source.includes('Successfully reported'), false);
  assert.equal(source.includes('Report captured'), false);
  assert.equal(source.includes(COMPLETION_TITLE), true);
  assert.equal(source.includes(COMPLETION_MESSAGE), true);
  assert.equal(source.includes(PRE_SUBMIT), true);
  assert.ok(source.indexOf(PRE_SUBMIT) < source.indexOf(placeholder));
  assert.equal(source.includes('Send Report'), true);
}

assertHonestReport(workRequest, 'Describe what happened...');
assert.equal(workRequest.includes("case 'report':"), true);
assert.equal(workRequest.includes('length < 10'), true);
assert.equal(workRequest.includes('title={successTitle}'), true);

const submitReport = between(
  workRequest,
  'const submitReport = async () => {',
  'const submitDeliveryNote',
);
assert.equal(submitReport.includes('setBusy'), false);
assert.equal(submitReport.includes('apiRequest'), false);
assert.equal(submitReport.includes('fetch('), false);
assert.equal(submitReport.includes('setReportSubmitting'), true);
assert.equal(submitReport.includes('Updating request'), false);

assert.equal(
  workRequest.includes("message={uploadingAttachment ? 'Uploading file…' : 'Updating request…'}"),
  true,
);

assertHonestReport(postDetail, 'Describe the issue...');
assert.equal(postDetail.includes('>Report<'), true);
assert.equal(postDetail.includes('const REPORT_MIN_CHARS = 10;'), true);

const submitComment = between(
  postDetail,
  'const submitCommentReport = useCallback(async () => {',
  'if (loading && !post)',
);
assert.equal(submitComment.includes('apiRequest'), false);
assert.equal(submitComment.includes('fetch('), false);
assert.equal(submitComment.includes('postsApi'), false);
assert.equal(submitComment.includes('reportBusyRef'), true);
assert.equal(submitComment.includes('/comments/:commentId/report'), true);

assert.equal(notifications.includes("t('auth.stayInLoop')"), true);
assert.equal(notifications.includes("t('auth.enableNotifications')"), true);
assert.equal(notifications.includes("t('auth.maybeLater')"), true);
assert.equal(catalog.includes(NOTIFICATIONS_COPY), true);
assert.equal(notifications.includes("t('auth.beta')"), true);
assert.equal(notifications.includes('>3<'), true);
assert.equal(
  notifications.split("navigation.navigate('SignupSuccess')").length - 1,
  2,
);
assert.ok(
  notifications.indexOf("t('auth.betaBody')") <
    notifications.indexOf("t('auth.enableNotifications')"),
);
assert.equal(notifications.includes('expo-notifications'), false);
assert.equal(notifications.includes('requestPermissions'), false);
assert.equal(notifications.includes('getExpoPushTokenAsync'), false);
assert.equal(notifications.includes('__DEV__'), false);

assert.equal(successModal.includes('Report not sent'), false);
assert.equal(successModal.includes('checkmark'), true);

assert.equal(workRequest.includes('__DEV__'), false);
assert.equal(postDetail.includes('__DEV__'), false);
assert.equal(workRequest.includes('UNIMPLEMENTED YET'), false);
assert.equal(postDetail.includes('UNIMPLEMENTED YET'), false);
assert.equal(notifications.includes('UNIMPLEMENTED YET'), false);

console.log('truthfulness-placeholders-selftest: ok');
