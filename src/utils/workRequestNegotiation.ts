import type { ApiWorkRequest } from '../services/workRequestApi';

/** Negotiation actions available on an open work request (pre–Pending Payment). */
export type NegotiationAction =
  | 'accept'
  | 'accept_original_terms'
  | 'accept_changes'
  | 'request_changes'
  | 'request_changes_again'
  | 'decline_changes'
  | 'reject_request';

export type NegotiationDecisionMaker = 'sender' | 'recipient' | null;

/** Secondary actions shown only in the header ⋯ overflow menu. */
export type OverflowMenuAction =
  | 'withdraw_change_request'
  | 'cancel_request'
  | 'report';

export interface NegotiationTurn {
  /** Whose turn it is to negotiate (null when terminal / past negotiation). */
  decisionMaker: NegotiationDecisionMaker;
  /** Viewer is the negotiation decision maker. */
  isMyTurn: boolean;
  /** Ordered primary negotiation actions for the footer (never Cancel Request). */
  actions: NegotiationAction[];
  /** Shown when the viewer has no negotiation actions and is waiting. */
  waitingMessage: string | null;
}

export interface WorkRequestOverflowMenu {
  /** Header ⋯ is available for either party on this request. */
  visible: boolean;
  /** Ordered secondary / destructive actions for the overflow sheet. */
  items: OverflowMenuAction[];
}

const ACTION_LABEL: Record<NegotiationAction, string> = {
  accept: 'Accept',
  accept_original_terms: 'Accept Original Terms',
  accept_changes: 'Accept Changes',
  request_changes: 'Request Changes',
  request_changes_again: 'Request Changes Again',
  decline_changes: 'Decline Changes',
  reject_request: 'Reject Request',
};

const OVERFLOW_LABEL: Record<OverflowMenuAction, string> = {
  withdraw_change_request: 'Withdraw Change Request',
  cancel_request: 'Cancel Request',
  report: 'Report',
};

export function negotiationActionLabel(action: NegotiationAction): string {
  return ACTION_LABEL[action];
}

export function overflowMenuActionLabel(action: OverflowMenuAction): string {
  return OVERFLOW_LABEL[action];
}

/**
 * Single source of truth for turn-based negotiation ownership and footer actions.
 * Derived from status + sender/recipient — no separate turn field required.
 * Cancel Request / Withdraw / Report live in {@link getWorkRequestOverflowMenu}.
 */
export function getNegotiationTurn(
  request: Pick<
    ApiWorkRequest,
    'status' | 'senderUserId' | 'recipientUserId' | 'source'
  >,
  viewerId: string,
  options?: {
    /**
     * Job-posting requests only: the listing owner has selected this applicant.
     * Only then may the applicant (sender) accept the work.
     */
    applicantSelected?: boolean;
  },
): NegotiationTurn {
  const isSender = request.senderUserId === viewerId;
  const isRecipient = request.recipientUserId === viewerId;
  const jobPosting = request.source === 'job_posting';
  const selected = options?.applicantSelected === true;
  const open =
    request.status === 'pending' ||
    request.status === 'changes_requested' ||
    request.status === 'changes_declined';

  let decisionMaker: NegotiationDecisionMaker = null;
  if (request.status === 'pending' || request.status === 'changes_declined') {
    decisionMaker = 'recipient';
  } else if (request.status === 'changes_requested') {
    decisionMaker = 'sender';
  }

  let isMyTurn =
    decisionMaker === 'sender'
      ? isSender
      : decisionMaker === 'recipient'
        ? isRecipient
        : false;

  let actions: NegotiationAction[] = [];
  if (isMyTurn && request.status === 'pending' && isRecipient) {
    // Job postings: the owner SELECTS an applicant; the applicant accepts.
    actions = jobPosting
      ? ['request_changes', 'reject_request']
      : ['accept', 'request_changes', 'reject_request'];
  } else if (isMyTurn && request.status === 'changes_requested' && isSender) {
    actions =
      jobPosting && !selected
        ? ['decline_changes']
        : ['accept_changes', 'decline_changes'];
  } else if (isMyTurn && request.status === 'changes_declined' && isRecipient) {
    actions = jobPosting
      ? ['request_changes_again', 'reject_request']
      : ['accept_original_terms', 'request_changes_again', 'reject_request'];
  } else if (
    jobPosting &&
    selected &&
    isSender &&
    (request.status === 'pending' || request.status === 'changes_declined')
  ) {
    // Selected applicant accepts the original terms.
    actions = [
      request.status === 'pending' ? 'accept' : 'accept_original_terms',
    ];
    isMyTurn = true;
  }

  let waitingMessage: string | null = null;
  if (open && !isMyTurn) {
    if (jobPosting && isSender && !selected) {
      waitingMessage = 'Waiting for the listing owner to select you.';
    } else {
      waitingMessage =
        request.status === 'changes_requested' && isRecipient
          ? 'Waiting for the requester to respond.'
          : 'Waiting for the other user to respond.';
    }
  }

  return {
    decisionMaker,
    isMyTurn,
    actions,
    waitingMessage,
  };
}

/**
 * Secondary / destructive actions for the header ⋯ menu.
 * Does not include primary negotiation buttons (those stay in the footer).
 */
export function getWorkRequestOverflowMenu(
  request: Pick<
    ApiWorkRequest,
    | 'status'
    | 'senderUserId'
    | 'recipientUserId'
    | 'proposedByUserId'
    | 'workEngagementStatus'
  >,
  viewerId: string,
): WorkRequestOverflowMenu {
  const isSender = request.senderUserId === viewerId;
  const isRecipient = request.recipientUserId === viewerId;
  if (!isSender && !isRecipient) {
    return { visible: false, items: [] };
  }

  const engagementStarted =
    request.workEngagementStatus === 'in_progress' ||
    request.workEngagementStatus === 'delivered' ||
    request.workEngagementStatus === 'disputed' ||
    request.workEngagementStatus === 'completed';

  const openNegotiation =
    request.status === 'pending' ||
    request.status === 'changes_requested' ||
    request.status === 'changes_declined';

  /** Cancel is allowed through Pending Payment; not after work starts. */
  const canCancelRequest =
    isSender &&
    !engagementStarted &&
    (openNegotiation || request.status === 'pending_payment');

  const items: OverflowMenuAction[] = [];

  if (openNegotiation) {
    const isWaitingProposer =
      request.status === 'changes_requested' &&
      isRecipient &&
      (!request.proposedByUserId || request.proposedByUserId === viewerId);

    if (isWaitingProposer) {
      items.push('withdraw_change_request');
    }
  }

  if (canCancelRequest) {
    items.push('cancel_request');
  }

  items.push('report');
  return { visible: true, items };
}
