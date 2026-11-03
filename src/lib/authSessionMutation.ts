/**
 * Session-mutation ordering for recovery completion, password change,
 * credential writes, and sign-out settlement.
 *
 * Callers that already hold enqueueAuthMutation must not call signOut(),
 * and this module does not enqueue from inside runSignOutAttempt or
 * finishCredentialEstablish. runPasswordChange and the recovery caller
 * enqueue once. Nested enqueue deadlocks the tail.
 *
 * Installed @supabase/auth-js persists a password sign-in and awaits
 * onAuthStateChange before that call's promise resolves. Rejecting
 * afterwards does not undo the write. A stale write is removed only when
 * the stored session id still belongs to that write.
 *
 * Recovery OTP is not a stale credential write. The lock is armed before
 * verifyOtp so an in-flight password sign-in can see it. verifyOtp is
 * the recovery session and must not pass through finishCredentialEstablish.
 *
 * Phone OTP remains unqueued. It is off unless the phone-auth flag is on.
 * Token refresh can rotate the same session and is not a different account.
 *
 * No local imports so Node selftests can execute this module. Callers pass
 * the real queue, transaction, and error constructors.
 */

export type SessionSignOutKind =
  | 'logout'
  | 'suspensionLogout'
  | 'hydrate401'
  | 'recoveryAbort'
  | 'sessionClearForRecovery'
  | 'recoveryComplete'
  | 'identityMismatch';

type ActiveTxn = {
  id: number;
  status: 'started' | 'completed' | 'failed';
  kind: SessionSignOutKind;
  expectedUserId?: string;
};

type SignOutBegin =
  | { status: 'started'; txn: ActiveTxn }
  | { status: 'duplicate'; txn: ActiveTxn }
  | { status: 'conflict'; txn: ActiveTxn };

type SignOutBoundary = {
  beginQueued: (input: {
    kind: SessionSignOutKind;
    expectedUserId?: string;
    generationAtCall: number;
    liveUserId: string | null;
    begin: (next: { kind: SessionSignOutKind; expectedUserId?: string }) => SignOutBegin;
  }) =>
    | SignOutBegin
    | { status: 'skipped-other-user' }
    | { status: 'superseded' };
  begin: (next: { kind: SessionSignOutKind; expectedUserId?: string }) => SignOutBegin;
  fail: (id: number) => void;
  clear: () => void;
  getActive: () => ActiveTxn | null;
  hasInflight: (key: string) => boolean;
  inflightKey: (kind: SessionSignOutKind, expectedUserId?: string | null) => string;
  localDecision: (input: {
    expectedUserId?: string | null;
    liveUserId?: string | null;
  }) => 'sign-out' | 'already-gone' | 'stale-other-user';
};

export const LOGOUT_FAILURE_MESSAGE =
  'Could not log out. You are still signed in on this device.';

export type OwnedSession = {
  userId: string;
  sessionId: string;
};

/**
 * Body for GoTrue PUT /user via auth-js updateUser.
 * Recovery omits current_password. A signed-in change includes it.
 * An empty current password is omitted so it is not sent as a blank field.
 */
export function passwordUpdateAttributes(
  password: string,
  currentPassword?: string,
): { password: string; current_password?: string } {
  if (currentPassword) {
    return { password, current_password: currentPassword };
  }
  return { password };
}

export type OtherSessionSignOutResult =
  | 'revoked'
  | 'unconfirmed'
  | 'account-changed'
  | 'session-missing'
  | 'unavailable'
  | 'superseded'
  | 'in-flight';

/** The first failure may offer one retry. A finished retry does not offer another. */
export function offersAnotherOtherDeviceRetry(
  phase: 'initial-failure' | 'retry-finished',
): boolean {
  return phase === 'initial-failure';
}

export function recoveryCleanupMessage(
  status: 'local-signed-out' | 'sign-out-failed',
): string {
  if (status === 'local-signed-out') {
    return 'This device is signed out. We could not confirm that your other devices were signed out.';
  }
  return 'Your password was changed. This device could not be signed out yet.';
}

let otherSessionSignOutInflight: Promise<OtherSessionSignOutResult> | null =
  null;

export function resetOtherSessionSignOutForTests(): void {
  otherSessionSignOutInflight = null;
}

/**
 * One deliberate signOut({ scope: 'others' }) for the account that just
 * changed its password. Does not update the password or sign in again.
 */
export async function runOtherSessionSignOut(input: {
  expectedUserId: string;
  expectedSessionId: string;
  generationAtCall: number;
  currentGeneration: () => number;
  readLive: () => Promise<OwnedSession | null>;
  recoveryLocked: () => boolean;
  signOutOthers: () => Promise<boolean>;
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>;
}): Promise<OtherSessionSignOutResult> {
  if (otherSessionSignOutInflight) return 'in-flight';
  const run = input.enqueue(async () => {
    try {
      if (input.recoveryLocked()) return 'unavailable' as const;
      if (input.generationAtCall !== input.currentGeneration()) {
        return 'superseded' as const;
      }
      const live = await input.readLive();
      if (!live?.userId || !live.sessionId) return 'session-missing' as const;
      if (live.userId !== input.expectedUserId) {
        return 'account-changed' as const;
      }
      // Refresh keeps this session id. Logout, login, or a later password
      // change replaces it and must not reuse this retry.
      if (live.sessionId !== input.expectedSessionId) {
        return 'superseded' as const;
      }
      let revoked = false;
      try {
        revoked = await input.signOutOthers();
      } catch {
        revoked = false;
      }
      if (!revoked) return 'unconfirmed' as const;
      if (input.generationAtCall !== input.currentGeneration()) {
        return 'superseded' as const;
      }
      const after = await input.readLive();
      if (!after?.userId || !after.sessionId) return 'session-missing' as const;
      if (after.userId !== input.expectedUserId) {
        return 'account-changed' as const;
      }
      if (after.sessionId !== input.expectedSessionId) {
        return 'superseded' as const;
      }
      return 'revoked' as const;
    } catch {
      return 'unconfirmed' as const;
    }
  });
  otherSessionSignOutInflight = run;
  try {
    return await run;
  } finally {
    if (otherSessionSignOutInflight === run) {
      otherSessionSignOutInflight = null;
    }
  }
}

export type RecoveryCompletionLock = {
  email: string;
  userId: string;
  phase: 'recovery-session';
};

export function readJwtSessionId(accessToken: string): string | null {
  try {
    const part = accessToken.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(globalThis.atob(padded)) as {
      session_id?: unknown;
    };
    return typeof parsed.session_id === 'string' && parsed.session_id.trim()
      ? parsed.session_id.trim()
      : null;
  } catch {
    return null;
  }
}

/** Stable id for one Supabase session. Access tokens rotate; session_id does not. */
export function ownedSession(input: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
}): OwnedSession | null {
  const sessionId =
    readJwtSessionId(input.accessToken) ??
    (input.refreshToken?.trim() ? input.refreshToken.trim() : null);
  if (!input.userId.trim() || !sessionId) return null;
  return { userId: input.userId.trim(), sessionId };
}

export function sameOwnedSession(
  left: OwnedSession | null | undefined,
  right: OwnedSession | null | undefined,
): boolean {
  return Boolean(
    left &&
      right &&
      left.userId === right.userId &&
      left.sessionId === right.sessionId,
  );
}

/** Expiry cleanup applies only for the generation that observed the dead session. */
export function shouldApplyHydrate401Expiry(
  generationAtStart: number,
  generationNow: number,
): boolean {
  return generationAtStart === generationNow;
}

export function isUserFacingSignOut(kind: SessionSignOutKind): boolean {
  return kind === 'logout' || kind === 'suspensionLogout';
}

/**
 * Remove the session a credential call just wrote, and only that session.
 * A different stored session is left untouched.
 */
export async function releaseOwnedCredentialSession(input: {
  written: OwnedSession;
  readLive: () => Promise<OwnedSession | null>;
  signOutLocal: () => Promise<void>;
}): Promise<'removed' | 'left'> {
  const live = await input.readLive();
  if (!sameOwnedSession(live, input.written)) return 'left';
  const again = await input.readLive();
  if (!sameOwnedSession(again, input.written)) return 'left';
  await input.signOutLocal();
  return 'removed';
}

/**
 * After a queued credential call has already persisted, either commit it
 * or drop that write because recovery is now armed.
 * Recovery verifyOtp must not use this.
 */
export async function finishCredentialEstablish(input: {
  recoveryLocked: boolean;
  hasSessionUser: boolean;
  written: OwnedSession | null;
  readLive: () => Promise<OwnedSession | null>;
  signOutLocal: () => Promise<void>;
  commit: () => void;
}): Promise<'committed' | 'removed' | 'left' | 'none'> {
  if (!input.recoveryLocked) {
    if (!input.hasSessionUser) return 'none';
    input.commit();
    return 'committed';
  }
  if (!input.written) return 'left';
  return releaseOwnedCredentialSession({
    written: input.written,
    readLive: input.readLive,
    signOutLocal: input.signOutLocal,
  });
}

function sameRecoveryLock(
  left: RecoveryCompletionLock | null,
  right: RecoveryCompletionLock,
): boolean {
  return Boolean(
    left &&
      left.phase === 'recovery-session' &&
      left.userId === right.userId &&
      left.email === right.email,
  );
}

/**
 * Password update and global revocation for the verified recovery account.
 * Runs inside the caller's queue slot. A mismatch does not sign anyone out.
 */
export async function runRecoveryCompletion(input: {
  readLock: () => RecoveryCompletionLock | null;
  readLive: () => Promise<
    (OwnedSession & { email: string }) | null
  >;
  updatePassword: () => Promise<void>;
  signOutGlobal: () => Promise<boolean>;
  signOutLocal: () => Promise<boolean>;
  prepareCache: () => Promise<boolean>;
  onSignedOut: () => void;
  /**
   * Called only when global sign-out failed and this device is no longer
   * in that recovery session. Removes the password-updated success notice.
   */
  clearSuccessNotice?: () => void;
  clearLockIfSame: (lock: RecoveryCompletionLock) => void;
  begin: SignOutBoundary['begin'];
  fail: SignOutBoundary['fail'];
  clear: SignOutBoundary['clear'];
  getActive: SignOutBoundary['getActive'];
  hasInflight: SignOutBoundary['hasInflight'];
  inflightKey: SignOutBoundary['inflightKey'];
}): Promise<
  'signed-out' | 'local-signed-out' | 'sign-out-failed' | 'rejected'
> {
  const lock = input.readLock();
  if (!lock?.userId || lock.phase !== 'recovery-session') return 'rejected';
  const live = await input.readLive();
  if (
    !live ||
    live.userId !== lock.userId ||
    live.email !== lock.email
  ) {
    return 'rejected';
  }
  const confirmed = await input.readLive();
  if (!sameOwnedSession(confirmed, live) || confirmed?.email !== lock.email) {
    return 'rejected';
  }
  let begun = input.begin({
    kind: 'recoveryComplete',
    expectedUserId: lock.userId,
  });
  if (begun.status !== 'started') {
    const staleKey = input.inflightKey(
      begun.txn.kind,
      begun.txn.expectedUserId,
    );
    if (input.hasInflight(staleKey)) return 'rejected';
    input.fail(begun.txn.id);
    input.clear();
    begun = input.begin({
      kind: 'recoveryComplete',
      expectedUserId: lock.userId,
    });
  }
  if (begun.status !== 'started') return 'rejected';
  const owned: OwnedSession = {
    userId: live.userId,
    sessionId: live.sessionId,
  };
  try {
    await input.updatePassword();
    const after = await input.readLive();
    if (!sameOwnedSession(after, owned) || after?.email !== lock.email) {
      input.fail(begun.txn.id);
      return 'rejected';
    }
    if (!sameRecoveryLock(input.readLock(), lock)) {
      input.fail(begun.txn.id);
      return 'rejected';
    }
    const ready = await input.prepareCache();
    if (!ready) {
      input.fail(begun.txn.id);
      return 'sign-out-failed';
    }
    const again = await input.readLive();
    if (!sameOwnedSession(again, owned) || again?.email !== lock.email) {
      input.fail(begun.txn.id);
      return 'rejected';
    }
    const globalFailed = await input.signOutGlobal();
    if (globalFailed) {
      const still = await input.readLive();
      if (still && !sameOwnedSession(still, owned)) {
        input.fail(begun.txn.id);
        return 'rejected';
      }
      if (still && sameOwnedSession(still, owned)) {
        try {
          await input.signOutLocal();
        } catch {
          // The read below decides whether this device still holds the session.
        }
        const afterLocal = await input.readLive();
        const gone = !afterLocal || !sameOwnedSession(afterLocal, owned);
        if (!gone) {
          input.fail(begun.txn.id);
          return 'sign-out-failed';
        }
      }
      const currentLock = input.readLock();
      if (currentLock && !sameRecoveryLock(currentLock, lock)) {
        if (input.getActive()?.id === begun.txn.id) input.fail(begun.txn.id);
        return 'rejected';
      }
      if (sameRecoveryLock(currentLock, lock)) {
        input.clearLockIfSame(lock);
      }
      const active = input.getActive();
      if (active?.id === begun.txn.id && active.status === 'started') {
        input.clearSuccessNotice?.();
        input.onSignedOut();
      }
      return 'local-signed-out';
    }
    const currentLock = input.readLock();
    if (currentLock && !sameRecoveryLock(currentLock, lock)) {
      if (input.getActive()?.id === begun.txn.id) input.fail(begun.txn.id);
      return 'rejected';
    }
    if (sameRecoveryLock(currentLock, lock)) {
      input.clearLockIfSame(lock);
    }
    const active = input.getActive();
    if (active?.id === begun.txn.id && active.status === 'started') {
      input.onSignedOut();
    }
    return 'signed-out';
  } catch (err) {
    if (input.getActive()?.id === begun.txn.id) {
      input.fail(begun.txn.id);
    }
    throw err;
  }
}

/**
 * Reauthentication and password update for the account that started the
 * change. Holds the auth queue so an explicit logout cannot be overwritten
 * by this call. A stored session this call did not write is not signed out.
 */
export async function runPasswordChange(input: {
  recoveryLocked: () => boolean;
  readLive: () => Promise<
    (OwnedSession & { email: string }) | null
  >;
  signIn: (email: string) => Promise<OwnedSession | null>;
  updatePassword: () => Promise<void>;
  signOutOthers: () => Promise<boolean>;
  signOutLocal: () => Promise<void>;
  suppressHydrate: (on: boolean) => void;
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>;
  raise: (message: string, code: 'unavailable' | 'identity') => never;
  currentGeneration?: () => number;
}): Promise<{
  otherSessionsRevoked: boolean;
  userId: string;
  sessionId: string;
  generation: number;
}> {
  if (input.recoveryLocked()) {
    input.raise(
      'Finish or cancel password reset before changing your password.',
      'unavailable',
    );
  }
  return input.enqueue(async () => {
    if (input.recoveryLocked()) {
      input.raise(
        'Finish or cancel password reset before changing your password.',
        'unavailable',
      );
    }
    const original = await input.readLive();
    if (!original?.email) {
      input.raise(
        'Sign in again before changing your password.',
        'unavailable',
      );
    }
    input.suppressHydrate(true);
    try {
      const written = await input.signIn(original.email);
      const live = await input.readLive();
      if (
        !written ||
        !live ||
        !sameOwnedSession(written, live) ||
        live.userId !== original.userId ||
        live.email !== original.email
      ) {
        if (written && live && sameOwnedSession(written, live)) {
          await input.signOutLocal();
        }
        input.raise(
          'Could not confirm this account. Sign in again.',
          'identity',
        );
      }
      await input.updatePassword();
      const after = await input.readLive();
      if (
        !after ||
        !sameOwnedSession(after, written) ||
        after.userId !== original.userId ||
        after.email !== original.email
      ) {
        input.raise(
          'Could not confirm this account. Sign in again.',
          'identity',
        );
      }
      return {
        otherSessionsRevoked: await input.signOutOthers(),
        userId: after.userId,
        sessionId: after.sessionId,
        generation: input.currentGeneration?.() ?? 0,
      };
    } finally {
      input.suppressHydrate(false);
    }
  });
}

function refuseUserFacing(input: {
  kind: SessionSignOutKind;
  onFailureNotice: (message: string) => void;
}): void {
  if (!isUserFacingSignOut(input.kind)) return;
  input.onFailureNotice(LOGOUT_FAILURE_MESSAGE);
  throw new Error(LOGOUT_FAILURE_MESSAGE);
}

/**
 * One sign-out attempt. The caller joins the in-flight map and enqueues.
 * An exception after begin cannot leave this attempt's transaction started.
 * Media is restored only when this attempt still owns the pause.
 * A local sign-out that already succeeded is reported as signed out.
 */
export async function runSignOutAttempt(input: {
  kind: SessionSignOutKind;
  expectedUserId?: string;
  /**
   * When set, a different stored session id is not signed out.
   * An empty string means the cleanup captured no session.
   */
  expectedSessionId?: string;
  generationAtCall: number;
  readLiveUserId: () => Promise<string | null>;
  readLiveSessionId?: () => Promise<string | null>;
  signOutLocal: () => Promise<boolean>;
  markCachePending: () => { ok: boolean };
  clearCache: () => Promise<void>;
  onInvalidate: () => void;
  onPause: (txnId: number) => void;
  onRestore: (txnId: number) => void;
  onFailureNotice: (message: string) => void;
  applyOutcome: (txnId: number) => void;
  boundary: SignOutBoundary;
}): Promise<void> {
  let liveUserId: string | null;
  try {
    liveUserId = await input.readLiveUserId();
  } catch (err) {
    if (isUserFacingSignOut(input.kind)) {
      input.onFailureNotice(LOGOUT_FAILURE_MESSAGE);
    }
    throw err;
  }
  let begun = input.boundary.beginQueued({
    kind: input.kind,
    expectedUserId: input.expectedUserId,
    generationAtCall: input.generationAtCall,
    liveUserId,
    begin: input.boundary.begin,
  });
  const stopWithoutSignOut = () => {
    if (input.expectedSessionId !== undefined) {
      throw new Error('SESSION_SUPERSEDED');
    }
    refuseUserFacing(input);
  };
  if (begun.status === 'superseded' || begun.status === 'skipped-other-user') {
    stopWithoutSignOut();
    return;
  }
  if (begun.status === 'duplicate') {
    input.boundary.fail(begun.txn.id);
    input.boundary.clear();
    input.onRestore(begun.txn.id);
    begun = input.boundary.beginQueued({
      kind: input.kind,
      expectedUserId: input.expectedUserId,
      generationAtCall: input.generationAtCall,
      liveUserId: await input.readLiveUserId(),
      begin: input.boundary.begin,
    });
  } else if (begun.status === 'conflict') {
    const otherKey = input.boundary.inflightKey(
      begun.txn.kind as SessionSignOutKind,
      begun.txn.expectedUserId,
    );
    if (input.boundary.hasInflight(otherKey)) {
      if (input.kind === 'identityMismatch') return;
      stopWithoutSignOut();
      return;
    }
    input.boundary.fail(begun.txn.id);
    input.boundary.clear();
    input.onRestore(begun.txn.id);
    begun = input.boundary.beginQueued({
      kind: input.kind,
      expectedUserId: input.expectedUserId,
      generationAtCall: input.generationAtCall,
      liveUserId: await input.readLiveUserId(),
      begin: input.boundary.begin,
    });
  }
  if (begun.status === 'superseded' || begun.status === 'skipped-other-user') {
    stopWithoutSignOut();
    return;
  }
  if (begun.status !== 'started') {
    if (input.kind === 'identityMismatch') return;
    stopWithoutSignOut();
    return;
  }
  const txnId = begun.txn.id;
  const flags = { localSignOutDone: false };
  try {
    const before = input.boundary.localDecision({
      expectedUserId: input.expectedUserId,
      liveUserId: await input.readLiveUserId(),
    });
    if (before === 'stale-other-user') {
      input.boundary.fail(txnId);
      input.boundary.clear();
      input.onRestore(txnId);
      if (input.expectedSessionId !== undefined) {
        throw new Error('SESSION_SUPERSEDED');
      }
      refuseUserFacing(input);
      return;
    }
    if (input.expectedSessionId !== undefined) {
      const liveSessionId = await input.readLiveSessionId?.();
      if (liveSessionId && liveSessionId !== input.expectedSessionId) {
        throw new Error('SESSION_SUPERSEDED');
      }
    }
    input.onInvalidate();
    input.onPause(txnId);
    const marked = input.markCachePending();
    if (!marked.ok) {
      try {
        await input.clearCache();
      } catch {
        input.boundary.fail(txnId);
        input.onRestore(txnId);
        input.onFailureNotice(LOGOUT_FAILURE_MESSAGE);
        throw new Error(LOGOUT_FAILURE_MESSAGE);
      }
    }
    const decision = input.boundary.localDecision({
      expectedUserId: input.expectedUserId,
      liveUserId: await input.readLiveUserId(),
    });
    if (decision === 'stale-other-user') {
      input.boundary.fail(txnId);
      input.boundary.clear();
      input.onRestore(txnId);
      if (input.expectedSessionId !== undefined) {
        throw new Error('SESSION_SUPERSEDED');
      }
      refuseUserFacing(input);
      return;
    }
    if (decision === 'already-gone') {
      flags.localSignOutDone = true;
      input.applyOutcome(txnId);
      return;
    }
    const signOutError = await input.signOutLocal();
    if (signOutError) {
      const afterError = input.boundary.localDecision({
        expectedUserId: input.expectedUserId,
        liveUserId: await input.readLiveUserId(),
      });
      if (afterError === 'already-gone') {
        flags.localSignOutDone = true;
        input.applyOutcome(txnId);
        return;
      }
      if (afterError === 'stale-other-user') {
        input.boundary.fail(txnId);
        input.boundary.clear();
        input.onRestore(txnId);
        if (input.expectedSessionId !== undefined) {
          throw new Error('SESSION_SUPERSEDED');
        }
        refuseUserFacing(input);
        return;
      }
      input.boundary.fail(txnId);
      input.onRestore(txnId);
      input.onFailureNotice(LOGOUT_FAILURE_MESSAGE);
      throw new Error(LOGOUT_FAILURE_MESSAGE);
    }
    flags.localSignOutDone = true;
    input.applyOutcome(txnId);
  } catch (err) {
    const active = input.boundary.getActive();
    if (active?.id === txnId && active.status === 'started') {
      if (flags.localSignOutDone) {
        input.applyOutcome(txnId);
        return;
      }
      input.boundary.fail(txnId);
      input.onRestore(txnId);
      if (isUserFacingSignOut(input.kind)) {
        input.onFailureNotice(LOGOUT_FAILURE_MESSAGE);
      }
    } else if (flags.localSignOutDone) {
      return;
    }
    throw err;
  }
}
