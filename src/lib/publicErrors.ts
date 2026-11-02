import { ApiError, isStaleIdentityError } from './identityFences';

export const PUBLIC_RATE_LIMIT_MESSAGE = 'Too many requests. Try again shortly.';

export function isPublicNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isPublicRateLimit(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

export function publicErrorMessage(error: unknown): string {
  if (isStaleIdentityError(error)) return '';
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This content is unavailable.';
    if (error.status === 429) return PUBLIC_RATE_LIMIT_MESSAGE;
    if (error.status >= 500) return 'Something went wrong. Try again.';
    return error.message || 'Unable to load.';
  }
  return 'Unable to load. Check your connection.';
}
