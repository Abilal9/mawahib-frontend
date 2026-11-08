import assert from 'node:assert/strict';
import { compareNotifications, mergeNotificationPages } from '../src/lib/notificationInbox.ts';

const older = { id: 'a', createdAt: '2026-11-08T00:00:01.000Z', read: false };
const sameTimeLow = { id: 'b', createdAt: '2026-11-08T00:00:02.000Z', read: false };
const sameTimeHigh = { id: 'c', createdAt: '2026-11-08T00:00:02.000Z', read: true };

assert.deepEqual(
  [sameTimeLow, sameTimeHigh, older].sort(compareNotifications).map((item) => item.id),
  ['c', 'b', 'a'],
);

const merged = mergeNotificationPages(
  [older, { ...sameTimeLow, read: false }],
  [{ ...sameTimeHigh, read: true }, { ...sameTimeLow, read: true }],
);
assert.deepEqual(merged.map((item) => item.id), ['c', 'b', 'a']);
assert.equal(merged.find((item) => item.id === 'b')?.read, true);
assert.equal(merged.find((item) => item.id === 'a')?.read, false);

console.log('notification-inbox-selftest: ok');
