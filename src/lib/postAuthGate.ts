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
 * Email verification alone must not enter the app while a collected phone
 * is still unverified. That screen lives on the signed-out navigator.
 */
export function shouldEnterAuthenticatedProduct(input: {
  emailVerified: boolean;
  phoneE164?: string | null;
  phoneVerified?: boolean | null;
  pendingPhoneE164?: string | null;
}): boolean {
  if (!input.emailVerified) return false;
  return !phoneVerificationPending({
    phoneE164: input.phoneE164 || input.pendingPhoneE164,
    phoneVerified: input.phoneVerified,
  });
}

export type PostAuthDestination = {
  [K in keyof RootStackParamList]: {
    name: K;
    params?: RootStackParamList[K];
  };
}[keyof RootStackParamList];

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
}): PostAuthDestination {
  const email =
    input.apiUser?.email ||
    input.session?.user?.email ||
    input.signUpBasics?.email ||
    input.pendingEmail ||
    '';
  const phoneE164 =
    input.apiUser?.phoneE164 ||
    input.signUpBasics?.phoneE164 ||
    input.pendingPhoneE164 ||
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

  // Fresh verification continues through onboarding. A later sign-in may enter the app.
  if (input.flow === 'verify' || input.flow === 'deeplink') {
    return { name: 'TurnOnNotifications' };
  }

  // Returning sign-in / session restore: enter app when email is verified.
  if (input.apiUser) {
    return { name: 'MainTabs' };
  }

  return { name: 'SignIn' };
}
