const REQUEST_LABEL: Record<string, string> = {
  pending: 'Pending',
  changes_requested: 'Changes Requested',
  changes_declined: 'Changes Declined',
  pending_payment: 'Pending Payment',
  rejected: 'Rejected',
  withdrawn: 'Cancelled',
};

const APPLICATION_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const ENGAGEMENT_LABEL: Record<string, string> = {
  payment_failed: 'Payment Failed',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  disputed: 'Disputed',
  completed: 'Completed',
};

const TONE: Record<string, { bg: string; text: string }> = {
  'Pending Payment': { bg: '#E0ECFF', text: '#2E6AC5' },
  'Payment Failed': { bg: '#FEE2E2', text: '#B91C1C' },
  'In Progress': { bg: '#DBEAFE', text: '#1D4ED8' },
  Delivered: { bg: '#DBEAFE', text: '#1D4ED8' },
  Disputed: { bg: '#FFEDD5', text: '#C2410C' },
  Completed: { bg: '#DCFCE7', text: '#15803D' },
  Pending: { bg: '#FCE7F3', text: '#BE185D' },
  'Changes Requested': { bg: '#FEF9C3', text: '#8A6A16' },
  'Changes Declined': { bg: '#FFEDD5', text: '#C2410C' },
  Rejected: { bg: '#FEE2E2', text: '#B91C1C' },
  Cancelled: { bg: '#EEF2F6', text: '#627D98' },
};

export type WorkStatusPresentation = {
  primaryLabel: string;
  primaryKind: 'engagement' | 'request';
  tone: { bg: string; text: string };
  requestLabel: string | null;
  applicationLabel: string | null;
  showPay: boolean;
  showDeliver: boolean;
  showConfirm: boolean;
  showDecline: boolean;
};

/**
 * The work-request status stays at pending payment after acceptance.
 * Once an engagement has moved on, that engagement status is the main label.
 */
export function workStatusPresentation(input: {
  requestStatus: string;
  engagementStatus: string | null;
  applicationStatus?: string | null;
}): WorkStatusPresentation {
  const engagementLabel = input.engagementStatus
    ? ENGAGEMENT_LABEL[input.engagementStatus] ?? null
    : null;
  const requestLabel = REQUEST_LABEL[input.requestStatus] ?? input.requestStatus;
  const primaryLabel = engagementLabel ?? requestLabel;
  const awaitingPayment =
    input.requestStatus === 'pending_payment' &&
    (input.engagementStatus === 'pending_payment' || input.engagementStatus == null);
  return {
    primaryLabel,
    primaryKind: engagementLabel ? 'engagement' : 'request',
    tone: TONE[primaryLabel] ?? { bg: '#EEF2F6', text: '#627D98' },
    requestLabel: engagementLabel && requestLabel !== engagementLabel ? requestLabel : null,
    applicationLabel: input.applicationStatus
      ? APPLICATION_LABEL[input.applicationStatus] ?? null
      : null,
    showPay: awaitingPayment,
    showDeliver: input.engagementStatus === 'in_progress',
    showConfirm:
      input.engagementStatus === 'delivered' || input.engagementStatus === 'disputed',
    showDecline: input.engagementStatus === 'delivered',
  };
}
