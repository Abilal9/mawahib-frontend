import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  accessTokenSubject,
  ApiError,
  isAccountSuspendedError,
  isMawahibProfileMissingError,
  isStaleIdentityError,
  registerAuthRequestRuntime,
  subscribeAccountSuspended,
} from '../lib/apiClient';
import { acquireAuthenticatedToken } from '../lib/authenticatedToken';
import { AuthFailure } from '../lib/authFailure';
import { clearMediaImageCache } from '../lib/mediaImageCache';
import {
  mediaCacheOwnerFromUserId,
  type MediaCacheOwner,
} from '../lib/mediaCacheOwner';
import { markMediaCacheClearPending } from '../lib/mediaCachePending';
import { reconcileMediaCacheOwner } from '../lib/reconcileMediaCache';
import { isAuthNetworkError, mapAuthError } from '../lib/authErrors';
import {
  clearPendingSignup,
  loadPendingSignup,
  savePendingSignup,
  sessionAllowsSignupFallbacks,
  stampPendingSignupFromSession,
} from '../lib/pendingSignup';
import { principalsEqual } from '../lib/requestPrincipal';
import { registerSupabaseAutoRefreshLifecycle } from '../lib/supabaseAutoRefresh';
import { isPasswordValid } from '../lib/passwordRules';
import {
  clearRecoveryState,
  loadRecoveryState,
  normalizeRecoveryEmail,
  PasswordFlowError,
  saveRecoveryState,
  type RecoveryState,
} from '../lib/recoveryState';
import { invalidateReturnIntents } from '../lib/returnIntent';
import {
  invalidateAuthCallbacks,
  isCallbackSessionCommitInFlight,
  shouldIgnoreAuthEventForCallbackCommit,
} from '../lib/authCallbackTransaction';
import { enqueueAuthMutation } from '../lib/authMutationQueue';
import {
  finishCredentialEstablish,
  ownedSession,
  passwordUpdateAttributes,
  runOtherSessionSignOut,
  runPasswordChange,
  sameOwnedSession,
  runRecoveryCompletion,
  runSignOutAttempt,
  shouldApplyHydrate401Expiry,
  type OwnedSession,
} from '../lib/authSessionMutation';
import {
  applyApiUserAllowed,
  beginQueuedSignOutIfCurrent,
  bumpSessionGeneration,
  commitCredentialSession,
  getSessionGeneration,
  hasSignOutInflight,
  joinOrStartSignOut,
  signOutInflightKey,
} from '../lib/authSignOutSlot';
import { hasConsumedProcessStart } from '../lib/processStart';
import {
  enterAuthenticatedProduct,
  enterSignedOutAt,
  isAuthenticatedProductActive,
  leaveAuthenticatedProduct,
} from '../lib/productTree';
import { resetToSignedOut } from '../navigation/navigationRef';
import {
  routeFromSignedOutInterpretation,
} from '../lib/signedOutDestination';
import {
  beginSignOutTransaction,
  clearSignOutNotice,
  clearSignOutTransaction,
  completeSignOutTransaction,
  failSignOutTransaction,
  getActiveSignOutTransaction,
  interpretSignedOut,
  type SignOutKind,
} from '../lib/signOutTransaction';
import {
  beginGuestChosen,
  clearAuthenticatedProcess,
  endGuestChosen,
  getSignedOutReason,
  getSignedOutUserId,
  isGuestChosenInFlight,
  markAuthenticatedProcess,
  setSignedOutReason,
  subscribeSignedOutReason,
  type SignedOutReason,
  wasAuthenticatedProcess,
} from '../lib/signedOutReason';
import {
  localSignOutDecision,
  shouldApplySignOutOutcome,
  shouldClearLogoutReasonForIncomingSession,
} from '../lib/signedOutBranchEntry';
import { shouldIgnoreStaleAuthResult } from './authSessionGuard';
import { supabase } from '../lib/supabase';
import { appEnv } from '../config/env';
import { authApi, mapApiUserToUser, type ApiUser } from '../services/authApi';
import type { User } from '../data/types';
import {
  locationDisplayFields,
  type CountryCode,
} from '../data/location/geo';

export type AccountType = 'talent' | 'business';

export interface SignUpBasics {
  name: string;
  email: string;
  city: string;
  countryCode?: CountryCode;
  locationCode?: string;
  phoneE164: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Signup outcomes — ConfirmCode only for otp_sent (send/resend actually succeeded).
 * Uses Supabase obfuscation signal: confirmed duplicate → user.identities === [].
 */
export type RegisterEmailResult =
  | { status: 'otp_sent'; kind: 'fresh' | 'resumed' }
  | { status: 'session_ready'; user: ApiUser }
  | { status: 'already_verified' }
  | { status: 'ambiguous' };

interface AuthContextValue {
  accountType: AccountType | null;
  setAccountType: (type: AccountType) => void;
  isSignedIn: boolean;
  session: Session | null;
  accessToken: string | null;
  apiUser: ApiUser | null;
  mappedUser: User | null;
  signUpBasics: SignUpBasics | null;
  setSignUpBasics: (basics: SignUpBasics) => void;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  /** Survives media-hold remount after a failed current-device logout. */
  logoutFailureNotice: string | null;
  clearLogoutFailureNotice: () => void;
  /** Durable image-cache owner is established. No authenticated media before this. */
  mediaCacheReady: boolean;
  mediaCacheBlocked: boolean;
  retryMediaCache: () => void;
  /** Backend says this Supabase session's Mawahib account is suspended. */
  accountSuspended: boolean;
  /** Run normal hydration once. Backend decides whether the flag clears. */
  recheckAccountStatus: () => Promise<void>;
  /** Supabase email/password signup (email OTP confirmation required). */
  registerWithEmail: (input: {
    email: string;
    password: string;
    name: string;
    firstName?: string;
    lastName?: string;
    city: string;
    countryCode?: CountryCode;
    locationCode?: string;
    phoneE164: string;
    accountType: AccountType;
  }) => Promise<RegisterEmailResult>;
  verifySignupOtp: (email: string, token: string) => Promise<ApiUser>;
  resendSignupOtp: (email: string) => Promise<void>;
  /**
   * Phone OTP on the same Supabase user (updateUser + phone_change).
   * Requires EXPO_PUBLIC_PHONE_AUTH_ENABLED and an SMS provider.
   */
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<ApiUser>;
  /** Idempotent Nest bootstrap + load /users/me */
  bootstrapSession: (input?: {
    accountType?: AccountType;
    displayName?: string;
    locationCity?: string;
    locationCountry?: string;
    countryCode?: CountryCode;
    locationCode?: string;
    phoneE164?: string;
  }) => Promise<ApiUser>;
  refreshMe: (accessToken?: string) => Promise<ApiUser>;
  signInWithEmail: (email: string, password: string) => Promise<ApiUser>;
  /** Resume verification for an unverified email (resend + pending context). */
  resumeEmailVerification: (email: string) => Promise<void>;
  completeSignUp: () => void;
  signIn: () => void;
  signOut: (
    kind?: SignOutKind,
    options?: { expectedUserId?: string; expectedSessionId?: string },
  ) => Promise<void>;
  signedOutReason: SignedOutReason;
  continueAsGuest: () => Promise<boolean>;
  /** Set while a password-recovery lock is persisted. Not ordinary app auth. */
  recovery: RecoveryState | null;
  armRecoveryVerification: (email: string) => boolean;
  /** True after this launch discarded an interrupted recovery. */
  recoveryRestart: boolean;
  commitRecoverySession: (email: string, userId: string) => boolean;
  clearRecoveryLock: () => void;
  /** Local sign-out, then clear the lock only after that sign-out succeeds. */
  discardInterruptedRecovery: () => Promise<boolean>;
  completePasswordReset: (password: string) => Promise<
    | { status: 'signed-out' }
    | { status: 'local-signed-out' }
    | { status: 'sign-out-failed' }
    | { status: 'rejected' }
  >;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{
    otherSessionsRevoked: boolean;
    userId: string;
    sessionId: string;
    generation: number;
  }>;
  /**
   * Retry only other-device sign-out for the session that changed its password.
   * Does not send either password.
   */
  retryOtherDeviceSignOut: (expected: {
    userId: string;
    sessionId: string;
    generation: number;
  }) => Promise<
    | 'revoked'
    | 'unconfirmed'
    | 'account-changed'
    | 'session-missing'
    | 'unavailable'
    | 'superseded'
    | 'in-flight'
  >;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function uncertainPasswordChange(): PasswordFlowError {
  return new PasswordFlowError(
    'We could not confirm whether the password changed. Try the new password before trying again.',
    'network',
  );
}

const signOutBoundary = {
  beginQueued: beginQueuedSignOutIfCurrent,
  begin: beginSignOutTransaction,
  fail: (id: number) => {
    failSignOutTransaction(id);
  },
  clear: clearSignOutTransaction,
  getActive: getActiveSignOutTransaction,
  hasInflight: hasSignOutInflight,
  inflightKey: signOutInflightKey,
  localDecision: localSignOutDecision,
};

function raisePasswordFlow(
  message: string,
  code: 'unavailable' | 'identity',
): never {
  throw new PasswordFlowError(message, code);
}

async function settleEstablishedCredential(
  session: {
    user?: { id?: string };
    access_token?: string;
    refresh_token?: string;
  } | null,
  commit: () => void,
): Promise<void> {
  const userId = session?.user?.id;
  const written =
    userId && session?.access_token
      ? ownedSession({
          userId,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        })
      : null;
  await finishCredentialEstablish({
    recoveryLocked: Boolean(loadRecoveryState()),
    hasSessionUser: Boolean(userId),
    written,
    readLive: async () => readOwnedSession(),
    signOutLocal: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (!error) return;
      const still = await readOwnedSession();
      if (written && sameOwnedSession(still, written)) throw error;
    },
    commit,
  });
  if (loadRecoveryState()) {
    throw new PasswordFlowError(
      'Password reset is in progress.',
      'unavailable',
    );
  }
}

async function readOwnedSession(): Promise<
  (OwnedSession & { email: string }) | null
> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  if (!userId || !accessToken) return null;
  const owned = ownedSession({
    userId,
    accessToken,
    refreshToken: session.refresh_token,
  });
  if (!owned) return null;
  return {
    ...owned,
    email: normalizeRecoveryEmail(session.user.email ?? ''),
  };
}

async function updatePassword(
  password: string,
  currentPassword?: string,
): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser(
      passwordUpdateAttributes(password, currentPassword),
    );
    if (!error) return;
    if (isAuthNetworkError(error)) throw uncertainPasswordChange();
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : '';
    const failureCode =
      code === 'current_password_invalid' || code === 'current_password_required'
        ? 'current-password'
        : 'update';
    throw new PasswordFlowError(
      passwordUpdateMessage(mapAuthError(error), [password, currentPassword]),
      failureCode,
    );
  } catch (err) {
    if (err instanceof PasswordFlowError) throw err;
    throw uncertainPasswordChange();
  }
}

function passwordUpdateMessage(
  message: string,
  secrets: Array<string | undefined>,
): string {
  for (const secret of secrets) {
    if (secret && secret.length >= 4 && message.includes(secret)) {
      return 'Could not change your password. Please try again.';
    }
  }
  return message;
}

function isEmailConfirmed(session: Session): boolean {
  const user = session.user;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function bootstrapPayloadFromSession(
  session: Session,
  overrides?: {
    accountType?: AccountType;
    displayName?: string;
    locationCity?: string;
    locationCountry?: string;
    countryCode?: CountryCode;
    locationCode?: string;
    phoneE164?: string;
  },
  fallbacks?: {
    accountType?: AccountType | null;
    name?: string;
    email?: string;
    city?: string;
    countryCode?: CountryCode;
    locationCode?: string;
    phoneE164?: string;
  },
) {
  const meta = session.user?.user_metadata ?? {};
  const allowedFallbacks = sessionAllowsSignupFallbacks({
    userId: session.user?.id ?? '',
    email: session.user?.email,
    basicsEmail: fallbacks?.email,
  })
    ? fallbacks
    : undefined;
  const accountType =
    overrides?.accountType ||
    allowedFallbacks?.accountType ||
    (meta.account_type as AccountType | undefined) ||
    'talent';
  const displayName =
    overrides?.displayName ||
    allowedFallbacks?.name ||
    (meta.display_name as string | undefined) ||
    session.user?.email?.split('@')[0] ||
    'Mawahib User';
  const locationCity =
    overrides?.locationCity ||
    allowedFallbacks?.city ||
    (meta.city as string | undefined);
  const locationCountry =
    overrides?.locationCountry ||
    (meta.location_country as string | undefined);
  const countryCode =
    overrides?.countryCode ||
    allowedFallbacks?.countryCode ||
    (meta.country_code as CountryCode | undefined);
  const locationCode =
    overrides?.locationCode ||
    allowedFallbacks?.locationCode ||
    (meta.location_code as string | undefined);
  const phoneE164 =
    overrides?.phoneE164 ||
    allowedFallbacks?.phoneE164 ||
    (meta.phone_e164 as string | undefined) ||
    session.user?.phone ||
    undefined;

  // Verification flags are server-authoritative — do not send from client.
  return {
    accountType,
    displayName,
    locationCity,
    locationCountry,
    countryCode,
    locationCode,
    email: session.user?.email,
    phoneE164,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signUpBasics, setSignUpBasics] = useState<SignUpBasics | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutFailureNotice, setLogoutFailureNotice] = useState<string | null>(
    null,
  );
  const [accountSuspended, setAccountSuspended] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [recoveryRestart, setRecoveryRestart] = useState(false);
  const signedOutReason = useSyncExternalStore(
    subscribeSignedOutReason,
    getSignedOutReason,
    getSignedOutReason,
  );
  const appliedSignOutTxnId = useRef<number | null>(null);
  const [mediaCache, setMediaCache] = useState<{
    principal: MediaCacheOwner | null;
    ready: boolean;
    blocked: boolean;
  }>({ principal: null, ready: false, blocked: false });
  const [mediaRetryTick, setMediaRetryTick] = useState(0);
  const mediaReconcileGen = useRef(0);
  const mediaPauseRef = useRef(false);
  const mediaPauseOwnerRef = useRef<number | null>(null);
  const recoveryCleanupSnapRef = useRef<RecoveryState | null>(null);

  // Owner follows the resolved Nest principal after hydrate, not TOKEN_REFRESHED
  // and not a stale in-flight hydrate. While authLoading, skip reconcile so we
  // never treat a still-restoring session as guest and wipe A then rewrite A.
  const mediaPrincipal: MediaCacheOwner | null = authLoading
    ? null
    : mediaCacheOwnerFromUserId(apiUser?.id ?? null);

  if (mediaCache.principal !== mediaPrincipal) {
    setMediaCache({
      principal: mediaPrincipal,
      ready: false,
      blocked: false,
    });
  }

  useEffect(() => {
    if (mediaPauseRef.current) return;
    if (mediaPrincipal == null) return;
    if (mediaCache.principal !== mediaPrincipal) return;
    if (mediaCache.ready) return;
    if (mediaCache.blocked) return;
    let cancelled = false;
    const gen = ++mediaReconcileGen.current;
    void (async () => {
      const result = await reconcileMediaCacheOwner({
        current: mediaPrincipal,
        clearCache: clearMediaImageCache,
      });
      if (cancelled || gen !== mediaReconcileGen.current) return;
      if (result.ok) {
        setMediaCache({
          principal: mediaPrincipal,
          ready: true,
          blocked: false,
        });
        return;
      }
      if (result.reason === 'superseded') return;
      setMediaCache({
        principal: mediaPrincipal,
        ready: false,
        blocked: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mediaPrincipal,
    mediaCache.principal,
    mediaCache.ready,
    mediaCache.blocked,
    mediaRetryTick,
  ]);

  const retryMediaCache = useCallback(() => {
    setMediaCache((current) => ({
      ...current,
      ready: false,
      blocked: false,
    }));
    setMediaRetryTick((tick) => tick + 1);
  }, []);

  const mediaCacheReady =
    !authLoading &&
    mediaPrincipal != null &&
    mediaCache.principal === mediaPrincipal &&
    mediaCache.ready &&
    !mediaCache.blocked;
  const mediaCacheBlocked = mediaCache.blocked;
  type HydrateOverrides = {
    accountType?: AccountType;
    displayName?: string;
    locationCity?: string;
    locationCountry?: string;
    countryCode?: CountryCode;
    locationCode?: string;
    phoneE164?: string;
  };

  const hydrateInFlight = useRef<Promise<ApiUser | null> | null>(null);
  const authEpoch = useRef(0);
  const hydrateSessionRef = useRef<Session | null>(null);
  const hydrateOverridesRef = useRef<HydrateOverrides | undefined>(undefined);
  const lastHydrateErrorRef = useRef<string | null>(null);
  const accountSuspendedRef = useRef(false);
  const suspensionEpoch = useRef(0);
  const accountTypeRef = useRef(accountType);
  const signUpBasicsRef = useRef(signUpBasics);
  const apiUserRef = useRef(apiUser);
  const suppressSameUserHydrateRef = useRef(false);
  accountTypeRef.current = accountType;
  signUpBasicsRef.current = signUpBasics;
  apiUserRef.current = apiUser;

  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearLogoutFailureNotice = useCallback(
    () => setLogoutFailureNotice(null),
    [],
  );

  const clearRecoveryLock = useCallback(() => {
    clearRecoveryState();
    setRecovery(null);
  }, []);

  const armRecoveryVerification = useCallback((email: string) => {
    const next: RecoveryState = {
      email: normalizeRecoveryEmail(email),
      phase: 'verifying',
    };
    if (!saveRecoveryState(next)) return false;
    invalidateReturnIntents();
    setRecovery(next);
    return true;
  }, []);

  const commitRecoverySession = useCallback((email: string, userId: string) => {
    const normalized = normalizeRecoveryEmail(email);
    const current = loadRecoveryState();
    if (
      !current ||
      current.phase !== 'verifying' ||
      current.email !== normalized ||
      !userId.trim()
    ) {
      return false;
    }
    const next: RecoveryState = {
      email: normalized,
      phase: 'recovery-session',
      userId: userId.trim(),
    };
    if (!saveRecoveryState(next)) return false;
    setRecovery(next);
    return true;
  }, []);

  const commitSignedOutReason = useCallback(
    (next: SignedOutReason, userId?: string | null) => {
      setSignedOutReason(next, userId);
    },
    [],
  );

  const clearAuthenticatedState = useCallback(() => {
    invalidateReturnIntents();
    invalidateAuthCallbacks();
    authEpoch.current += 1;
    hydrateSessionRef.current = null;
    hydrateOverridesRef.current = undefined;
    accountSuspendedRef.current = false;
    setAccountSuspended(false);
    setSession(null);
    setApiUser(null);
    setIsSignedIn(false);
    setAccountType(null);
    setSignUpBasics(null);
  }, []);

  const applySignedOutOutcome = useCallback(
    (interpretation: ReturnType<typeof interpretSignedOut>) => {
      const txn = getActiveSignOutTransaction();
      const liveUserId =
        apiUserRef.current?.id ?? hydrateSessionRef.current?.user?.id ?? null;
      if (
        !shouldApplySignOutOutcome({
          expectedUserId: txn?.expectedUserId,
          liveUserId,
        })
      ) {
        if (txn && mediaPauseOwnerRef.current === txn.id) {
          mediaPauseOwnerRef.current = null;
          mediaPauseRef.current = false;
          setMediaCache((current) => ({
            ...current,
            ready: false,
            blocked: false,
          }));
          setMediaRetryTick((tick) => tick + 1);
        }
        clearSignOutTransaction();
        return;
      }
      if (txn && appliedSignOutTxnId.current === txn.id && txn.status === 'completed') {
        return;
      }
      if (txn?.status === 'started') {
        completeSignOutTransaction(txn.id);
        appliedSignOutTxnId.current = txn.id;
      }
      commitSignedOutReason(
        interpretation.reason,
        interpretation.reason === 'logout' || interpretation.reason === 'guestChosen'
          ? (txn?.expectedUserId ?? liveUserId)
          : null,
      );
      clearAuthenticatedProcess();
      if (
        txn?.kind === 'recoveryAbort' ||
        txn?.kind === 'sessionClearForRecovery'
      ) {
        const snap = recoveryCleanupSnapRef.current;
        const current = loadRecoveryState();
        const sameLock =
          !!snap &&
          !!current &&
          current.email === snap.email &&
          current.phase === snap.phase &&
          current.userId === snap.userId;
        if (sameLock) {
          clearRecoveryState();
          setRecovery(null);
        }
        recoveryCleanupSnapRef.current = null;
      } else if (
        txn?.kind === 'recoveryComplete' ||
        txn?.kind === 'identityMismatch'
      ) {
        clearRecoveryState();
        setRecovery(null);
      }
      mediaPauseOwnerRef.current = null;
      mediaPauseRef.current = false;
      setMediaCache((current) => ({
        ...current,
        ready: false,
        blocked: false,
      }));
      setMediaRetryTick((tick) => tick + 1);
      clearAuthenticatedState();
      bumpSessionGeneration();
      if (interpretation.apply) {
        leaveAuthenticatedProduct(routeFromSignedOutInterpretation(interpretation));
      }
      clearSignOutTransaction();
    },
    [clearAuthenticatedState, commitSignedOutReason],
  );

  const signOut = useCallback(
    async (
      kind: SignOutKind = 'logout',
      options?: {
        expectedUserId?: string;
        generationAtCall?: number;
        expectedSessionId?: string;
      },
    ) => {
      const expectedUserId =
        options?.expectedUserId ??
        (options?.expectedSessionId === undefined
          ? (apiUserRef.current?.id ?? hydrateSessionRef.current?.user?.id)
          : undefined);
      const cleanupSnap =
        kind === 'recoveryAbort' || kind === 'sessionClearForRecovery'
          ? loadRecoveryState()
          : null;
      const generationAtCall =
        options?.generationAtCall ?? getSessionGeneration();
      const pauseMedia = (txnId: number) => {
        mediaPauseOwnerRef.current = txnId;
        mediaPauseRef.current = true;
        setMediaCache((current) => ({
          ...current,
          ready: false,
          blocked: false,
        }));
      };
      const restoreMedia = (txnId: number) => {
        if (mediaPauseOwnerRef.current !== txnId) return;
        mediaPauseOwnerRef.current = null;
        mediaPauseRef.current = false;
        setMediaCache((current) => ({
          ...current,
          ready: false,
          blocked: false,
        }));
        setMediaRetryTick((tick) => tick + 1);
      };
      await joinOrStartSignOut(signOutInflightKey(kind, expectedUserId), () =>
        enqueueAuthMutation(async () => {
          recoveryCleanupSnapRef.current = cleanupSnap;
          try {
          await runSignOutAttempt({
            kind,
            expectedUserId,
            expectedSessionId: options?.expectedSessionId,
            generationAtCall,
            readLiveUserId: async () => {
              const { data: live, error } = await supabase.auth.getSession();
              // An expired token can make getSession return no session plus an
              // error while storage still holds the refresh token. That is not
              // "already signed out".
              if (error) throw error;
              return live.session?.user?.id ?? null;
            },
            readLiveSessionId: async () => {
              const live = await readOwnedSession();
              return live?.sessionId ?? null;
            },
            signOutLocal: async () => {
              try {
                const { error } = await supabase.auth.signOut({ scope: 'local' });
                return Boolean(error);
              } catch {
                return true;
              }
            },
            markCachePending: markMediaCacheClearPending,
            clearCache: clearMediaImageCache,
            onInvalidate: () => {
              invalidateAuthCallbacks();
              setAuthError(null);
            },
            onPause: pauseMedia,
            onRestore: restoreMedia,
            onFailureNotice: (message) => {
              setLogoutFailureNotice(message);
            },
            boundary: signOutBoundary,
            applyOutcome: (txnId) => {
              const active = getActiveSignOutTransaction();
              if (!active || active.id !== txnId || active.status === 'completed') {
                return;
              }
              applySignedOutOutcome(
                interpretSignedOut({
                  hadAuthenticatedProduct: wasAuthenticatedProcess(),
                  recoveryLocked: Boolean(loadRecoveryState()),
                  processStarted: hasConsumedProcessStart(),
                }),
              );
            },
          });
          } finally {
            recoveryCleanupSnapRef.current = null;
          }
        }),
      );
    },
    [applySignedOutOutcome],
  );

  const discardInterruptedRecovery = useCallback(async () => {
    const existing = loadRecoveryState();
    if (!existing) {
      setRecovery(null);
      return true;
    }
    setRecovery(existing);
    const live = await readOwnedSession();
    try {
      await signOut('recoveryAbort', {
        expectedUserId: existing.userId ?? live?.userId,
        expectedSessionId: live?.sessionId ?? '',
      });
      const current = loadRecoveryState();
      if (
        current &&
        current.email === existing.email &&
        current.phase === existing.phase &&
        current.userId === existing.userId
      ) {
        clearRecoveryState();
        setRecovery(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [signOut]);

  const applyApiUser = useCallback((user: ApiUser): boolean => {
    const txn = getActiveSignOutTransaction();
    if (
      !applyApiUserAllowed({
        txnStatus: txn?.status ?? null,
        expectedUserId: txn?.expectedUserId,
        incomingUserId: user.id,
        guestChosenInFlight: isGuestChosenInFlight(),
        ignoreCallbackCommit: shouldIgnoreAuthEventForCallbackCommit(
          user.email,
        ),
      })
    ) {
      return false;
    }
    accountSuspendedRef.current = false;
    setAccountSuspended(false);
    markAuthenticatedProcess();
    commitSignedOutReason('none');
    invalidateAuthCallbacks();
    setApiUser(user);
    setAccountType(user.accountType);
    setIsSignedIn(true);
    if (user.emailVerified && !isAuthenticatedProductActive()) {
      enterAuthenticatedProduct();
    }
    return true;
  }, [commitSignedOutReason]);

  const markAccountSuspended = useCallback(() => {
    invalidateReturnIntents();
    suspensionEpoch.current += 1;
    accountSuspendedRef.current = true;
    setAccountSuspended(true);
    setAuthError(null);
    lastHydrateErrorRef.current = null;
    setApiUser(null);
    setIsSignedIn(false);
  }, []);

  const sameLiveSubject = (requestToken: string, liveToken: string | null) => {
    if (!liveToken) return false;
    const requestSubject = accessTokenSubject(requestToken);
    const liveSubject = accessTokenSubject(liveToken);
    return Boolean(
      requestSubject && liveSubject && requestSubject === liveSubject,
    );
  };

  const captureRequestPrincipal = useCallback(() => {
    if (loadRecoveryState()) return null;
    const userId = hydrateSessionRef.current?.user?.id;
    if (!userId) return null;
    return { userId, epoch: authEpoch.current };
  }, []);

  const isRequestPrincipalCurrent = useCallback(
    (principal: { userId: string; epoch: number }) => {
      if (loadRecoveryState()) return false;
      return principalsEqual(principal, captureRequestPrincipal());
    },
    [captureRequestPrincipal],
  );

  const getAuthenticatedToken = useCallback(
    (
      principal: { userId: string; epoch: number },
      options?: { forceRefresh?: boolean; preferredToken?: string },
    ) =>
      acquireAuthenticatedToken({
        principal,
        preferredToken: options?.preferredToken,
        forceRefresh: options?.forceRefresh,
        isRecoveryActive: () => Boolean(loadRecoveryState()),
        currentPrincipal: captureRequestPrincipal,
        getSession: async () => {
          if (loadRecoveryState()) return null;
          const { data } = await supabase.auth.getSession();
          return data.session;
        },
        refreshSession: async () => {
          if (loadRecoveryState()) return null;
          const { data, error } = await supabase.auth.refreshSession();
          if (error || !data.session) return null;
          if (data.session.user.id !== principal.userId) return null;
          if (!principalsEqual(principal, captureRequestPrincipal())) {
            return null;
          }
          return data.session;
        },
      }),
    [captureRequestPrincipal],
  );

  registerAuthRequestRuntime({
    capturePrincipal: captureRequestPrincipal,
    isPrincipalCurrent: isRequestPrincipalCurrent,
    getAuthenticatedToken,
    isRecoveryActive: () => Boolean(loadRecoveryState()),
  });

  useEffect(() => {
    const stopAutoRefresh = registerSupabaseAutoRefreshLifecycle();
    return () => {
      registerAuthRequestRuntime(null);
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    return subscribeAccountSuspended(({ accessToken }) => {
      if (loadRecoveryState()) return;
      const current = hydrateSessionRef.current?.access_token;
      if (!current || !sameLiveSubject(accessToken, current)) return;
      markAccountSuspended();
    });
  }, [markAccountSuspended]);

  const mergeHydrateOverrides = (
    base: HydrateOverrides | undefined,
    next: HydrateOverrides | undefined,
  ): HydrateOverrides | undefined => {
    if (!base && !next) return undefined;
    if (!next) return base;
    if (!base) return next;
    const merged: HydrateOverrides = { ...base };
    (Object.keys(next) as (keyof HydrateOverrides)[]).forEach((key) => {
      if (next[key] !== undefined) {
        (merged as Record<string, unknown>)[key] = next[key];
      }
    });
    return merged;
  };

  /**
   * Restore Nest user for an active Supabase session.
   * Prefer GET /users/me; bootstrap once on 401 MAWAHIB_PROFILE_MISSING.
   * Never bootstrap on generic 401/404/403/5xx/network. Never treat mock data as identity.
   * Nest syncs emailVerified / phoneVerified from Supabase Auth (not client).
   *
   * Concurrent calls coalesce: later overrides merge into the in-flight work and
   * a follow-up pass runs if new overrides arrived mid-flight (no silent drop).
   *
   * Nest/network failures (non-401) keep the Supabase session, clear Nest identity,
   * and surface authError — MainTabs stays gated on apiUser.
   */
  const hydrateBackendUser = useCallback(
    async (
      active: Session | null,
      overrides?: HydrateOverrides,
    ): Promise<ApiUser | null> => {
      if (loadRecoveryState()) return null;
      if (!active) {
        hydrateSessionRef.current = null;
        hydrateOverridesRef.current = undefined;
        clearAuthenticatedState();
        return null;
      }
      if (isGuestChosenInFlight()) return null;
      if (shouldIgnoreAuthEventForCallbackCommit(active.user?.email)) {
        return null;
      }

      const previousUserId = hydrateSessionRef.current?.user?.id;
      if (previousUserId && previousUserId !== active.user.id) {
        authEpoch.current += 1;
        invalidateReturnIntents();
        accountSuspendedRef.current = false;
        setAccountSuspended(false);
        setApiUser(null);
        setIsSignedIn(false);
      }

      hydrateSessionRef.current = active;
      hydrateOverridesRef.current = mergeHydrateOverrides(
        hydrateOverridesRef.current,
        overrides,
      );
      if (
        shouldClearLogoutReasonForIncomingSession({
          reason: getSignedOutReason(),
          signedOutUserId: getSignedOutUserId(),
          incomingUserId: active.user.id,
          establishment: 'restore',
        })
      ) {
        commitSignedOutReason('none');
      }
      setSession(active);

      const runOnce = async (
        sessionSnap: Session,
        overridesSnap: HydrateOverrides | undefined,
      ): Promise<ApiUser | null> => {
        if (loadRecoveryState()) return null;
        const accessToken = sessionSnap.access_token;
        const epochAtStart = authEpoch.current;
        const generationAtStart = getSessionGeneration();
        const suspensionAtStart = suspensionEpoch.current;
        const isStale = (liveToken: string | null) =>
          shouldIgnoreStaleAuthResult({
            epochAtStart,
            epochNow: authEpoch.current,
            requestToken: accessToken,
            trackedToken: hydrateSessionRef.current?.access_token ?? null,
            liveToken,
          });
        try {
          let user: ApiUser;
          try {
            user = await authApi.getMe(accessToken);
          } catch (err) {
            if (isAccountSuspendedError(err)) {
              throw err;
            }
            if (!isMawahibProfileMissingError(err)) {
              throw err;
            }
            user = await authApi.bootstrap(
              bootstrapPayloadFromSession(sessionSnap, overridesSnap, {
                accountType: accountTypeRef.current,
                name: signUpBasicsRef.current?.name,
                email: signUpBasicsRef.current?.email,
                city: signUpBasicsRef.current?.city,
                countryCode: signUpBasicsRef.current?.countryCode,
                locationCode: signUpBasicsRef.current?.locationCode,
                phoneE164: signUpBasicsRef.current?.phoneE164,
              }),
              accessToken,
            );
          }
          lastHydrateErrorRef.current = null;
          if (loadRecoveryState()) return null;
          if (isStale(hydrateSessionRef.current?.access_token ?? null)) return null;
          // A 403 observed while this request was in flight is newer than this success.
          if (suspensionEpoch.current !== suspensionAtStart) return null;
          if (
            user.id !== sessionSnap.user.id ||
            hydrateSessionRef.current?.user?.id !== sessionSnap.user.id
          ) {
            return null;
          }
          if (shouldIgnoreAuthEventForCallbackCommit(user.email ?? sessionSnap.user?.email)) {
            return null;
          }
          if (!applyApiUser(user)) {
            return null;
          }
          if (isEmailConfirmed(sessionSnap) && user.emailVerified) {
            clearPendingSignup();
          }
          return user;
        } catch (err) {
          if (isStaleIdentityError(err)) {
            return null;
          }
          const { data: live } = await supabase.auth.getSession();
          const liveToken = live.session?.access_token ?? null;
          if (isStale(liveToken)) {
            if (live.session && liveToken && liveToken !== accessToken) {
              hydrateSessionRef.current = live.session;
            }
            return null;
          }
          if (isAccountSuspendedError(err)) {
            if (
              epochAtStart === authEpoch.current &&
              sameLiveSubject(accessToken, liveToken)
            ) {
              markAccountSuspended();
            }
            return null;
          }
          if (err instanceof ApiError && err.status === 401) {
            const { data: liveAfter401 } = await supabase.auth.getSession();
            if (liveAfter401.session?.access_token) {
              lastHydrateErrorRef.current = err.message;
              setAuthError(err.message);
              setApiUser(null);
              setIsSignedIn(false);
              return null;
            }
            try {
              await signOut('hydrate401', {
                generationAtCall: generationAtStart,
              });
            } catch {
              if (
                !shouldApplyHydrate401Expiry(
                  generationAtStart,
                  getSessionGeneration(),
                )
              ) {
                return null;
              }
              commitSignedOutReason('expired');
              clearAuthenticatedState();
              leaveAuthenticatedProduct({
                name: 'SignIn',
                params: { notice: 'session-expired' },
              });
            }
            lastHydrateErrorRef.current = err.message;
            return null;
          }
          // Keep Supabase session; Nest profile unavailable (5xx / network / down).
          const message =
            err instanceof Error ? err.message : 'Failed to restore session';
          lastHydrateErrorRef.current = message;
          setAuthError(message);
          setApiUser(null);
          setIsSignedIn(false);
          return null;
        }
      };

      const runCoalesced = async (): Promise<ApiUser | null> => {
        let last: ApiUser | null = null;
        for (;;) {
          const sessionSnap = hydrateSessionRef.current;
          if (!sessionSnap) {
            clearAuthenticatedState();
            return null;
          }
          const tokenAtStart = sessionSnap.access_token;
          const overridesSnap = hydrateOverridesRef.current;
          hydrateOverridesRef.current = undefined;
          last = await runOnce(sessionSnap, overridesSnap);

          const overridesPending =
            hydrateOverridesRef.current !== undefined;
          const sessionChanged =
            hydrateSessionRef.current?.access_token !== tokenAtStart;
          // Another caller queued bootstrap metadata — run again with merged data.
          if (overridesPending) continue;
          // Newer session arrived mid-flight (including A→B): re-run for the live session.
          if (sessionChanged) continue;
          return last;
        }
      };

      if (hydrateInFlight.current) {
        return hydrateInFlight.current;
      }
      const promise = runCoalesced().finally(() => {
        if (hydrateInFlight.current === promise) {
          hydrateInFlight.current = null;
        }
      });
      hydrateInFlight.current = promise;
      return promise;
    },
    [applyApiUser, clearAuthenticatedState, markAccountSuspended, signOut, commitSignedOutReason],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const pending = loadPendingSignup();
        if (pending && mounted) {
          setSignUpBasics({
            name: pending.displayName || '',
            email: pending.email,
            city: pending.city || '',
            countryCode: pending.countryCode as CountryCode | undefined,
            locationCode: pending.locationCode,
            phoneE164: pending.phoneE164 || '',
          });
          if (pending.accountType) {
            setAccountType(pending.accountType);
          }
        }
        if (loadRecoveryState()) {
          const discarded = await discardInterruptedRecovery();
          if (discarded && mounted) setRecoveryRestart(true);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;
          let session = data.session;
          if (session) {
            const refreshed = await supabase.auth.refreshSession();
            if (!mounted) return;
            if (!refreshed.error && refreshed.data.session) {
              session = refreshed.data.session;
            } else if (refreshed.error && !isAuthNetworkError(refreshed.error)) {
              session = null;
            }
          }
          await hydrateBackendUser(session);
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        const interpretation = interpretSignedOut({
          hadAuthenticatedProduct: wasAuthenticatedProcess(),
          recoveryLocked: Boolean(loadRecoveryState()),
          processStarted: hasConsumedProcessStart(),
        });
        if (!interpretation.apply) {
          clearAuthenticatedState();
          return;
        }
        applySignedOutOutcome(interpretation);
        return;
      }

      // Recovery OTP emits this instead of SIGNED_IN. Never hydrate it.
      if (event === 'PASSWORD_RECOVERY') {
        return;
      }

      if (loadRecoveryState()) {
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        if (next) hydrateSessionRef.current = next;
        return;
      }

      if (event === 'SIGNED_IN' && next) {
        const txn = getActiveSignOutTransaction();
        if (
          !applyApiUserAllowed({
            txnStatus: txn?.status ?? null,
            expectedUserId: txn?.expectedUserId,
            incomingUserId: next.user.id,
            guestChosenInFlight: isGuestChosenInFlight(),
            ignoreCallbackCommit: shouldIgnoreAuthEventForCallbackCommit(
              next.user?.email,
            ),
          })
        ) {
          return;
        }
        // Change-password reauth emits SIGNED_IN for the current account.
        // Hydrating here can clear apiUser on a Nest failure and reset to Sign In.
        if (suppressSameUserHydrateRef.current) {
          if (
            apiUserRef.current?.id &&
            next.user?.id === apiUserRef.current.id
          ) {
            setSession(next);
            hydrateSessionRef.current = next;
          }
          return;
        }
        commitCredentialSession({
          reason: getSignedOutReason(),
          setReasonNone: () => commitSignedOutReason('none'),
        });
        void hydrateBackendUser(next);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [
    applySignedOutOutcome,
    clearAuthenticatedState,
    discardInterruptedRecovery,
    hydrateBackendUser,
  ]);

  const resendSignupOtp = useCallback(async (email: string) => {
    setAuthError(null);
    const normalized = email.trim().toLowerCase();
    // ResendParams still use type: 'signup' for email confirmation resend.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalized,
    });
    if (error) {
      const message = mapAuthError(error);
      setAuthError(message);
      throw new Error(message);
    }
    // OTP was actually requested — stamp lastOtpRequestedAt.
    savePendingSignup(
      {
        email: normalized,
        phoneE164: signUpBasicsRef.current?.phoneE164,
        displayName: signUpBasicsRef.current?.name,
        accountType: accountTypeRef.current || undefined,
        countryCode: signUpBasicsRef.current?.countryCode,
        locationCode: signUpBasicsRef.current?.locationCode,
        city: signUpBasicsRef.current?.city,
      },
      { otpRequested: true },
    );
  }, []);

  const resumeEmailVerification = useCallback(
    async (email: string) => {
      await resendSignupOtp(email.trim().toLowerCase());
    },
    [resendSignupOtp],
  );

  const registerWithEmail = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      firstName?: string;
      lastName?: string;
      city: string;
      countryCode?: CountryCode;
      locationCode?: string;
      phoneE164: string;
      accountType: AccountType;
    }): Promise<RegisterEmailResult> => {
      setAuthError(null);
      if (loadRecoveryState()) {
        throw new PasswordFlowError(
          'Password reset is in progress.',
          'unavailable',
        );
      }
      if (!isPasswordValid(input.password)) {
        const message =
          'Password must be at least 8 characters and include upper, lower, number, and special character.';
        setAuthError(message);
        throw new Error(message);
      }

      const basics: SignUpBasics = {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        city: input.city.trim(),
        countryCode: input.countryCode,
        locationCode: input.locationCode,
        phoneE164: input.phoneE164,
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
      };

      // OTP-first: do not set emailRedirectTo — confirmation links are fallback only.
      const { data, error } = await enqueueAuthMutation(async () => {
        if (loadRecoveryState()) {
          throw new PasswordFlowError(
            'Password reset is in progress.',
            'unavailable',
          );
        }
        const result = await supabase.auth.signUp({
          email: basics.email,
          password: input.password,
          options: {
            data: {
              display_name: basics.name,
              first_name: basics.firstName || undefined,
              last_name: basics.lastName || undefined,
              city: basics.city,
              country_code: input.countryCode,
              location_code: input.locationCode,
              account_type: input.accountType,
              phone_e164: input.phoneE164,
            },
          },
        });
        await settleEstablishedCredential(result.data.session, () => {
          commitCredentialSession({
            reason: getSignedOutReason(),
            setReasonNone: () => commitSignedOutReason('none'),
          });
        });
        return result;
      });

      if (error) {
        const lower = error.message.toLowerCase();
        const code =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof (error as { code?: string }).code === 'string'
            ? (error as { code: string }).code.toLowerCase()
            : '';
        const already =
          code === 'user_already_exists' ||
          code === 'email_exists' ||
          lower.includes('already registered') ||
          lower.includes('already been registered') ||
          lower.includes('user already registered') ||
          lower.includes('email address is already');

        if (already) {
          // Do not claim an OTP was sent. Offer Login / Continue Verification / Change Email.
          setAccountType(input.accountType);
          setSignUpBasics(basics);
          return { status: 'ambiguous' };
        }
        const message = mapAuthError(error);
        setAuthError(message);
        throw new Error(message);
      }

      // Supabase anti-enumeration: existing *confirmed* email → fake user, identities: [].
      // No confirmation email is sent in this case — do not open ConfirmCode.
      const identities = data.user?.identities ?? null;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        setAccountType(input.accountType);
        setSignUpBasics(basics);
        return { status: 'already_verified' };
      }

      setAccountType(input.accountType);
      setSignUpBasics(basics);

      if (data.session) {
        stampPendingSignupFromSession(data.session, { createIfMissing: true });
        const fields =
          input.countryCode && input.locationCode
            ? locationDisplayFields(input.countryCode, input.locationCode)
            : null;
        const user = await hydrateBackendUser(data.session, {
          accountType: input.accountType,
          displayName: basics.name,
          locationCity: fields?.locationCity ?? basics.city,
          locationCountry: fields?.locationCountry,
          countryCode: fields?.countryCode ?? input.countryCode,
          locationCode: fields?.locationCode ?? input.locationCode,
          phoneE164: input.phoneE164,
        });
        if (!user) {
          if (accountSuspendedRef.current) {
            throw new AuthFailure(
              'account_suspended',
              'This account is suspended.',
            );
          }
          if (getActiveSignOutTransaction()?.status === 'started') {
            const message = 'Sign-in was interrupted. Try again.';
            setAuthError(message);
            throw new AuthFailure('superseded', message);
          }
          const detail =
            lastHydrateErrorRef.current || 'Nest /users/me or bootstrap failed';
          const message = `Signed up but failed to load profile: ${detail}`;
          setAuthError(message);
          throw new AuthFailure('backend_hydration', message, detail);
        }
        clearPendingSignup();
        return { status: 'session_ready', user };
      }

      if (!data.user) {
        const message =
          'Could not start signup. Try again or use a different email.';
        setAuthError(message);
        throw new Error(message);
      }

      // Fresh signup (or unverified identity returned with identities) — OTP email sent.
      savePendingSignup(
        {
          email: basics.email,
          phoneE164: basics.phoneE164,
          displayName: basics.name,
          accountType: input.accountType,
          countryCode: input.countryCode,
          locationCode: input.locationCode,
          city: basics.city,
        },
        { otpRequested: true },
      );
      return { status: 'otp_sent', kind: 'fresh' };
    },
    [hydrateBackendUser],
  );

  const verifySignupOtp = useCallback(
    async (email: string, token: string) => {
      setAuthError(null);
      if (loadRecoveryState()) {
        throw new PasswordFlowError(
          'Password reset is in progress.',
          'unavailable',
        );
      }
      // Installed @supabase/supabase-js: EmailOtpType includes 'email' and deprecated 'signup'.
      // Prefer 'email' for signup OTP verification (current SDK guidance).
      const { data, error } = await enqueueAuthMutation(async () => {
        if (loadRecoveryState()) {
          throw new PasswordFlowError(
            'Password reset is in progress.',
            'unavailable',
          );
        }
        const result = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: 'email',
        });
        await settleEstablishedCredential(result.data.session, () => {
          commitCredentialSession({
            reason: getSignedOutReason(),
            setReasonNone: () => commitSignedOutReason('none'),
          });
        });
        return result;
      });
      if (error) {
        const message = mapAuthError(error);
        setAuthError(message);
        throw new AuthFailure('email_otp', message);
      }
      if (!data.session) {
        const message = 'Verification succeeded but no session was returned.';
        setAuthError(message);
        throw new AuthFailure('email_otp', message);
      }
      stampPendingSignupFromSession(data.session, { createIfMissing: true });
      const user = await hydrateBackendUser(data.session);
      if (!user) {
        if (accountSuspendedRef.current) {
          throw new AuthFailure(
            'account_suspended',
            'This account is suspended.',
          );
        }
        if (getActiveSignOutTransaction()?.status === 'started') {
          const message = 'Sign-in was interrupted. Try again.';
          setAuthError(message);
          throw new AuthFailure('superseded', message);
        }
        const detail =
          lastHydrateErrorRef.current || 'Nest /users/me or bootstrap failed';
        const message = `Email verified but failed to load profile: ${detail}`;
        setAuthError(message);
        throw new AuthFailure('backend_hydration', message, detail);
      }
      clearPendingSignup();
      return user;
    },
    [hydrateBackendUser],
  );

  const sendPhoneOtp = useCallback(async (phone: string) => {
    setAuthError(null);
    if (!appEnv.phoneAuthEnabled) {
      const message =
        'SMS verification is not yet enabled. Configure a Supabase phone provider, then set EXPO_PUBLIC_PHONE_AUTH_ENABLED=true.';
      setAuthError(message);
      throw new Error(message);
    }
    const normalized = phone.trim();
    const {
      data: { session: active },
    } = await supabase.auth.getSession();
    if (!active) {
      const message =
        'Sign in and verify email first, then verify phone on the same account.';
      setAuthError(message);
      throw new Error(message);
    }
    // Attach phone to the existing Supabase user (no second auth.users row).
    const { error } = await supabase.auth.updateUser({ phone: normalized });
    if (error) {
      const message = mapAuthError(error);
      setAuthError(message);
      throw new Error(message);
    }
  }, []);

  const verifyPhoneOtp = useCallback(
    async (phone: string, token: string) => {
      setAuthError(null);
      if (!appEnv.phoneAuthEnabled) {
        const message =
          'SMS verification is not yet enabled. Configure a Supabase phone provider first.';
        setAuthError(message);
        throw new AuthFailure('phone_otp', message);
      }
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: token.trim(),
        type: 'phone_change',
      });
      if (error) {
        const message = mapAuthError(error);
        setAuthError(message);
        throw new AuthFailure('phone_otp', message);
      }
      const user = await hydrateBackendUser(data.session);
      if (!user) {
        if (accountSuspendedRef.current) {
          throw new AuthFailure(
            'account_suspended',
            'This account is suspended.',
          );
        }
        const detail =
          lastHydrateErrorRef.current || 'Nest /users/me failed';
        const message = `Phone verified but failed to load profile: ${detail}`;
        setAuthError(message);
        throw new AuthFailure('backend_hydration', message, detail);
      }
      return user;
    },
    [hydrateBackendUser],
  );

  const bootstrapSession = useCallback(
    async (input?: {
      accountType?: AccountType;
      displayName?: string;
      locationCity?: string;
      locationCountry?: string;
      countryCode?: CountryCode;
      locationCode?: string;
      phoneE164?: string;
    }) => {
      if (loadRecoveryState()) {
        throw new PasswordFlowError(
          'Password reset is in progress.',
          'unavailable',
        );
      }
      setAuthError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const active = sessionData.session;
      if (!active) {
        throw new Error('No active session — sign in again');
      }
      const user = await hydrateBackendUser(active, {
        ...input,
        phoneE164: input?.phoneE164 ?? signUpBasicsRef.current?.phoneE164,
      });
      if (!user) {
        if (accountSuspendedRef.current) {
          throw new AuthFailure(
            'account_suspended',
            'This account is suspended.',
          );
        }
        throw new AuthFailure(
          'backend_hydration',
          lastHydrateErrorRef.current || 'Failed to bootstrap session',
        );
      }
      return user;
    },
    [hydrateBackendUser],
  );

  const refreshMe = useCallback(async (accessToken?: string) => {
    if (loadRecoveryState()) {
      throw new PasswordFlowError(
        'Password reset is in progress.',
        'unavailable',
      );
    }
    const epoch = authEpoch.current;
    const suspensionAtStart = suspensionEpoch.current;
    const user = await authApi.getMe(accessToken);
    if (epoch !== authEpoch.current) return user;
    if (suspensionEpoch.current !== suspensionAtStart) return user;
    if (accessToken) {
      const tracked = hydrateSessionRef.current?.access_token ?? null;
      if (
        shouldIgnoreStaleAuthResult({
          epochAtStart: epoch,
          epochNow: authEpoch.current,
          requestToken: accessToken,
          trackedToken: tracked,
          liveToken: tracked,
        })
      ) {
        return user;
      }
    }
    if (!applyApiUser(user)) {
      if (getActiveSignOutTransaction()?.status === 'started') {
        throw new AuthFailure(
          'superseded',
          'Sign-in was interrupted. Try again.',
        );
      }
      return user;
    }
    return user;
  }, [applyApiUser]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      invalidateAuthCallbacks();
      setAuthError(null);
      lastHydrateErrorRef.current = null;
      if (loadRecoveryState()) {
        throw new PasswordFlowError(
          'Password reset is in progress.',
          'unavailable',
        );
      }
      const { data, error } = await enqueueAuthMutation(async () => {
        if (loadRecoveryState()) {
          throw new PasswordFlowError(
            'Password reset is in progress.',
            'unavailable',
          );
        }
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        await settleEstablishedCredential(result.data.session, () => {
          commitCredentialSession({
            reason: getSignedOutReason(),
            setReasonNone: () => commitSignedOutReason('none'),
          });
        });
        return result;
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes('email not confirmed') ||
          lower.includes('email_not_confirmed')
        ) {
          // Do NOT stamp lastOtpRequestedAt — no OTP was sent by this failure.
          // SignInScreen may attempt a legitimate resend before ConfirmCode.
          const message = mapAuthError(error);
          setAuthError(message);
          const err = new Error(message) as Error & {
            code?: string;
            needsEmailConfirmation?: boolean;
          };
          err.code = 'email_not_confirmed';
          err.needsEmailConfirmation = true;
          throw err;
        }
        const message = mapAuthError(error);
        setAuthError(message);
        throw new Error(message);
      }
      if (!data.session?.access_token) {
        const message = 'Signed in but no session token was returned';
        setAuthError(message);
        throw new Error(message);
      }
      stampPendingSignupFromSession(data.session);
      const user = await hydrateBackendUser(data.session);
      if (!user) {
        if (accountSuspendedRef.current) {
          throw new AuthFailure(
            'account_suspended',
            'This account is suspended.',
          );
        }
        if (getActiveSignOutTransaction()?.status === 'started') {
          const message = 'Sign-in was interrupted. Try again.';
          setAuthError(message);
          throw new AuthFailure('superseded', message);
        }
        const detail =
          lastHydrateErrorRef.current ||
          'Nest /users/me failed after Supabase sign-in';
        const message = `Signed in but failed to load profile: ${detail}`;
        setAuthError(message);
        throw new AuthFailure('backend_hydration', message, detail);
      }
      clearPendingSignup();
      return user;
    },
    [hydrateBackendUser],
  );

  const completeSignUp = useCallback(() => {
    setIsSignedIn(Boolean(apiUser));
  }, [apiUser]);

  const signIn = useCallback(() => {
    setIsSignedIn(Boolean(apiUser));
  }, [apiUser]);

  const recheckAccountStatus = useCallback(async () => {
    if (loadRecoveryState()) return;
    const { data } = await supabase.auth.getSession();
    await hydrateBackendUser(data.session);
  }, [hydrateBackendUser]);

  const continueAsGuest = useCallback(async () => {
    if (getSignedOutReason() !== 'expired') return false;
    invalidateAuthCallbacks();
    if (isCallbackSessionCommitInFlight()) return false;
    if (getActiveSignOutTransaction()?.status === 'started') return false;
    beginGuestChosen();
    try {
      const first = await supabase.auth.getSession();
      if (first.data.session) return false;
      if (isCallbackSessionCommitInFlight()) return false;
      const second = await supabase.auth.getSession();
      if (second.data.session) return false;
      commitSignedOutReason('guestChosen', null);
      clearAuthenticatedProcess();
      invalidateReturnIntents();
      invalidateAuthCallbacks();
      enterSignedOutAt({ name: 'GuestTabs' });
      resetToSignedOut('GuestTabs');
      return true;
    } finally {
      endGuestChosen();
    }
  }, [commitSignedOutReason]);

  const completePasswordReset = useCallback(
    async (password: string) => {
      if (!isPasswordValid(password)) {
        throw new PasswordFlowError(
          'Password must be at least 8 characters and include upper, lower, number, and special character.',
          'validation',
        );
      }
      const recoveryLock = loadRecoveryState();
      if (
        !recoveryLock ||
        recoveryLock.phase !== 'recovery-session' ||
        !recoveryLock.userId
      ) {
        throw new PasswordFlowError(
          'Password reset is no longer active. Request a new code.',
          'unavailable',
        );
      }
      const status = await joinOrStartSignOut(
        signOutInflightKey('recoveryComplete', recoveryLock.userId),
        () =>
          enqueueAuthMutation(() =>
            runRecoveryCompletion({
              readLock: () => {
                const lock = loadRecoveryState();
                if (
                  !lock ||
                  lock.phase !== 'recovery-session' ||
                  !lock.userId
                ) {
                  return null;
                }
                return {
                  email: lock.email,
                  userId: lock.userId,
                  phase: 'recovery-session',
                };
              },
              readLive: readOwnedSession,
              updatePassword: () => updatePassword(password),
              clearSuccessNotice: () => {
                clearSignOutNotice(getActiveSignOutTransaction()?.id);
              },
              signOutGlobal: async () => {
                try {
                  const result = await supabase.auth.signOut({ scope: 'global' });
                  return Boolean(result.error);
                } catch {
                  return true;
                }
              },
              signOutLocal: async () => {
                try {
                  const result = await supabase.auth.signOut({ scope: 'local' });
                  return Boolean(result.error);
                } catch {
                  return true;
                }
              },
              prepareCache: async () => {
                invalidateAuthCallbacks();
                const marked = markMediaCacheClearPending();
                if (marked.ok) return true;
                try {
                  await clearMediaImageCache();
                  return true;
                } catch {
                  return false;
                }
              },
              clearLockIfSame: (lock) => {
                const current = loadRecoveryState();
                if (
                  current?.phase === 'recovery-session' &&
                  current.userId === lock.userId &&
                  current.email === lock.email
                ) {
                  clearRecoveryState();
                  setRecovery(null);
                }
              },
              begin: beginSignOutTransaction,
              fail: (id) => {
                failSignOutTransaction(id);
              },
              clear: clearSignOutTransaction,
              getActive: getActiveSignOutTransaction,
              hasInflight: hasSignOutInflight,
              inflightKey: signOutInflightKey,
              onSignedOut: () => {
                if (getActiveSignOutTransaction()?.status !== 'started') return;
                applySignedOutOutcome(
                  interpretSignedOut({
                    hadAuthenticatedProduct: wasAuthenticatedProcess(),
                    recoveryLocked: Boolean(loadRecoveryState()),
                    processStarted: hasConsumedProcessStart(),
                  }),
                );
              },
            }),
          ),
      );
      return { status };
    },
    [applySignedOutOutcome],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!isPasswordValid(newPassword)) {
        throw new PasswordFlowError(
          'Password must be at least 8 characters and include upper, lower, number, and special character.',
          'validation',
        );
      }
      return runPasswordChange({
        recoveryLocked: () => Boolean(loadRecoveryState()),
        readLive: readOwnedSession,
        signIn: async (email) => {
          const signedIn = await supabase.auth.signInWithPassword({
            email,
            password: currentPassword,
          });
          if (signedIn.error) {
            const lower = signedIn.error.message.toLowerCase();
            if (
              lower.includes('invalid login') ||
              lower.includes('invalid credentials')
            ) {
              throw new PasswordFlowError(
                'Current password is incorrect.',
                'current-password',
              );
            }
            if (
              lower.includes('network') ||
              lower.includes('failed to fetch') ||
              lower.includes('network request failed')
            ) {
              throw new PasswordFlowError(
                'Network error. Check your connection and try again.',
                'network',
              );
            }
            throw new PasswordFlowError(
              mapAuthError(signedIn.error),
              'current-password',
            );
          }
          const session = signedIn.data.session;
          if (!session?.user?.id || !session.access_token) return null;
          return ownedSession({
            userId: session.user.id,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
          });
        },
        updatePassword: () => updatePassword(newPassword, currentPassword),
        signOutOthers: async () => {
          try {
            const others = await supabase.auth.signOut({ scope: 'others' });
            return !others.error;
          } catch {
            return false;
          }
        },
        signOutLocal: async () => {
          await supabase.auth.signOut({ scope: 'local' });
        },
        suppressHydrate: (on) => {
          suppressSameUserHydrateRef.current = on;
        },
        enqueue: enqueueAuthMutation,
        raise: raisePasswordFlow,
        currentGeneration: () => getSessionGeneration(),
      });
    },
    [],
  );

  const retryOtherDeviceSignOut = useCallback(
    (expected: { userId: string; sessionId: string; generation: number }) => {
      return runOtherSessionSignOut({
        expectedUserId: expected.userId,
        expectedSessionId: expected.sessionId,
        generationAtCall: expected.generation,
        currentGeneration: () => getSessionGeneration(),
        readLive: () => readOwnedSession(),
        recoveryLocked: () => Boolean(loadRecoveryState()),
        signOutOthers: async () => {
          try {
            const others = await supabase.auth.signOut({ scope: 'others' });
            return !others.error;
          } catch {
            return false;
          }
        },
        enqueue: enqueueAuthMutation,
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      accountType,
      setAccountType,
      isSignedIn: isSignedIn && Boolean(apiUser) && !recovery,
      session,
      accessToken: recovery ? null : (session?.access_token ?? null),
      apiUser,
      mappedUser: apiUser ? mapApiUserToUser(apiUser) : null,
      signUpBasics,
      setSignUpBasics,
      authLoading,
      authError,
      clearAuthError,
      logoutFailureNotice,
      clearLogoutFailureNotice,
      mediaCacheReady,
      mediaCacheBlocked,
      retryMediaCache,
      accountSuspended,
      recheckAccountStatus,
      registerWithEmail,
      verifySignupOtp,
      resendSignupOtp,
      sendPhoneOtp,
      verifyPhoneOtp,
      bootstrapSession,
      refreshMe,
      signInWithEmail,
      resumeEmailVerification,
      completeSignUp,
      signIn,
      signOut,
      signedOutReason,
      continueAsGuest,
      recovery,
      recoveryRestart,
      armRecoveryVerification,
      commitRecoverySession,
      clearRecoveryLock,
      discardInterruptedRecovery,
      completePasswordReset,
      changePassword,
      retryOtherDeviceSignOut,
    }),
    [
      accountType,
      isSignedIn,
      session,
      apiUser,
      recovery,
      recoveryRestart,
      signUpBasics,
      authLoading,
      authError,
      logoutFailureNotice,
      mediaCacheReady,
      mediaCacheBlocked,
      retryMediaCache,
      accountSuspended,
      clearAuthError,
      clearLogoutFailureNotice,
      recheckAccountStatus,
      registerWithEmail,
      verifySignupOtp,
      resendSignupOtp,
      sendPhoneOtp,
      verifyPhoneOtp,
      bootstrapSession,
      refreshMe,
      signInWithEmail,
      resumeEmailVerification,
      completeSignUp,
      signIn,
      signOut,
      signedOutReason,
      continueAsGuest,
      armRecoveryVerification,
      commitRecoverySession,
      clearRecoveryLock,
      discardInterruptedRecovery,
      completePasswordReset,
      changePassword,
      retryOtherDeviceSignOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
