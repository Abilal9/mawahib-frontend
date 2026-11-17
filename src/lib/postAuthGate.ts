import type { Session } from '@supabase/supabase-js';
import type { ApiUser } from '../services/authApi';
import type { SignUpBasics } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

export type PostAuthFlow = 'verify' | 'signin' | 'restore' | 'deeplink';

/** A collected phone still has to be shown the verification step. */
export function phoneVerificationPending(input: {
  phoneE164?: string | null;
  phoneVerified?: boolean | null;
}): boolean {
  return Boolean(input.phoneE164?.trim()) && input.phoneVerified !== true;
}

/**
 * Verified email may enter the app on sign-in and session restore.
 * Fresh verification and verification deep links stay on the signed-out
 * onboarding stack until that flow finishes. An unverified phone does not
 * block a later sign-in or reload.
 */
export function shouldEnterAuthenticatedProduct(input: {
  emailVerified: boolean;
  flow?: PostAuthFlow | null;
}): boolean {
  if (!input.emailVerified) return false;
  if (input.flow === 'verify' || input.flow === 'deeplink') return false;
  return true;
}

export type PostAuthDestination = {
  [K in keyof RootStackParamList]: {
    name: K;
    params?: RootStackParamList[K];
  };
}[keyof RootStackParamList];

function normalizedEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Signup drafts belong to one user id. A draft for a different id, including
 * a new registration of the same email, must not supply this account's phone.
 */
export function phoneForPostAuth(input: {
  apiUser: ApiUser | null;
  signUpBasics?: SignUpBasics | null;
  pendingPhoneE164?: string | null;
  pendingUserId?: string | null;
  pendingEmail?: string | null;
}): string {
  const profilePhone = input.apiUser?.phoneE164?.trim() || '';
  if (profilePhone) return profilePhone;

  const pendingUserId = input.pendingUserId?.trim() || '';
  const apiUserId = input.apiUser?.id?.trim() || '';
  if (pendingUserId && apiUserId && pendingUserId !== apiUserId) return '';

  const draftPhone =
    input.signUpBasics?.phoneE164?.trim() ||
    input.pendingPhoneE164?.trim() ||
    '';
  if (!draftPhone) return '';

  const apiEmail = normalizedEmail(
    input.apiUser?.email || input.signUpBasics?.email,
  );
  const draftEmail = normalizedEmail(
    input.signUpBasics?.email || input.pendingEmail,
  );
  if (apiEmail && draftEmail && apiEmail !== draftEmail) return '';
  if (pendingUserId && !apiUserId) return '';
  return draftPhone;
}

/**
 * Single post-auth navigation decision for OTP, deep-link, sign-in, and splash restore.
 * OTP / deep-link success must not independently bypass email or onboarding rules.
 */
export function resolvePostAuthDestination(input: {
  flow: PostAuthFlow;
  apiUser: ApiUser | null;
  session: Session | null;
  signUpBasics?: SignUpBasics | null;
  pendingEmail?: string | null;
  pendingPhoneE164?: string | null;
  pendingUserId?: string | null;
}): PostAuthDestination {
  const email =
    input.apiUser?.email ||
    input.session?.user?.email ||
    input.signUpBasics?.email ||
    input.pendingEmail ||
    '';
  const emailVerified = Boolean(
    input.apiUser?.emailVerified ||
      input.session?.user?.email_confirmed_at ||
      input.session?.user?.confirmed_at,
  );

  if (!emailVerified) {
    if (email) {
      return { name: 'ConfirmCode', params: { email } };
    }
    return { name: 'SignIn' };
  }

  // Optional phone is part of this signup only. Later sign-in and reload enter Home.
  if (input.flow === 'verify' || input.flow === 'deeplink') {
    const phoneE164 = phoneForPostAuth(input);
    if (
      phoneVerificationPending({
        phoneE164,
        phoneVerified: input.apiUser?.phoneVerified,
      })
    ) {
      return {
        name: 'VerifyAccount',
        params: { email: email || input.apiUser?.email || '', phoneE164 },
      };
    }
    return { name: 'TurnOnNotifications' };
  }

  // Returning sign-in / session restore: enter app when email is verified.
  if (input.apiUser) {
    return { name: 'MainTabs' };
  }

  return { name: 'SignIn' };
}
