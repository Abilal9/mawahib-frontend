/**
 * Distinguish Supabase Auth failures from Nest hydration/bootstrap failures.
 */

export type AuthFailureKind =
  | 'email_otp'
  | 'phone_otp'
  | 'backend_hydration'
  | 'account_suspended'
  | 'superseded';

export class AuthFailure extends Error {
  readonly kind: AuthFailureKind;
  readonly causeMessage?: string;

  constructor(kind: AuthFailureKind, message: string, causeMessage?: string) {
    super(message);
    this.name = 'AuthFailure';
    this.kind = kind;
    this.causeMessage = causeMessage;
  }
}

export function isAuthFailure(error: unknown): error is AuthFailure {
  return error instanceof AuthFailure;
}

export function isAccountSuspendedFailure(error: unknown): boolean {
  return isAuthFailure(error) && error.kind === 'account_suspended';
}

export function authFailureTitle(error: unknown): string {
  if (isAuthFailure(error)) {
    if (error.kind === 'account_suspended') {
      return 'Account suspended';
    }
    if (error.kind === 'backend_hydration') {
      return 'Signed in, but profile failed';
    }
    if (error.kind === 'superseded') {
      return 'Sign-in interrupted';
    }
    if (error.kind === 'phone_otp') {
      return 'Phone verification failed';
    }
    return 'Verification code not valid';
  }
  return 'Verification failed';
}
