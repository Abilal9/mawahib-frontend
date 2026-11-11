/**
 * Disputed work keeps its engagement label. The request can stay pending payment.
 * Run: node --experimental-strip-types scripts/dispute-status-selftest.mjs
 */
import assert from 'node:assert/strict';

const status = await import('../src/utils/workStatusPresentation.ts');
const negotiation = await import('../src/utils/workRequestNegotiation.ts');

const disputed = status.workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'disputed',
  applicationStatus: 'accepted',
});
assert.equal(disputed.primaryLabel, 'Disputed');
assert.equal(disputed.primaryKind, 'engagement');
assert.equal(disputed.requestLabel, 'Pending Payment');
assert.equal(disputed.applicationLabel, 'Accepted');
assert.equal(disputed.showPay, false);
assert.equal(disputed.showDeliver, false);
assert.equal(disputed.showConfirm, true);
assert.equal(disputed.showDecline, false);

const delivered = status.workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'delivered',
});
assert.equal(delivered.primaryLabel, 'Delivered');
assert.equal(delivered.showPay, false);
assert.equal(delivered.showConfirm, true);
assert.equal(delivered.showDecline, true);

const working = status.workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'in_progress',
});
assert.equal(working.primaryLabel, 'In Progress');
assert.equal(working.showPay, false);
assert.equal(working.showDeliver, true);
assert.equal(working.showConfirm, false);

const unpaid = status.workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'pending_payment',
});
assert.equal(unpaid.primaryLabel, 'Pending Payment');
assert.equal(unpaid.requestLabel, null);
assert.equal(unpaid.showPay, true);

const menu = negotiation.getWorkRequestOverflowMenu({
  status: 'pending_payment',
  senderUserId: 'client',
  recipientUserId: 'provider',
  proposedByUserId: null,
  workEngagementStatus: 'disputed',
}, 'client');
assert.equal(menu.items.includes('cancel_request'), false);
assert.equal(menu.items.includes('report'), true);

const disputedAcceptance = status.deliveryAcceptanceCopy('disputed');
assert.equal(disputedAcceptance.button, 'Accept delivery');
assert.match(disputedAcceptance.message, /ends the dispute/);
assert.match(disputedAcceptance.message, /does not close the staff handling case/);
assert.doesNotMatch(disputedAcceptance.message, /refund|payout/i);
const deliveredAcceptance = status.deliveryAcceptanceCopy('delivered');
assert.equal(deliveredAcceptance.button, 'Confirm Delivery');
assert.equal(deliveredAcceptance.message, 'Are you sure the work has been delivered as agreed?');
assert.equal(
  status.providerDeliveryWaiting('disputed'),
  'Waiting for the client to accept the delivery and end the dispute.',
);

console.log('dispute-status-selftest: OK');
