/**
 * Non-sensitive pending email-verification context.
 * Persists across app/Metro restarts so abandoned signup can resume.
 * Never store passwords or OTP tokens here.
 *
 * `lastOtpRequestedAt` is set ONLY after a successful signup/resend OTP request
 * (see `otpRequested: true`). Never stamp it for email_not_confirmed alone.
 *
 * `userId` is sticky. It may only be stamped from a real `session.user.id`.
 * Later saves merge; omitted/null/conflicting userId cannot erase it.
 */
export type PendingSignup = {
  email: string;
  phoneE164?: string;
  displayName?: string;
  accountType?: 'talent' | 'business';
  countryCode?: string;
  locationCode?: string;
  city?: string;
  createdAt: number;
  /** Wall time of last successful OTP send/resend. Absent = no successful send recorded. */
  lastOtpRequestedAt?: number;
  /** Real authenticated Supabase user id. Sticky until clearPendingSignup(). */
  userId?: string;
};

const STORAGE_KEY = 'mawahib.pendingSignup.v1';

/** How long we treat a successful OTP request as resumable without a new send. */
export const RESUMABLE_OTP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function normalizeSignupEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export type SavePendingOptions = {
  /**
   * When true, records lastOtpRequestedAt=now (successful signup/resend).
   * When false/omitted, preserves existing lastOtpRequestedAt and never invents one.
   */
  otpRequested?: boolean;
};

export type PendingSignupWrite = {
  email: string;
  phoneE164?: string;
  displayName?: string;
  accountType?: 'talent' | 'business';
  countryCode?: string;
  locationCode?: string;
  city?: string;
  createdAt?: number;
  userId?: string | null;
};

function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function stickyUserId(
  existing: string | undefined,
  incoming: string | null | undefined,
): string | undefined {
  if (existing) {
    return existing;
  }
  if (typeof incoming === 'string' && incoming.trim()) {
    return incoming.trim();
  }
  return undefined;
}

function pickField<T>(incoming: T | undefined, previous: T | undefined): T | undefined {
  return incoming !== undefined ? incoming : previous;
}

/**
 * Persist non-sensitive signup context.
 * Merges with the existing record for the same email. A different email is a
 * new signup flow and does not inherit userId or previous fields.
 * Does not claim an OTP was sent unless `otpRequested: true`.
 * Once `userId` exists for that email it is immutable here.
 */
export function savePendingSignup(
  pending: PendingSignupWrite,
  options: SavePendingOptions = {},
): void {
  if (!storageAvailable()) return;
  const now = Date.now();
  const existing = loadPendingSignup();
  const email = normalizeSignupEmail(pending.email);
  if (!email) return;

  // A different email is a new signup flow, not a merge into the previous binding.
  const sameFlow =
    existing && normalizeSignupEmail(existing.email) === email ? existing : null;
  const userId = stickyUserId(sameFlow?.userId, pending.userId);
  let lastOtpRequestedAt: number | undefined = sameFlow?.lastOtpRequestedAt;
  if (options.otpRequested) {
    lastOtpRequestedAt = now;
  }

  const payload: PendingSignup = {
    email,
    phoneE164: pickField(pending.phoneE164, sameFlow?.phoneE164),
    displayName: pickField(pending.displayName, sameFlow?.displayName),
    accountType: pickField(pending.accountType, sameFlow?.accountType),
    countryCode: pickField(pending.countryCode, sameFlow?.countryCode),
    locationCode: pickField(pending.locationCode, sameFlow?.locationCode),
    city: pickField(pending.city, sameFlow?.city),
    createdAt: pending.createdAt ?? sameFlow?.createdAt ?? now,
    ...(lastOtpRequestedAt !== undefined ? { lastOtpRequestedAt } : {}),
    ...(userId ? { userId } : {}),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPendingSignup(): PendingSignup | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.email || typeof parsed.email !== 'string') return null;
    const maxAgeMs = 14 * 24 * 60 * 60 * 1000;
    if (parsed.createdAt && Date.now() - parsed.createdAt > maxAgeMs) {
      clearPendingSignup();
      return null;
    }
    const userId = asOptionalText(parsed.userId);
    return userId ? { ...parsed, userId } : { ...parsed, userId: undefined };
  } catch {
    return null;
  }
}

/**
 * True only when this email has a recorded successful OTP send/resend within the window.
 * Does NOT treat bare createdAt as proof of delivery.
 */
export function hasResumablePendingVerification(email: string): boolean {
  const pending = loadPendingSignup();
  if (!pending) return false;
  if (pending.email !== normalizeSignupEmail(email)) return false;
  const at = pending.lastOtpRequestedAt;
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  return Date.now() - at <= RESUMABLE_OTP_WINDOW_MS;
}

/**
 * Bind pending signup to a real authenticated session user id.
 * Never call this with `signUp().data.user` unless that user has a session.
 */
export function stampPendingSignupFromSession(
  session: { user?: { id?: string | null; email?: string | null } | null },
  options: { createIfMissing?: boolean } = {},
): void {
  const userId = session.user?.id?.trim();
  const email = normalizeSignupEmail(session.user?.email);
  if (!userId) return;

  const existing = loadPendingSignup();
  if (!existing) {
    if (!options.createIfMissing || !email) return;
    savePendingSignup({ email, userId });
    return;
  }

  const pendingEmail = normalizeSignupEmail(existing.email);
  if (existing.userId && existing.userId !== userId) {
    clearPendingSignup();
    return;
  }
  if (pendingEmail && email && pendingEmail !== email) {
    clearPendingSignup();
    return;
  }
  if (!existing.userId && (!pendingEmail || !email || pendingEmail !== email)) {
    return;
  }

  savePendingSignup({
    email: existing.email,
    userId,
  });
}

/**
 * Local signup fallbacks (phone/location/account type) may be used only when
 * pendingSignup.userId matches the session user, or — before a userId exists —
 * both normalized emails are non-empty and equal.
 */
export function sessionAllowsSignupFallbacks(input: {
  userId: string;
  email?: string | null;
  basicsEmail?: string | null;
}): boolean {
  const pending = loadPendingSignup();
  if (!pending) return false;
  const sessionEmail = normalizeSignupEmail(input.email);
  const basicsEmail = normalizeSignupEmail(input.basicsEmail);
  if (basicsEmail && sessionEmail && basicsEmail !== sessionEmail) {
    return false;
  }
  const pendingEmail = normalizeSignupEmail(pending.email);
  if (pending.userId) {
    if (pending.userId !== input.userId) return false;
    if (pendingEmail && sessionEmail && pendingEmail !== sessionEmail) {
      return false;
    }
    return true;
  }
  if (!pendingEmail || !sessionEmail) return false;
  return pendingEmail === sessionEmail;
}

export function clearPendingSignup(): void {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
