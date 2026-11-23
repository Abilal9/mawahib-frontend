import { t } from '../i18n/runtime';

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
      return t('auth.suspendedTitle');
    }
    if (error.kind === 'backend_hydration') {
      return t('auth.signedInProfileFailed');
    }
    if (error.kind === 'superseded') {
      return t('auth.signInInterrupted');
    }
    if (error.kind === 'phone_otp') {
      return t('auth.phoneVerifyFailed');
    }
    return t('auth.codeNotValid');
  }
  return t('auth.verificationFailed');
}
