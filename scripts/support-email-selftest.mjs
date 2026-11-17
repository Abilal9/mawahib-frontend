import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copySupportEmail, openSupportEmail, SUPPORT_EMAIL, SUPPORT_MAILTO } from '../src/lib/supportEmail.ts';

assert.equal(SUPPORT_EMAIL, 'support@mawahib.io');
assert.equal(SUPPORT_MAILTO, 'mailto:support@mawahib.io');
assert.equal(SUPPORT_MAILTO.includes('?'), false);

const opened = [];
assert.equal(
  await openSupportEmail({
    openURL: async (url) => {
      opened.push(url);
    },
  }),
  'opened',
);
assert.deepEqual(opened, [SUPPORT_MAILTO]);

assert.equal(
  await openSupportEmail({
    openURL: async () => {
      throw new Error('Unable to open URL: mailto:support@mawahib.io');
    },
  }),
  'unavailable',
);

const copied = [];
assert.equal(
  await copySupportEmail({
    setString: async (value) => {
      copied.push(value);
    },
  }),
  'copied',
);
assert.deepEqual(copied, [SUPPORT_EMAIL]);

assert.equal(
  await copySupportEmail({
    setString: async () => {
      throw new Error('clipboard unavailable');
    },
  }),
  'copy-failed',
);
assert.equal(
  await copySupportEmail({
    setString: async () => false,
  }),
  'copy-failed',
);

const screen = readFileSync(new URL('../src/screens/profile/DeleteAccountScreen.tsx', import.meta.url), 'utf8');
const supportStart = screen.indexOf('async function contactSupport');
const supportEnd = screen.indexOf('export default function DeleteAccountScreen');
const supportFn = screen.slice(supportStart, supportEnd);
assert.ok(supportStart !== -1 && supportEnd > supportStart);
assert.match(supportFn, /openSupportEmail/);
assert.equal(supportFn.includes('confirmDeletion'), false);
assert.equal(supportFn.includes('cancelDeletionRequest'), false);
assert.equal(supportFn.includes('createDeletionRequest'), false);
assert.match(screen, /Copy email address/);
assert.equal(screen.includes('mailto:support@mawahib.io?'), false);

console.log('support-email-selftest ok');
