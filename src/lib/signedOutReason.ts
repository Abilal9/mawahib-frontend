/**
 * Process-memory signed-out reason. Never persisted.
 * A future cold start with no session is always `none` → Guest Home.
 */

export type SignedOutReason = 'none' | 'logout' | 'expired' | 'guestChosen';

let reason: SignedOutReason = 'none';
let signedOutUserId: string | null = null;
let hadAuthenticatedProduct = false;
let guestChosenInFlight = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSignedOutReason(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSignedOutReason(): SignedOutReason {
  return reason;
}

export function getSignedOutUserId(): string | null {
  return signedOutUserId;
}

export function setSignedOutReason(
  next: SignedOutReason,
  userId?: string | null,
): void {
  reason = next;
  if (next === 'logout' || next === 'guestChosen') {
    if (userId !== undefined) signedOutUserId = userId;
  } else {
    signedOutUserId = null;
  }
  emit();
}

export function markAuthenticatedProcess(): void {
  hadAuthenticatedProduct = true;
}

export function clearAuthenticatedProcess(): void {
  hadAuthenticatedProduct = false;
}

export function wasAuthenticatedProcess(): boolean {
  return hadAuthenticatedProduct;
}

export function beginGuestChosen(): void {
  guestChosenInFlight = true;
}

export function endGuestChosen(): void {
  guestChosenInFlight = false;
}

export function isGuestChosenInFlight(): boolean {
  return guestChosenInFlight;
}

export function resetSignedOutReasonForTests(): void {
  reason = 'none';
  signedOutUserId = null;
  hadAuthenticatedProduct = false;
  guestChosenInFlight = false;
  listeners.clear();
}

export function signedOutDestinationName(input: {
  reason?: SignedOutReason;
  recoveryLocked?: boolean;
}): 'GuestTabs' | 'SignIn' {
  if (input.recoveryLocked) return 'SignIn';
  const current = input.reason ?? reason;
  if (current === 'expired') return 'SignIn';
  return 'GuestTabs';
}
