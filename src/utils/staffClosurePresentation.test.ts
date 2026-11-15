import { isSuccessfulCompletion } from '../data/types/userJobs.ts';
import { getWorkRequestOverflowMenu } from './workRequestNegotiation.ts';
import { canRequestMawahibReview, retainsClosedWorkRecords, workStatusPresentation } from './workStatusPresentation.ts';

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const request = {
  status: 'pending_payment' as const,
  senderUserId: 'sender',
  recipientUserId: 'recipient',
  proposedByUserId: null,
  workEngagementStatus: 'pending_payment' as const,
};

const unpaid = getWorkRequestOverflowMenu(request, 'sender');
check(unpaid.items.includes('cancel_request'), 'unpaid accepted work can still be cancelled');

const closed = getWorkRequestOverflowMenu(
  { ...request, workEngagementStatus: 'cancelled' },
  'recipient',
);
check(!closed.items.includes('cancel_request'), 'staff-closed work does not offer cancel');

const presented = workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'cancelled',
  closedByMawahib: true,
});
check(presented.primaryLabel === 'Closed by Mawahib', 'staff closure label');
check(presented.tone.bg === '#EEF2F6' && presented.tone.text === '#627D98', 'staff closure color');
check(!presented.showPay && !presented.showDeliver && !presented.showConfirm && !presented.showDecline, 'no active actions');
check(retainsClosedWorkRecords({ engagementStatus: 'cancelled', closedByMawahib: true }), 'retained records');
check(!retainsClosedWorkRecords({ engagementStatus: 'cancelled' }), 'ordinary cancellation does not keep the paid-work view');

const ordinary = workStatusPresentation({
  requestStatus: 'withdrawn',
  engagementStatus: 'cancelled',
});
check(ordinary.primaryLabel === 'Cancelled', 'ordinary cancellation label');
check(!ordinary.showPay, 'ordinary cancellation is not payable');

check(isSuccessfulCompletion('completed'), 'acceptance counts as completion');
check(!isSuccessfulCompletion('cancelled'), 'staff closure is not successful completion');

const delivered = workStatusPresentation({
  requestStatus: 'pending_payment',
  engagementStatus: 'delivered',
});
check(delivered.showDecline, 'the client can still dispute a delivery');
check(delivered.showConfirm, 'the client can still accept a delivery');
check(
  !canRequestMawahibReview({ engagementStatus: 'in_progress', isClient: true }),
  'the client cannot escalate in-progress work',
);
check(
  !canRequestMawahibReview({ engagementStatus: 'in_progress', isClient: false }),
  'the provider cannot escalate in-progress work',
);
check(
  !canRequestMawahibReview({ engagementStatus: 'delivered', isClient: false }),
  'the provider cannot escalate a delivery',
);
check(
  !canRequestMawahibReview({ engagementStatus: 'delivered', isClient: true }),
  'delivery review is the existing dispute, not an escalation',
);

console.log('staff closure presentation checks passed');
