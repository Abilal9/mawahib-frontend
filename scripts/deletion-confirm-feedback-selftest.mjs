import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/identityFences.ts';
import {
  classifyDeletionConfirmError,
  DELETION_UNCERTAIN_TITLE,
  DELETION_WAIT_TITLE,
} from '../src/lib/deletionConfirmFeedback.ts';

assert.equal(DELETION_WAIT_TITLE, 'Deleting your account…');
assert.equal(DELETION_UNCERTAIN_TITLE, "We couldn't confirm the result yet.");

assert.deepEqual(
  classifyDeletionConfirmError(new TypeError('Network request failed')),
  { kind: 'uncertain' },
);
assert.deepEqual(
  classifyDeletionConfirmError(new Error('The request timed out')),
  { kind: 'uncertain' },
);
assert.deepEqual(
  classifyDeletionConfirmError(new ApiError(504, 'Gateway timeout')),
  { kind: 'uncertain' },
);
assert.deepEqual(
  classifyDeletionConfirmError(new ApiError(401, 'This account is unavailable.', { code: 'ACCOUNT_UNAVAILABLE' })),
  { kind: 'already-closed' },
);
assert.deepEqual(
  classifyDeletionConfirmError(new ApiError(500, 'Internal server error')),
  { kind: 'failed', message: 'Internal server error', recovery: 'retry-same-key' },
);
assert.deepEqual(
  classifyDeletionConfirmError(new ApiError(409, 'Deletion cannot proceed.', { code: 'DELETION_BLOCKED' })),
  { kind: 'failed', message: 'Deletion cannot proceed.', recovery: 'refresh-status' },
);

console.log('deletion-confirm-feedback-selftest ok');
