/**
 * Map Supabase / network auth failures to short, user-facing messages.
 * Never surface tokens, stack traces, or internal paths.
 */
export function mapAuthError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : '';

  const message = raw.trim();
  const lower = message.toLowerCase();
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code.toLowerCase()
      : '';

  if (
    code === 'otp_expired' ||
    lower.includes('otp_expired') ||
    lower.includes('token has expired') ||
    lower.includes('email link is invalid or has expired')
  ) {
    return 'The code you entered is incorrect or has expired. Try again or request a new code.';
  }

  if (
    code === 'access_denied' ||
    lower.includes('access_denied') ||
    lower.includes('email link is invalid')
  ) {
    return 'The code you entered is incorrect or has expired. Try again or request a new code.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }

  if (code === 'current_password_required') {
    return 'Enter your current password and try again.';
  }

  if (code === 'current_password_invalid' || lower.includes('current password')) {
    return 'Current password is incorrect.';
  }

  if (
    code === 'reauthentication_needed' ||
    code === 'reauthentication_not_valid' ||
    lower.includes('reauthentication')
  ) {
    return 'Sign in again, then change your password.';
  }

  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('email address is already')
  ) {
    return 'An account with this email already exists. Try logging in instead.';
  }

  if (
    lower.includes('phone') &&
    (lower.includes('already') || lower.includes('registered') || lower.includes('exists'))
  ) {
    return 'This phone number is already registered. Try signing in or use a different number.';
  }

  if (
    lower.includes('invalid phone') ||
    lower.includes('phone number') && lower.includes('invalid') ||
    code === 'validation_failed' && lower.includes('phone')
  ) {
    return 'Enter a valid phone number including country code (e.g. +9665…).';
  }

  if (
    lower.includes('sms') ||
    lower.includes('twilio') ||
    lower.includes('phone provider') ||
    lower.includes('unsupported phone provider')
  ) {
    return 'SMS verification is not available yet. Please use email, or try again later.';
  }

  if (
    lower.includes('token') && (lower.includes('invalid') || lower.includes('otp')) ||
    lower.includes('invalid otp') ||
    lower.includes('otp has expired') ||
    code === 'otp_disabled'
  ) {
    return 'The code you entered is incorrect or has expired. Try again or request a new code.';
  }

  if (
    lower.includes('password') &&
    (lower.includes('weak') ||
      lower.includes('least') ||
      lower.includes('characters') ||
      lower.includes('strength'))
  ) {
    return 'Password is too weak. Use at least 8 characters with upper, lower, number, and special character.';
  }

  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'Enter a valid email address.';
  }

  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('timeout')
  ) {
    return 'Network error. Check your connection and try again.';
  }

  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return 'Please verify your email before signing in. Check your inbox for the code.';
  }

  if (
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('over_sms_send_rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_sms_send_rate_limit'
  ) {
    return 'Too many requests. Wait a minute, then try resending the code.';
  }

  if (
    lower.includes('signed in but failed to load profile') ||
    lower.includes('email verified but failed to load profile') ||
    lower.includes('backend hydration') ||
    lower.includes('nest /users/me') ||
    lower.includes('failed to bootstrap')
  ) {
    return 'Your account was verified, but we could not load your Mawahib profile. Check that the API is running, then try again.';
  }

  if (lower.includes('signup is disabled')) {
    return 'New signups are temporarily unavailable. Please try again later.';
  }

  // Prefer a short generic message over leaking provider internals.
  if (message.length > 0 && message.length < 120 && !lower.includes('http') && !lower.includes('token=')) {
    return message;
  }

  return fallback;
}

export function isAuthNetworkError(error: unknown): boolean {
  const message = authErrorText(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('timeout')
  );
}

export function isAuthRateLimitError(error: unknown): boolean {
  const message = authErrorText(error).toLowerCase();
  const code = authErrorCode(error);
  return (
    code === 'over_email_send_rate_limit' ||
    code === 'over_sms_send_rate_limit' ||
    message.includes('over_email_send_rate_limit') ||
    message.includes('over_sms_send_rate_limit') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

function authErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return '';
}

function authErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code.toLowerCase();
  }
  return '';
}

export function mapDeepLinkAuthError(params: Record<string, string | undefined>): string | null {
  const error = params.error || params.error_code || params.error_description;
  if (!error) return null;
  return mapAuthError({
    message: decodeURIComponent(String(params.error_description || params.error || '')),
    code: params.error_code || params.error,
  });
}
