import assert from 'node:assert/strict';
import {
  categoryForApiType,
  notificationCategoryParam,
  uiTypeForApiType,
} from '../src/lib/notificationCategories.ts';
import {
  acceptNotificationResult,
  applyNotificationRefresh,
  mergeNotificationPages,
  notificationListPhase,
  notificationListQuery,
} from '../src/lib/notificationInbox.ts';

const expected = [
  ['engagement_status', 'job', 'Jobs'],
  ['work_request_event', 'job', 'Jobs'],
  ['message_received', 'message', 'Messages'],
  ['connection_request', 'follow', 'Connections'],
  ['connection_accepted', 'follow', 'Connections'],
  ['post_liked', 'like', 'Posts'],
  ['post_commented', 'comment', 'Posts'],
  ['system', 'system', 'Platform Updates'],
  ['legacy_row', 'system', 'Platform Updates'],
];

for (const [type, uiType, tab] of expected) {
  assert.equal(uiTypeForApiType(type), uiType);
  assert.equal(categoryForApiType(type), tab);
}

assert.equal(notificationCategoryParam('All'), null);
assert.equal(notificationCategoryParam('Jobs'), 'jobs');
assert.equal(notificationCategoryParam('Platform Updates'), 'platform_updates');

assert.deepEqual(
  notificationListQuery({ mode: 'refresh', category: 'jobs', cursor: 'older-page' }),
  { category: 'jobs' },
);
assert.deepEqual(
  notificationListQuery({ mode: 'more', category: 'jobs', cursor: 'older-page' }),
  { category: 'jobs', cursor: 'older-page' },
);

assert.equal(
  acceptNotificationResult({
    requestGeneration: 1,
    currentGeneration: 2,
    requestCategory: 'jobs',
    currentCategory: 'jobs',
    staleIdentity: false,
  }),
  false,
);
assert.equal(
  acceptNotificationResult({
    requestGeneration: 2,
    currentGeneration: 2,
    requestCategory: 'messages',
    currentCategory: 'jobs',
    staleIdentity: false,
  }),
  false,
);
assert.equal(
  acceptNotificationResult({
    requestGeneration: 2,
    currentGeneration: 2,
    requestCategory: 'jobs',
    currentCategory: 'jobs',
    staleIdentity: true,
  }),
  false,
);
assert.equal(
  acceptNotificationResult({
    requestGeneration: 2,
    currentGeneration: 2,
    requestCategory: 'jobs',
    currentCategory: 'jobs',
    staleIdentity: false,
  }),
  true,
);

const older = { id: 'job-old', createdAt: '2026-11-01T00:00:00.000Z' };
const newest = { id: 'job-new', createdAt: '2026-11-22T00:00:00.000Z' };
const refreshed = mergeNotificationPages([older, newest], [newest]);
assert.deepEqual(refreshed.map((item) => item.id), ['job-new', 'job-old']);

const arrived = { id: 'job-arrived', createdAt: '2026-11-23T00:00:00.000Z' };
const afterRefresh = applyNotificationRefresh([older, newest], {
  items: [arrived],
  nextCursor: 'after-arrived',
});
assert.deepEqual(afterRefresh.items.map((item) => item.id), ['job-arrived', 'job-new', 'job-old']);
assert.equal(afterRefresh.cursor, 'after-arrived');
assert.equal(afterRefresh.hasMore, true);
const complete = applyNotificationRefresh([older], { items: [newest], nextCursor: null });
assert.deepEqual(complete.items.map((item) => item.id), ['job-new']);
assert.equal(complete.hasMore, false);

assert.equal(notificationListPhase({ loading: true, failed: false, count: 0, hasMore: false }), 'loading');
assert.equal(notificationListPhase({ loading: false, failed: true, count: 0, hasMore: false }), 'error');
assert.equal(notificationListPhase({ loading: false, failed: false, count: 0, hasMore: false }), 'empty');
assert.equal(notificationListPhase({ loading: false, failed: false, count: 0, hasMore: true }), 'ready');
assert.equal(notificationListPhase({ loading: true, failed: false, count: 2, hasMore: true }), 'ready');

console.log('notification-category-selftest: ok');
