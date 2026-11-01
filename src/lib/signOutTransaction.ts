/**
 * Typed in-flight sign-out transaction. Raw Supabase SIGNED_OUT is interpreted
 * through this latch. One active transaction. A duplicate is the same kind
 * and the same expected user. A different user or kind is a conflict.
 *
 * No local imports so Node selftests can execute this module.
 */

export type SignOutKind =
  | 'logout'
  | 'suspensionLogout'
  | 'hydrate401'
  | 'recoveryAbort'
  | 'sessionClearForRecovery'
  | 'recoveryComplete'
  | 'identityMismatch';

export type SignOutDestinationName =
  | 'GuestTabs'
  | 'SignIn'
  | 'ForgotPassword';

export type SignOutTransaction = {
  id: number;
  kind: SignOutKind;
  startedAt: number;
  expectedUserId?: string;
  destination: SignOutDestinationName;
  notice?: 'password-updated';
  status: 'started' | 'completed' | 'failed';
};

export type BeginSignOutResult =
  | { status: 'started'; txn: SignOutTransaction }
  | { status: 'duplicate'; txn: SignOutTransaction }
  | { status: 'conflict'; txn: SignOutTransaction };

export type SignedOutInterpretation = {
  reason: 'none' | 'logout' | 'expired' | 'guestChosen';
  destination: SignOutDestinationName;
  notice?: 'password-updated';
  apply: boolean;
};

let nextId = 1;
let active: SignOutTransaction | null = null;

export function destinationForSignOutKind(
  kind: SignOutKind,
): SignOutDestinationName {
  if (kind === 'sessionClearForRecovery') return 'ForgotPassword';
  if (
    kind === 'hydrate401' ||
    kind === 'recoveryAbort' ||
    kind === 'recoveryComplete' ||
    kind === 'identityMismatch'
  ) {
    return 'SignIn';
  }
  return 'GuestTabs';
}

export function beginSignOutTransaction(input: {
  kind: SignOutKind;
  expectedUserId?: string;
  now?: number;
}): BeginSignOutResult {
  if (active?.status === 'started') {
    const sameOwner = (active.expectedUserId ?? '') === (input.expectedUserId ?? '');
    if (active.kind === input.kind && sameOwner) {
      return { status: 'duplicate', txn: active };
    }
    return { status: 'conflict', txn: active };
  }
  const txn: SignOutTransaction = {
    id: nextId,
    kind: input.kind,
    startedAt: input.now ?? Date.now(),
    expectedUserId: input.expectedUserId,
    destination: destinationForSignOutKind(input.kind),
    notice: input.kind === 'recoveryComplete' ? 'password-updated' : undefined,
    status: 'started',
  };
  nextId += 1;
  active = txn;
  return { status: 'started', txn };
}

export function completeSignOutTransaction(id?: number): SignOutTransaction | null {
  if (!active || active.status !== 'started') return active;
  if (id != null && active.id !== id) return active;
  active = { ...active, status: 'completed' };
  return active;
}

export function failSignOutTransaction(id?: number): SignOutTransaction | null {
  if (!active || active.status !== 'started') return active;
  if (id != null && active.id !== id) return active;
  active = { ...active, status: 'failed' };
  return active;
}

export function clearSignOutTransaction(): void {
  active = null;
}

export function getActiveSignOutTransaction(): SignOutTransaction | null {
  return active;
}

export function interpretSignedOut(input: {
  hadAuthenticatedProduct: boolean;
  recoveryLocked: boolean;
  processStarted: boolean;
}): SignedOutInterpretation {
  const txn = active;
  if (txn && txn.status === 'started') {
    const reason: SignedOutInterpretation['reason'] =
      txn.kind === 'hydrate401'
        ? 'expired'
        : txn.kind === 'logout' || txn.kind === 'suspensionLogout'
          ? 'logout'
          : 'none';
    return {
      reason,
      destination: txn.destination,
      notice: txn.notice,
      apply: true,
    };
  }

  if (input.recoveryLocked) {
    return { reason: 'none', destination: 'SignIn', apply: false };
  }

  if (input.hadAuthenticatedProduct && input.processStarted) {
    return { reason: 'expired', destination: 'SignIn', apply: true };
  }

  return {
    reason: 'none',
    destination: 'GuestTabs',
    apply: false,
  };
}

export function resetSignOutTransactionForTests(): void {
  nextId = 1;
  active = null;
}
