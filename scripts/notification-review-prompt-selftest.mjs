import assert from 'node:assert/strict';
import {
  notificationShowsReviewPrompt,
  reviewPromptJob,
} from '../src/lib/notificationReviewPrompt.ts';

assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'system',
    engagementStatus: null,
    canSubmit: true,
  }),
  false,
  'a hide notice linked to work is not a review invitation',
);

assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'engagement_status',
    engagementStatus: 'completed',
    canSubmit: true,
  }),
  true,
);

assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'engagement_status',
    engagementStatus: 'completed',
    canSubmit: false,
  }),
  false,
  'an already submitted or hidden review does not invite another',
);

assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'engagement_status',
    engagementStatus: 'delivered',
    canSubmit: true,
  }),
  false,
);

assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'work_request_event',
    engagementStatus: 'completed',
    canSubmit: true,
  }),
  false,
);

const completedJob = { id: 'request-1', requestId: 'request-1', engagementId: 'engagement-1', canSubmit: true };
const hiddenJob = { id: 'request-2', requestId: 'request-2', engagementId: 'engagement-2', canSubmit: false };
assert.equal(
  reviewPromptJob({ engagementId: 'engagement-1', jobs: [completedJob, hiddenJob] })?.id,
  'request-1',
);
assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'engagement_status',
    engagementStatus: 'completed',
    canSubmit: reviewPromptJob({ engagementId: 'engagement-1', jobs: [completedJob] })?.canSubmit,
  }),
  true,
);
assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'system',
    engagementStatus: null,
    canSubmit: reviewPromptJob({ workRequestId: 'request-1', jobs: [completedJob] })?.canSubmit,
  }),
  false,
);
assert.equal(
  notificationShowsReviewPrompt({
    apiType: 'engagement_status',
    engagementStatus: 'completed',
    canSubmit: reviewPromptJob({ engagementId: 'engagement-2', jobs: [hiddenJob] })?.canSubmit,
  }),
  false,
);

console.log('notification-review-prompt-selftest: ok');
