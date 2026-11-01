/**
 * Queued sign-out begin, credential-session commit, and apply-user gating.
 * AuthContext calls these helpers; tests execute this same module.
 *
 * No local imports so Node selftests can execute this module.
 *
 * Ownership starts inside the queue slot after the live-identity and
 * generation checks. A started transaction only suppresses apply for the
 * expected sign-out user.
 *
 * Nested enqueueAuthMutation from a queued slot deadlocks the tail.
 * Hydrate, SIGNED_IN, and cache work must not re-enter the queue.
 *
 * changePassword and recovery completion run on this same queue.
 * They must call supabase sign-out directly. Calling signOut() from inside
 * a slot deadlocks, because signOut() enqueues itself.
 */

export type SignOutSlotKind =
  | 'logout'
  | 'suspensionLogout'
  | 'hydrate401'
  | 'recoveryAbort'
  | 'sessionClearForRecovery'
  | 'recoveryComplete'
  | 'identityMismatch';

export type SignOutSlotTxn = {
  id: number;
  kind: SignOutSlotKind;
  expectedUserId?: string;
  status: 'started' | 'completed' | 'failed';
};

export type QueuedSignOutBegin =
  | { status: 'started'; txn: SignOutSlotTxn }
  | { status: 'duplicate'; txn: SignOutSlotTxn }
  | { status: 'conflict'; txn: SignOutSlotTxn }
  | { status: 'skipped-other-user' }
  | { status: 'superseded' };

let generation = 0;
const inflight = new Map<string, Promise<unknown>>();

export function getSessionGeneration(): number {
  return generation;
}

export function bumpSessionGeneration(): number {
  generation += 1;
  return generation;
}

export function signOutInflightKey(
  kind: SignOutSlotKind,
  expectedUserId?: string | null,
): string {
  return `${kind}:${expectedUserId ?? ''}`;
}

export function joinOrStartSignOut<T>(
  key: string,
  start: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = start().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export function decideSignOutSlot(input: {
  generationAtCall: number;
  currentGeneration: number;
  expectedUserId?: string | null;
  liveUserId?: string | null;
}): 'superseded' | 'skipped-other-user' | 'begin' {
  if (input.generationAtCall !== input.currentGeneration) {
    return 'superseded';
  }
  if (
    input.expectedUserId &&
    input.liveUserId &&
    input.expectedUserId !== input.liveUserId
  ) {
    return 'skipped-other-user';
  }
  return 'begin';
}

export function beginQueuedSignOutIfCurrent(input: {
  kind: SignOutSlotKind;
  expectedUserId?: string;
  generationAtCall: number;
  liveUserId: string | null;
  currentGeneration?: number;
  begin: (next: {
    kind: SignOutSlotKind;
    expectedUserId?: string;
  }) =>
    | { status: 'started'; txn: SignOutSlotTxn }
    | { status: 'duplicate'; txn: SignOutSlotTxn }
    | { status: 'conflict'; txn: SignOutSlotTxn };
}): QueuedSignOutBegin {
  const decision = decideSignOutSlot({
    generationAtCall: input.generationAtCall,
    currentGeneration: input.currentGeneration ?? generation,
    expectedUserId: input.expectedUserId,
    liveUserId: input.liveUserId,
  });
  if (decision === 'superseded') return { status: 'superseded' };
  if (decision === 'skipped-other-user') {
    return { status: 'skipped-other-user' };
  }
  return input.begin({
    kind: input.kind,
    expectedUserId: input.expectedUserId,
  });
}

export function applyApiUserAllowed(input: {
  txnStatus?: 'started' | 'completed' | 'failed' | null;
  expectedUserId?: string | null;
  incomingUserId: string;
  guestChosenInFlight: boolean;
  ignoreCallbackCommit: boolean;
}): boolean {
  if (input.guestChosenInFlight) return false;
  if (input.ignoreCallbackCommit) return false;
  if (input.txnStatus !== 'started') return true;
  if (!input.incomingUserId) return false;
  if (
    input.expectedUserId &&
    input.incomingUserId === input.expectedUserId
  ) {
    return false;
  }
  return true;
}

export function commitCredentialSession(input: {
  reason: 'none' | 'logout' | 'expired' | 'guestChosen';
  setReasonNone: () => void;
}): number {
  const next = bumpSessionGeneration();
  if (input.reason === 'logout' || input.reason === 'guestChosen') {
    input.setReasonNone();
  }
  return next;
}

export function resetSessionGenerationForTests(): void {
  generation = 0;
}

export function hasSignOutInflight(key: string): boolean {
  return inflight.has(key);
}

export function resetSignOutInflightForTests(): void {
  inflight.clear();
}
