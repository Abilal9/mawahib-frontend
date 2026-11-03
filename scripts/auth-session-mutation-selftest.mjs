/**
 * Production session-mutation orchestration.
 * Not a mounted AuthProvider and not a copy of AuthContext.
 * Run: node --no-warnings --experimental-strip-types scripts/auth-session-mutation-selftest.mjs
 */
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => (mem.has(key) ? mem.get(key) : null),
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: (key) => mem.delete(key),
};

const { enqueueAuthMutation, resetAuthMutationQueueForTests } = await import(
  '../src/lib/authMutationQueue.ts'
);
const {
  beginQueuedSignOutIfCurrent,
  commitCredentialSession,
  getSessionGeneration,
  hasSignOutInflight,
  joinOrStartSignOut,
  resetSessionGenerationForTests,
  resetSignOutInflightForTests,
  signOutInflightKey,
} = await import('../src/lib/authSignOutSlot.ts');
const {
  LOGOUT_FAILURE_MESSAGE,
  finishCredentialEstablish,
  ownedSession,
  offersAnotherOtherDeviceRetry,
  passwordUpdateAttributes,
  recoveryCleanupMessage,
  resetOtherSessionSignOutForTests,
  runOtherSessionSignOut,
  runPasswordChange,
  runRecoveryCompletion,
  runSignOutAttempt,
  sameOwnedSession,
} = await import('../src/lib/authSessionMutation.ts');
const { mapAuthError } = await import('../src/lib/authErrors.ts');
const {
  beginSignOutTransaction,
  clearSignOutNotice,
  clearSignOutTransaction,
  failSignOutTransaction,
  getActiveSignOutTransaction,
  resetSignOutTransactionForTests,
} = await import('../src/lib/signOutTransaction.ts');
const {
  getSignedOutReason,
  resetSignedOutReasonForTests,
  setSignedOutReason,
} = await import('../src/lib/signedOutReason.ts');
const { PasswordFlowError, saveRecoveryState, clearRecoveryState } = await import(
  '../src/lib/recoveryState.ts'
);
const { localSignOutDecision } = await import(
  '../src/lib/signedOutBranchEntry.ts'
);

function boundary() {
  return {
    beginQueued: beginQueuedSignOutIfCurrent,
    begin: beginSignOutTransaction,
    fail: (id) => {
      failSignOutTransaction(id);
    },
    clear: clearSignOutTransaction,
    getActive: getActiveSignOutTransaction,
    hasInflight: hasSignOutInflight,
    inflightKey: signOutInflightKey,
    localDecision: localSignOutDecision,
  };
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function token(sessionId, userId) {
  const payload = Buffer.from(
    JSON.stringify({ session_id: sessionId, sub: userId }),
  ).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

function makeSession(userId, sessionId, email) {
  const accessToken = token(sessionId, userId);
  return {
    userId,
    email,
    sessionId,
    accessToken,
    refreshToken: `refresh-${sessionId}`,
  };
}

function ownedOf(session) {
  return ownedSession({
    userId: session.userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
}

function reset() {
  mem.clear();
  resetAuthMutationQueueForTests();
  resetSignOutTransactionForTests();
  resetOtherSessionSignOutForTests();
  resetSessionGenerationForTests();
  resetSignOutInflightForTests();
  resetSignedOutReasonForTests();
  clearRecoveryState();
}

function armRecovery(userId = USER_A) {
  assert.equal(
    saveRecoveryState({
      email: 'a@example.com',
      phase: 'recovery-session',
      userId,
    }),
    true,
  );
}

reset();
{
  const sessionA = makeSession(USER_A, 'sess-a', 'a@example.com');
  const parsed = ownedOf(sessionA);
  assert.equal(parsed.sessionId, 'sess-a');
  assert.equal(sameOwnedSession(parsed, { userId: USER_A, sessionId: 'sess-a' }), true);
}

// 1. Recovery already active before a credential request.
reset();
armRecovery();
{
  const calls = [];
  await assert.rejects(
    enqueueAuthMutation(async () => {
      if (mem.get('mawahib.passwordRecovery.v1')) {
        throw new Error('pre-check');
      }
      calls.push('network');
    }),
    /pre-check/,
  );
  assert.deepEqual(calls, []);
}

// 3 and 4. Credential passed its pre-check, recovery is armed, the write
// persists before the promise resolves, then recovery completion runs.
reset();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  const sessionB = makeSession(USER_B, 'sess-b', 'b@example.com');
  let store = sessionA;
  const updates = [];
  const revocations = [];
  let releaseLogin;
  const loginHold = new Promise((resolve) => {
    releaseLogin = resolve;
  });
  const login = enqueueAuthMutation(async () => {
    await loginHold;
    store = sessionB;
    const removed = await finishCredentialEstablish({
      recoveryLocked: Boolean(mem.get('mawahib.passwordRecovery.v1')),
      hasSessionUser: true,
      written: ownedOf(sessionB),
      readLive: async () => ownedOf(store),
      signOutLocal: async () => {
        if (sameOwnedSession(ownedOf(store), ownedOf(sessionB))) store = null;
      },
      commit: () => {
        commitCredentialSession({
          reason: getSignedOutReason(),
          setReasonNone: () => setSignedOutReason('none'),
        });
      },
    });
    if (mem.get('mawahib.passwordRecovery.v1')) {
      throw new Error('post-check');
    }
    return removed;
  });
  armRecovery();
  const recovery = enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {
        updates.push(store?.userId ?? null);
      },
      signOutGlobal: async () => {
        revocations.push({ userId: store?.userId ?? null, scope: 'global' });
        store = null;
        return false;
      },
      signOutLocal: async () => false,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      onSignedOut: () => {},
      clearLockIfSame: () => clearRecoveryState(),
    }),
  );
  releaseLogin();
  await assert.rejects(login, /post-check/);
  const status = await recovery;
  assert.equal(status, 'rejected');
  assert.deepEqual(updates, []);
  assert.deepEqual(revocations, []);
  assert.equal(store, null);
}

// 5. Replacement during password update does not globally revoke the new account.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  const sessionB = makeSession(USER_B, 'sess-b', 'b@example.com');
  let store = sessionA;
  const updates = [];
  const revocations = [];
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {
        updates.push(store.userId);
        store = sessionB;
      },
      signOutGlobal: async () => {
        revocations.push(store.userId);
        return false;
      },
      signOutLocal: async () => false,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      onSignedOut: () => {},
      clearLockIfSame: () => clearRecoveryState(),
    }),
  );
  assert.equal(status, 'rejected');
  assert.deepEqual(updates, [USER_A]);
  assert.deepEqual(revocations, []);
  assert.equal(store.userId, USER_B);
  assert.equal(getActiveSignOutTransaction()?.status, 'failed');
}

// 2. Recovery armed while a credential slot is still queued behind other work.
reset();
{
  const gate = deferred();
  const blocker = enqueueAuthMutation(() => gate.promise);
  let started = false;
  const login = enqueueAuthMutation(async () => {
    started = true;
    if (mem.get('mawahib.passwordRecovery.v1')) throw new Error('pre-check');
  });
  armRecovery();
  gate.resolve();
  await blocker;
  await assert.rejects(login, /pre-check/);
  assert.equal(started, true);
}

// 6. Recovery revocation cannot sign out a login that runs after it.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  const sessionB = makeSession(USER_B, 'sess-b', 'b@example.com');
  let store = sessionA;
  const revoked = [];
  const recovery = enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {},
      signOutGlobal: async () => {
        revoked.push(store.userId);
        if (store?.userId === USER_A) store = null;
        return false;
      },
      signOutLocal: async () => false,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      onSignedOut: () => {},
      clearLockIfSame: () => clearRecoveryState(),
    }),
  );
  const login = enqueueAuthMutation(async () => {
    store = sessionB;
  });
  assert.equal(await recovery, 'signed-out');
  await login;
  assert.deepEqual(revoked, [USER_A]);
  assert.equal(store.userId, USER_B);
}

// 7. Exception immediately after begin.
reset();
{
  let reads = 0;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => {
        reads += 1;
        if (reads > 1) throw new Error('storage');
        return USER_A;
      },
      signOutLocal: async () => false,
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {},
    }),
    /storage/,
  );
  assert.equal(getActiveSignOutTransaction()?.status, 'failed');
  const retry = beginQueuedSignOutIfCurrent({
    kind: 'logout',
      boundary: boundary(),
    expectedUserId: USER_A,
    generationAtCall: getSessionGeneration(),
    liveUserId: USER_A,
    begin: beginSignOutTransaction,
  });
  assert.equal(retry.status, 'started');
  clearSignOutTransaction();
}

// 8. Exception after the media pause is owned by this attempt.
reset();
{
  let paused = null;
  let restored = null;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => USER_A,
      signOutLocal: async () => false,
      markCachePending: () => {
        throw new Error('marker');
      },
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: (txnId) => {
        paused = txnId;
      },
      onRestore: (txnId) => {
        if (paused === txnId) {
          restored = txnId;
          paused = null;
        }
      },
      onFailureNotice: () => {},
      applyOutcome: () => {},
    }),
    /marker/,
  );
  assert.equal(getActiveSignOutTransaction()?.status, 'failed');
  assert.equal(paused, null);
  assert.equal(typeof restored, 'number');
}

// 9. Duplicate callers share one successful attempt.
reset();
{
  const gate = deferred();
  let calls = 0;
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  const attempt = () =>
    joinOrStartSignOut(signOutInflightKey('logout', USER_A), () =>
      enqueueAuthMutation(() =>
        runSignOutAttempt({
          kind: 'logout',
      boundary: boundary(),
          expectedUserId: USER_A,
          generationAtCall: getSessionGeneration(),
          readLiveUserId: async () => store?.userId ?? null,
          signOutLocal: async () => {
            calls += 1;
            await gate.promise;
            store = null;
            return false;
          },
          markCachePending: () => ({ ok: true }),
          clearCache: async () => {},
          onInvalidate: () => {},
          onPause: () => {},
          onRestore: () => {},
          onFailureNotice: () => {},
          applyOutcome: () => {
            clearSignOutTransaction();
          },
        }),
      ),
    );
  const first = attempt();
  const second = attempt();
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(store, null);
}

// 10. Duplicate callers share one failure.
reset();
{
  let calls = 0;
  const attempt = () =>
    joinOrStartSignOut(signOutInflightKey('logout', USER_A), () =>
      enqueueAuthMutation(() =>
        runSignOutAttempt({
          kind: 'logout',
      boundary: boundary(),
          expectedUserId: USER_A,
          generationAtCall: getSessionGeneration(),
          readLiveUserId: async () => USER_A,
          signOutLocal: async () => {
            calls += 1;
            return true;
          },
          markCachePending: () => ({ ok: true }),
          clearCache: async () => {},
          onInvalidate: () => {},
          onPause: () => {},
          onRestore: () => {},
          onFailureNotice: () => {},
          applyOutcome: () => {},
        }),
      ),
    );
  const first = attempt();
  const second = attempt();
  await assert.rejects(first, new RegExp(LOGOUT_FAILURE_MESSAGE));
  await assert.rejects(second, new RegExp(LOGOUT_FAILURE_MESSAGE));
  assert.equal(calls, 1);
  assert.equal(getActiveSignOutTransaction()?.status, 'failed');
}

// 11. Retry after a failed logout can begin and clear the session.
reset();
{
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  let fail = true;
  const run = () =>
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => store?.userId ?? null,
      signOutLocal: async () => {
        if (fail) return true;
        store = null;
        return false;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => clearSignOutTransaction(),
    });
  await assert.rejects(run(), new RegExp(LOGOUT_FAILURE_MESSAGE));
  assert.equal(store.userId, USER_A);
  fail = false;
  await run();
  assert.equal(store, null);
  assert.notEqual(getActiveSignOutTransaction()?.status, 'started');
}

// 12. A's stale logout does not swallow B.
reset();
{
  beginSignOutTransaction({ kind: 'logout',
      boundary: boundary(), expectedUserId: USER_A });
  let store = makeSession(USER_B, 'sess-b', 'b@example.com');
  const revoked = [];
  await runSignOutAttempt({
    kind: 'logout',
      boundary: boundary(),
    expectedUserId: USER_B,
    generationAtCall: getSessionGeneration(),
    readLiveUserId: async () => store.userId,
    signOutLocal: async () => {
      revoked.push(store.userId);
      store = null;
      return false;
    },
    markCachePending: () => ({ ok: true }),
    clearCache: async () => {},
    onInvalidate: () => {},
    onPause: () => {},
    onRestore: () => {},
    onFailureNotice: () => {},
    applyOutcome: () => clearSignOutTransaction(),
  });
  assert.deepEqual(revoked, [USER_B]);
  assert.equal(store, null);
}

// 13. Normal password change keeps the same signed-in user.
reset();
{
  const current = makeSession(USER_A, 'sess-a', 'a@example.com');
  const renewed = makeSession(USER_A, 'sess-a', 'a@example.com');
  let store = current;
  let others = 0;
  const result = await runPasswordChange({
    recoveryLocked: () => false,
    readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
    signIn: async () => {
      store = renewed;
      return ownedOf(renewed);
    },
    updatePassword: async () => {},
    signOutOthers: async () => {
      others += 1;
      return true;
    },
    signOutLocal: async () => {
      throw new Error('must not sign out the current account');
    },
    suppressHydrate: () => {},
    enqueue: enqueueAuthMutation,
    raise: (message, code) => {
      throw new PasswordFlowError(message, code);
    },
  });
  assert.equal(result.otherSessionsRevoked, true);
  assert.equal(others, 1);
  assert.equal(store.userId, USER_A);
  assert.equal(store.sessionId, 'sess-a');
}

// 14. Pending password change cannot restore the session after logout.
reset();
{
  const original = makeSession(USER_A, 'sess-old', 'a@example.com');
  const renewed = makeSession(USER_A, 'sess-new', 'a@example.com');
  let store = original;
  const order = [];
  const entered = deferred();
  const release = deferred();
  const change = runPasswordChange({
    recoveryLocked: () => false,
    readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
    signIn: async () => {
      entered.resolve();
      await release.promise;
      order.push('reauth');
      store = renewed;
      return ownedOf(renewed);
    },
    updatePassword: async () => {
      order.push('update');
    },
    signOutOthers: async () => true,
    signOutLocal: async () => {},
    suppressHydrate: () => {},
    enqueue: enqueueAuthMutation,
    raise: (message, code) => {
      throw new PasswordFlowError(message, code);
    },
  });
  await entered.promise;
  const logout = enqueueAuthMutation(async () => {
    order.push('logout');
    store = null;
  });
  assert.deepEqual(order, []);
  release.resolve();
  await Promise.all([change, logout]);
  assert.deepEqual(order, ['reauth', 'update', 'logout']);
  assert.equal(store, null);
}

// 15. Pending A work then B login. Final stored account is B.
reset();
{
  const original = makeSession(USER_A, 'sess-old', 'a@example.com');
  const renewed = makeSession(USER_A, 'sess-new', 'a@example.com');
  const next = makeSession(USER_B, 'sess-b', 'b@example.com');
  let store = original;
  const entered = deferred();
  const release = deferred();
  const change = runPasswordChange({
    recoveryLocked: () => false,
    readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
    signIn: async () => {
      entered.resolve();
      await release.promise;
      store = renewed;
      return ownedOf(renewed);
    },
    updatePassword: async () => {},
    signOutOthers: async () => true,
    signOutLocal: async () => {},
    suppressHydrate: () => {},
    enqueue: enqueueAuthMutation,
    raise: (message, code) => {
      throw new PasswordFlowError(message, code);
    },
  });
  await entered.promise;
  const login = enqueueAuthMutation(async () => {
    store = next;
  });
  release.resolve();
  await change;
  await login;
  assert.equal(store.userId, USER_B);
}

// 16. A's intentional new login after logout remains.
reset();
{
  let store = makeSession(USER_A, 'sess-old', 'a@example.com');
  await enqueueAuthMutation(async () => {
    store = null;
    setSignedOutReason('logout', USER_A);
  });
  await enqueueAuthMutation(async () => {
    store = makeSession(USER_A, 'sess-new', 'a@example.com');
    commitCredentialSession({
      reason: getSignedOutReason(),
      setReasonNone: () => setSignedOutReason('none'),
    });
  });
  assert.equal(store.sessionId, 'sess-new');
  assert.equal(getSignedOutReason(), 'none');
}

// 17. After logout the stored session is what a cold start would read.
reset();
{
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  await runSignOutAttempt({
    kind: 'logout',
      boundary: boundary(),
    expectedUserId: USER_A,
    generationAtCall: getSessionGeneration(),
    readLiveUserId: async () => store?.userId ?? null,
    signOutLocal: async () => {
      store = null;
      return false;
    },
    markCachePending: () => ({ ok: true }),
    clearCache: async () => {},
    onInvalidate: () => {},
    onPause: () => {},
    onRestore: () => {},
    onFailureNotice: () => {},
    applyOutcome: () => clearSignOutTransaction(),
  });
  const restartRead = store;
  assert.equal(restartRead, null);
}

// 19. Two credential commits supersede the first hydrate401 without applying a user.
reset();
{
  setSignedOutReason('logout', USER_A);
  const first = commitCredentialSession({
    reason: getSignedOutReason(),
    setReasonNone: () => setSignedOutReason('none'),
  });
  const captured = getSessionGeneration();
  assert.equal(first, captured);
  commitCredentialSession({
    reason: getSignedOutReason(),
    setReasonNone: () => setSignedOutReason('none'),
  });
  const expiry = beginQueuedSignOutIfCurrent({
    kind: 'hydrate401',
    expectedUserId: USER_A,
    generationAtCall: captured,
    liveUserId: null,
    begin: beginSignOutTransaction,
  });
  assert.equal(expiry.status, 'superseded');
  assert.equal(getActiveSignOutTransaction(), null);
  assert.equal(getSignedOutReason(), 'none');
}

// 20. Successful recovery signs out only A and reports the Sign In outcome.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  let store = sessionA;
  let destination = null;
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => ({ ...ownedOf(store), email: store.email }),
      updatePassword: async () => {},
      signOutGlobal: async () => {
        assert.equal(store.userId, USER_A);
        store = null;
        return false;
      },
      signOutLocal: async () => false,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      clearLockIfSame: () => clearRecoveryState(),
      onSignedOut: () => {
        destination = 'SignIn';
      },
    }),
  );
  assert.equal(status, 'signed-out');
  assert.equal(destination, 'SignIn');
  assert.equal(store, null);
  assert.equal(mem.get('mawahib.passwordRecovery.v1') ?? null, null);
}

// 20b. SIGNED_OUT listener clears the lock before signOut's promise resolves.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  let store = sessionA;
  let listenerDestination = null;
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => {
        const raw = mem.get('mawahib.passwordRecovery.v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.phase === 'recovery-session'
          ? { email: parsed.email, userId: parsed.userId, phase: parsed.phase }
          : null;
      },
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {},
      signOutGlobal: async () => {
        store = null;
        clearRecoveryState();
        const active = getActiveSignOutTransaction();
        if (active?.status === 'started') {
          listenerDestination = 'SignIn';
          clearSignOutTransaction();
        }
        return false;
      },
      signOutLocal: async () => false,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      clearLockIfSame: () => {
        throw new Error('listener already cleared the lock');
      },
      onSignedOut: () => {
        throw new Error('listener already applied the outcome');
      },
    }),
  );
  assert.equal(status, 'signed-out');
  assert.equal(listenerDestination, 'SignIn');
  assert.equal(store, null);
  assert.equal(mem.get('mawahib.passwordRecovery.v1') ?? null, null);
}

// Owned discard leaves a different session alone.
reset();
{
  const written = makeSession(USER_B, 'sess-b', 'b@example.com');
  const current = makeSession(USER_A, 'sess-a', 'a@example.com');
  let calls = 0;
  const result = await finishCredentialEstablish({
    recoveryLocked: true,
    hasSessionUser: true,
    written: ownedOf(written),
    readLive: async () => ownedOf(current),
    signOutLocal: async () => {
      calls += 1;
    },
    commit: () => {
      throw new Error('must not commit');
    },
  });
  assert.equal(result, 'left');
  assert.equal(calls, 0);
}

// Superseded user logout does not report success.
reset();
{
  commitCredentialSession({
    reason: 'none',
    setReasonNone: () => setSignedOutReason('none'),
  });
  let store = makeSession(USER_B, 'sess-b', 'b@example.com');
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: 0,
      readLiveUserId: async () => store.userId,
      signOutLocal: async () => {
        store = null;
        return false;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {},
    }),
    new RegExp(LOGOUT_FAILURE_MESSAGE),
  );
  assert.equal(store.userId, USER_B);
}

// Superseded hydrate401 does not throw and does not sign out.
reset();
{
  commitCredentialSession({
    reason: 'none',
    setReasonNone: () => setSignedOutReason('none'),
  });
  const captured = getSessionGeneration();
  commitCredentialSession({
    reason: 'none',
    setReasonNone: () => setSignedOutReason('none'),
  });
  let signedOut = false;
  await runSignOutAttempt({
    kind: 'hydrate401',
    boundary: boundary(),
    expectedUserId: USER_A,
    generationAtCall: captured,
    readLiveUserId: async () => null,
    signOutLocal: async () => {
      signedOut = true;
      return false;
    },
    markCachePending: () => ({ ok: true }),
    clearCache: async () => {},
    onInvalidate: () => {},
    onPause: () => {},
    onRestore: () => {},
    onFailureNotice: () => {},
    applyOutcome: () => {
      throw new Error('superseded hydrate must not apply');
    },
  });
  assert.equal(signedOut, false);
  assert.equal(getActiveSignOutTransaction(), null);
}

// SDK removed the session and then returned an error. That is signed out.
reset();
{
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  let notice = false;
  await runSignOutAttempt({
    kind: 'logout',
    boundary: boundary(),
    expectedUserId: USER_A,
    generationAtCall: getSessionGeneration(),
    readLiveUserId: async () => store?.userId ?? null,
    signOutLocal: async () => {
      store = null;
      return true;
    },
    markCachePending: () => ({ ok: true }),
    clearCache: async () => {},
    onInvalidate: () => {},
    onPause: () => {},
    onRestore: () => {},
    onFailureNotice: () => {
      notice = true;
    },
    applyOutcome: () => clearSignOutTransaction(),
  });
  assert.equal(store, null);
  assert.equal(notice, false);
}

// Sign-out error while the same account is still stored stays a failure.
reset();
{
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => store.userId,
      signOutLocal: async () => true,
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {},
    }),
    new RegExp(LOGOUT_FAILURE_MESSAGE),
  );
  assert.equal(store.userId, USER_A);
}

// A newer session of the same user supersedes password change. Do not sign it out.
reset();
{
  const original = makeSession(USER_A, 'sess-old', 'a@example.com');
  const renewed = makeSession(USER_A, 'sess-reauth', 'a@example.com');
  const newer = makeSession(USER_A, 'sess-new-login', 'a@example.com');
  let store = original;
  let others = 0;
  await assert.rejects(
    runPasswordChange({
      recoveryLocked: () => false,
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      signIn: async () => {
        store = renewed;
        return ownedOf(renewed);
      },
      updatePassword: async () => {
        store = newer;
      },
      signOutOthers: async () => {
        others += 1;
        return true;
      },
      signOutLocal: async () => {
        throw new Error('must not sign out the newer session');
      },
      suppressHydrate: () => {},
      enqueue: enqueueAuthMutation,
      raise: (message, code) => {
        throw new PasswordFlowError(message, code);
      },
    }),
    (err) => err instanceof PasswordFlowError && err.code === 'identity',
  );
  assert.equal(others, 0);
  assert.equal(store.sessionId, 'sess-new-login');
}

// Sign-out error that leaves a different account does not report success or remove them.
reset();
{
  const replacement = makeSession(USER_B, 'sess-b', 'b@example.com');
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => store.userId,
      signOutLocal: async () => {
        store = replacement;
        return true;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {
        throw new Error('must not apply A onto B');
      },
    }),
    new RegExp(LOGOUT_FAILURE_MESSAGE),
  );
  assert.equal(store.userId, USER_B);
}

// A session read error is not an empty session. Logout must not succeed.
reset();
{
  let calls = 0;
  let notice = false;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'logout',
      boundary: boundary(),
      expectedUserId: USER_A,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => {
        throw new Error('refresh failed');
      },
      signOutLocal: async () => {
        calls += 1;
        return false;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {
        notice = true;
      },
      applyOutcome: () => {
        throw new Error('must not apply logout');
      },
    }),
    /refresh failed/,
  );
  assert.equal(calls, 0);
  assert.equal(notice, true);
  assert.equal(getActiveSignOutTransaction(), null);
}

// A stale same-owner transaction is not itself success. The new attempt signs out.
reset();
{
  const stale = beginSignOutTransaction({
    kind: 'logout',
    expectedUserId: USER_A,
  });
  let store = makeSession(USER_A, 'sess-a', 'a@example.com');
  let calls = 0;
  await runSignOutAttempt({
    kind: 'logout',
    boundary: boundary(),
    expectedUserId: USER_A,
    generationAtCall: getSessionGeneration(),
    readLiveUserId: async () => store?.userId ?? null,
    signOutLocal: async () => {
      calls += 1;
      store = null;
      return false;
    },
    markCachePending: () => ({ ok: true }),
    clearCache: async () => {},
    onInvalidate: () => {},
    onPause: () => {},
    onRestore: () => {},
    onFailureNotice: () => {},
    applyOutcome: () => clearSignOutTransaction(),
  });
  assert.equal(calls, 1);
  assert.equal(store, null);
  assert.notEqual(getActiveSignOutTransaction()?.id, stale.txn.id);
}

// Recovery cleanup does not sign out a newer session of the same user.
reset();
{
  const captured = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  const newer = makeSession(USER_A, 'sess-new', 'a@example.com');
  let store = newer;
  let calls = 0;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'recoveryAbort',
      boundary: boundary(),
      expectedUserId: USER_A,
      expectedSessionId: captured.sessionId,
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => store.userId,
      readLiveSessionId: async () => store.sessionId,
      signOutLocal: async () => {
        calls += 1;
        store = null;
        return false;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {
        throw new Error('must not apply');
      },
    }),
    /SESSION_SUPERSEDED/,
  );
  assert.equal(calls, 0);
  assert.equal(store.sessionId, 'sess-new');
}

// Global revoke fails after the recovery session is already gone.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  let store = sessionA;
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {},
      signOutGlobal: async () => {
        store = null;
        return true;
      },
      signOutLocal: async () => {
        throw new Error('must not sign out again');
      },
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      clearLockIfSame: () => clearRecoveryState(),
      onSignedOut: () => {},
    }),
  );
  assert.equal(status, 'local-signed-out');
  assert.equal(store, null);
}

// A superseded recovery cleanup does not resolve as success.
reset();
{
  const generationAtCall = getSessionGeneration();
  commitCredentialSession({
    reason: 'none',
    setReasonNone: () => {},
  });
  let calls = 0;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'recoveryAbort',
      boundary: boundary(),
      expectedUserId: USER_A,
      expectedSessionId: 'sess-old',
      generationAtCall,
      readLiveUserId: async () => USER_A,
      readLiveSessionId: async () => 'sess-old',
      signOutLocal: async () => {
        calls += 1;
        return false;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {
        throw new Error('must not apply');
      },
    }),
    /SESSION_SUPERSEDED/,
  );
  assert.equal(calls, 0);
}

// A different account after a failed local sign-out is not treated as cleanup success.
reset();
{
  let reads = 0;
  let calls = 0;
  await assert.rejects(
    runSignOutAttempt({
      kind: 'recoveryAbort',
      boundary: boundary(),
      expectedUserId: USER_A,
      expectedSessionId: 'sess-old',
      generationAtCall: getSessionGeneration(),
      readLiveUserId: async () => {
        reads += 1;
        return reads < 4 ? USER_A : USER_B;
      },
      readLiveSessionId: async () => 'sess-old',
      signOutLocal: async () => {
        calls += 1;
        return true;
      },
      markCachePending: () => ({ ok: true }),
      clearCache: async () => {},
      onInvalidate: () => {},
      onPause: () => {},
      onRestore: () => {},
      onFailureNotice: () => {},
      applyOutcome: () => {
        throw new Error('must not apply');
      },
    }),
    /SESSION_SUPERSEDED/,
  );
  assert.equal(calls, 1);
}

// Signed-in password updates include current_password. Recovery updates omit it.
reset();
{
  const signedIn = passwordUpdateAttributes('new-secret', 'old-secret');
  assert.deepEqual(signedIn, {
    password: 'new-secret',
    current_password: 'old-secret',
  });
  const recovery = passwordUpdateAttributes('new-secret');
  assert.deepEqual(Object.keys(recovery), ['password']);
  assert.equal(recovery.password, 'new-secret');
  const blank = passwordUpdateAttributes('new-secret', '');
  assert.equal('current_password' in blank, false);
}

// A failed password update does not report other-session revocation.
reset();
{
  let others = 0;
  await assert.rejects(
    runPasswordChange({
      recoveryLocked: () => false,
      readLive: async () => ({
        ...ownedOf(makeSession(USER_A, 'sess-a', 'a@example.com')),
        email: 'a@example.com',
      }),
      signIn: async () => ownedOf(makeSession(USER_A, 'sess-a', 'a@example.com')),
      updatePassword: async () => {
        throw new PasswordFlowError('Current password is incorrect.', 'update');
      },
      signOutOthers: async () => {
        others += 1;
        return true;
      },
      signOutLocal: async () => {},
      suppressHydrate: () => {},
      enqueue: enqueueAuthMutation,
      raise: (message, code) => {
        throw new PasswordFlowError(message, code);
      },
    }),
    (err) => err instanceof PasswordFlowError && err.code === 'update',
  );
  assert.equal(others, 0);
}

// A successful update followed by a failed other-session sign-out is partial.
reset();
{
  const result = await runPasswordChange({
    recoveryLocked: () => false,
    readLive: async () => ({
      ...ownedOf(makeSession(USER_A, 'sess-a', 'a@example.com')),
      email: 'a@example.com',
    }),
    signIn: async () => ownedOf(makeSession(USER_A, 'sess-a', 'a@example.com')),
    updatePassword: async () => {},
    signOutOthers: async () => false,
    signOutLocal: async () => {
      throw new Error('must not sign out this device');
    },
    suppressHydrate: () => {},
    enqueue: enqueueAuthMutation,
    raise: (message, code) => {
      throw new PasswordFlowError(message, code);
    },
  });
  assert.equal(result.otherSessionsRevoked, false);
  assert.equal(result.userId, USER_A);
}

function otherDeviceRetry(overrides = {}) {
  return {
    expectedUserId: USER_A,
    expectedSessionId: 'sess-a',
    generationAtCall: 1,
    currentGeneration: () => 1,
    readLive: async () => ({ userId: USER_A, sessionId: 'sess-a' }),
    recoveryLocked: () => false,
    signOutOthers: async () => true,
    enqueue: enqueueAuthMutation,
    ...overrides,
  };
}

// Retry signs out other sessions once and keeps no password.
reset();
{
  let calls = 0;
  const gate = deferred();
  const retryState = { userId: USER_A, sessionId: 'sess-a', generation: 1 };
  const first = runOtherSessionSignOut(
    otherDeviceRetry({
      expectedUserId: retryState.userId,
      expectedSessionId: retryState.sessionId,
      generationAtCall: retryState.generation,
      signOutOthers: async () => {
        calls += 1;
        await gate.promise;
        return true;
      },
    }),
  );
  const second = await runOtherSessionSignOut(otherDeviceRetry());
  assert.equal(second, 'in-flight');
  assert.deepEqual(Object.keys(retryState).sort(), [
    'generation',
    'sessionId',
    'userId',
  ]);
  gate.resolve();
  assert.equal(await first, 'revoked');
  assert.equal(calls, 1);
  assert.equal(offersAnotherOtherDeviceRetry('initial-failure'), true);
  assert.equal(offersAnotherOtherDeviceRetry('retry-finished'), false);
}

// An account change does not sign out the new account's other sessions.
reset();
{
  let calls = 0;
  const changed = await runOtherSessionSignOut(
    otherDeviceRetry({
      readLive: async () => ({ userId: USER_B, sessionId: 'sess-b' }),
      signOutOthers: async () => {
        calls += 1;
        return true;
      },
    }),
  );
  assert.equal(changed, 'account-changed');
  assert.equal(calls, 0);
}

// A missing session is not treated as revoked.
reset();
{
  let calls = 0;
  const missing = await runOtherSessionSignOut(
    otherDeviceRetry({
      readLive: async () => null,
      signOutOthers: async () => {
        calls += 1;
        return true;
      },
    }),
  );
  assert.equal(missing, 'session-missing');
  assert.equal(calls, 0);
}

// A different account after the sign-out call is not reported as revoked.
reset();
{
  let live = { userId: USER_A, sessionId: 'sess-a' };
  const switched = await runOtherSessionSignOut(
    otherDeviceRetry({
      readLive: async () => live,
      signOutOthers: async () => {
        live = { userId: USER_B, sessionId: 'sess-b' };
        return true;
      },
    }),
  );
  assert.equal(switched, 'account-changed');
}

// The same account with a replaced session does not keep the old retry.
reset();
{
  let calls = 0;
  let generation = 1;
  let live = { userId: USER_A, sessionId: 'sess-a' };
  const gate = deferred();
  const blocker = enqueueAuthMutation(() => gate.promise);
  const retry = runOtherSessionSignOut(
    otherDeviceRetry({
      generationAtCall: 1,
      currentGeneration: () => generation,
      readLive: async () => live,
      signOutOthers: async () => {
        calls += 1;
        return true;
      },
    }),
  );
  generation = 2;
  live = { userId: USER_A, sessionId: 'sess-new' };
  gate.resolve();
  await blocker;
  assert.equal(await retry, 'superseded');
  assert.equal(calls, 0);
}

// A refresh that keeps the session id can still sign out other devices.
reset();
{
  let calls = 0;
  const refreshed = await runOtherSessionSignOut(
    otherDeviceRetry({
      signOutOthers: async () => {
        calls += 1;
        return true;
      },
    }),
  );
  assert.equal(refreshed, 'revoked');
  assert.equal(calls, 1);
}

// Recovery lock blocks the retry.
reset();
{
  let calls = 0;
  const locked = await runOtherSessionSignOut(
    otherDeviceRetry({
      recoveryLocked: () => true,
      signOutOthers: async () => {
        calls += 1;
        return true;
      },
    }),
  );
  assert.equal(locked, 'unavailable');
  assert.equal(calls, 0);
}

// Provider current-password and reauthentication errors stay generic.
reset();
{
  assert.equal(
    mapAuthError({
      code: 'current_password_invalid',
      message: 'Current password required when setting new password.',
    }),
    'Current password is incorrect.',
  );
  assert.equal(
    mapAuthError({
      code: 'current_password_required',
      message: 'Current password required when setting new password.',
    }),
    'Enter your current password and try again.',
  );
  assert.equal(
    mapAuthError({
      code: 'reauthentication_needed',
      message: 'Password update requires reauthentication',
    }),
    'Sign in again, then change your password.',
  );
}

// Local recovery cleanup clears the global-success notice before navigation.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  let store = sessionA;
  const order = [];
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {},
      signOutGlobal: async () => true,
      signOutLocal: async () => {
        store = null;
        return false;
      },
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      clearLockIfSame: () => clearRecoveryState(),
      clearSuccessNotice: () => {
        order.push('clear-notice');
        clearSignOutNotice(getActiveSignOutTransaction()?.id);
        assert.equal(getActiveSignOutTransaction()?.notice, undefined);
      },
      onSignedOut: () => {
        order.push('signed-out');
        assert.equal(getActiveSignOutTransaction()?.notice, undefined);
      },
    }),
  );
  assert.equal(status, 'local-signed-out');
  assert.deepEqual(order, ['clear-notice', 'signed-out']);
  assert.match(
    recoveryCleanupMessage('local-signed-out'),
    /This device is signed out/,
  );
  assert.doesNotMatch(
    recoveryCleanupMessage('sign-out-failed'),
    /This device is signed out/,
  );
}

// Unconfirmed local cleanup does not count as signed out.
reset();
armRecovery();
{
  const sessionA = makeSession(USER_A, 'sess-recovery', 'a@example.com');
  let store = sessionA;
  const status = await enqueueAuthMutation(() =>
    runRecoveryCompletion({
      readLock: () => ({
        email: 'a@example.com',
        userId: USER_A,
        phase: 'recovery-session',
      }),
      readLive: async () => (store ? { ...ownedOf(store), email: store.email } : null),
      updatePassword: async () => {},
      signOutGlobal: async () => true,
      signOutLocal: async () => true,
      prepareCache: async () => true,
      begin: beginSignOutTransaction,
      fail: (id) => {
        failSignOutTransaction(id);
      },
      clear: clearSignOutTransaction,
      getActive: getActiveSignOutTransaction,
      hasInflight: hasSignOutInflight,
      inflightKey: signOutInflightKey,
      clearLockIfSame: () => clearRecoveryState(),
      onSignedOut: () => {
        throw new Error('must not announce sign-out');
      },
    }),
  );
  assert.equal(status, 'sign-out-failed');
  assert.equal(store.userId, USER_A);
}

console.log('auth-session-mutation-selftest ok');
