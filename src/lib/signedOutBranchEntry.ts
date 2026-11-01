/**
 * Pure signed-out destination and optional-auth dismissal decisions.
 * No local imports so Node selftests can execute this module.
 */

export type SignedOutBranchReason = 'none' | 'logout' | 'expired' | 'guestChosen';

export type SignedOutBranchHandoff = {
  name: string;
  params?: object;
};

export type SignOutTxnSnapshot = {
  kind: string;
  status: 'started' | 'completed' | 'failed';
  destination: string;
} | null;

/**
 * A Guest Home landing is trusted after explicit logout / Continue as Guest
 * only when the rendered identity is empty or still the signed-out user.
 * A later account B must not inherit A's logout reason.
 */
export function isTrustedGuestLanding(input: {
  reason: SignedOutBranchReason;
  signedOutUserId: string | null;
  renderedUserId: string | null;
  recoveryLocked: boolean;
  txn?: SignOutTxnSnapshot;
}): boolean {
  if (input.recoveryLocked) return false;
  const reasonTrusted =
    input.reason === 'logout' || input.reason === 'guestChosen';
  const txnTrusted = Boolean(
    input.txn &&
      (input.txn.kind === 'logout' || input.txn.kind === 'suspensionLogout') &&
      (input.txn.status === 'started' || input.txn.status === 'completed') &&
      input.txn.destination === 'GuestTabs',
  );
  if (!reasonTrusted && !txnTrusted) return false;
  return (
    input.renderedUserId == null ||
    input.renderedUserId === input.signedOutUserId
  );
}

export function resolveSignedOutBranchEntry(input: {
  handoff: SignedOutBranchHandoff | null;
  recoveryLocked: boolean;
  hasSession: boolean;
  renderedUserId: string | null;
  productActive: boolean;
  reason: SignedOutBranchReason;
  signedOutUserId: string | null;
  wasAuthenticated?: boolean;
  txn?: SignOutTxnSnapshot;
}): SignedOutBranchHandoff {
  const handoff = input.handoff;

  if (input.recoveryLocked) {
    if (handoff && handoff.name !== 'GuestTabs') return handoff;
    return { name: 'SignIn' };
  }

  if (
    isTrustedGuestLanding({
      reason: input.reason,
      signedOutUserId: input.signedOutUserId,
      renderedUserId: input.renderedUserId,
      recoveryLocked: false,
      txn: input.txn ?? null,
    })
  ) {
    if (handoff && handoff.name !== 'GuestTabs') return handoff;
    return { name: 'GuestTabs' };
  }

  if (input.productActive || input.hasSession) {
    if (handoff && handoff.name !== 'GuestTabs') return handoff;
    return { name: 'SignIn' };
  }

  if (handoff) return handoff;

  if (input.reason === 'expired') {
    return { name: 'SignIn', params: { notice: 'session-expired' } };
  }
  if (input.wasAuthenticated && input.reason === 'none') {
    return { name: 'SignIn' };
  }
  return { name: 'GuestTabs' };
}

export function shouldApplySignOutOutcome(input: {
  expectedUserId?: string | null;
  liveUserId?: string | null;
}): boolean {
  if (!input.expectedUserId || !input.liveUserId) return true;
  return input.expectedUserId === input.liveUserId;
}

/**
 * Decide whether local supabase.auth.signOut may run against the live session.
 * A stale logout for A must not destroy B's already-established session.
 */
export function localSignOutDecision(input: {
  expectedUserId?: string | null;
  liveUserId?: string | null;
}): 'sign-out' | 'already-gone' | 'stale-other-user' {
  if (
    input.expectedUserId &&
    input.liveUserId &&
    input.expectedUserId !== input.liveUserId
  ) {
    return 'stale-other-user';
  }
  if (input.expectedUserId && !input.liveUserId) return 'already-gone';
  return 'sign-out';
}

export function shouldClearLogoutReasonForIncomingSession(input: {
  reason: SignedOutBranchReason;
  signedOutUserId: string | null;
  incomingUserId: string;
  establishment?: 'credential' | 'refresh' | 'restore';
}): boolean {
  if (input.reason !== 'logout' && input.reason !== 'guestChosen') return false;
  if (input.establishment === 'credential') return true;
  return input.incomingUserId !== input.signedOutUserId;
}

export function mainTabsGateLeaveAction(input: {
  authLoading: boolean;
  productActive: boolean;
  recoveryLocked: boolean;
  isSignedIn: boolean;
  hasVerifiedProfile: boolean;
}): 'none' | 'SignIn' {
  if (input.authLoading) return 'none';
  if (!input.productActive) return 'none';
  if (input.recoveryLocked) return 'SignIn';
  if (!input.isSignedIn) return 'SignIn';
  if (!input.hasVerifiedProfile) return 'SignIn';
  return 'none';
}

const OPTIONAL_AUTH_ROOT = 'GuestTabs';

const CREDENTIAL_READINESS_HOLD = new Set([
  'Welcome',
  'AccountType',
  'SignIn',
  'SignUp',
  'ConfirmCode',
  'VerifyAccount',
  'SignupSuccess',
  'TurnOnNotifications',
  'ForgotPassword',
  'ResetPassword',
]);

export function canDismissOptionalAuth(input: {
  recoveryLocked: boolean;
  reason: SignedOutBranchReason;
  routes: Array<{ name: string }>;
  index: number;
  hasLiveUnappliedSession?: boolean;
}): boolean {
  if (input.recoveryLocked) return false;
  if (input.reason === 'expired') return false;
  if (input.hasLiveUnappliedSession) return false;
  if (!Number.isFinite(input.index) || input.index <= 0) return false;
  return input.routes[0]?.name === OPTIONAL_AUTH_ROOT;
}

/** Hardware Back must not reveal Guest while login is in-flight or unapplied. */
export function shouldPreventOptionalAuthRemove(input: {
  loading?: boolean;
  recoveryLocked: boolean;
  reason: SignedOutBranchReason;
  hasLiveUnappliedSession?: boolean;
}): boolean {
  if (input.loading) return true;
  if (input.recoveryLocked) return true;
  if (input.reason === 'expired') return true;
  if (input.hasLiveUnappliedSession) return true;
  return false;
}

/**
 * After a credential session, Guest/public browsing must not remain the
 * visible tree while profile application is delayed or failed. Already-open
 * auth-flow screens keep their stack so in-flight Sign In is not remounted.
 */
export function shouldForceCredentialReadiness(input: {
  currentRoute?: string | null;
  hasSession: boolean;
  isSignedIn: boolean;
  recoveryLocked: boolean;
  reason: SignedOutBranchReason;
}): boolean {
  if (input.recoveryLocked || input.isSignedIn || !input.hasSession) {
    return false;
  }
  if (
    input.reason === 'logout' ||
    input.reason === 'guestChosen' ||
    input.reason === 'expired'
  ) {
    return false;
  }
  const route = input.currentRoute;
  if (!route) return true;
  if (CREDENTIAL_READINESS_HOLD.has(route)) return false;
  return true;
}
