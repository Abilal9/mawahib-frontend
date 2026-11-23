import { t } from '../i18n/runtime';
import { ApiError, isStaleIdentityError } from './identityFences';

/** English rate-limit sentinel. A missing page is unavailable content. */
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
    if (error.status === 404) return t('error.contentUnavailable');
    if (error.status === 429) return t('error.rateLimitShort');
    if (error.status >= 500) return t('error.server');
    return error.message || t('error.unableToLoad');
  }
  return t('error.offline');
}
