/**
 * What a profile or conversation screen may show while a record loads.
 * A cached record stays on screen. A different record, a denial, or an
 * unavailable target does not.
 */

export function sameShownRecord(
  shownId: string | null | undefined,
  requestedId: string | null | undefined,
): boolean {
  return Boolean(shownId && requestedId && shownId === requestedId);
}

export function protectedRecordDenied(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

export type ProfileSurface = 'skeleton' | 'content' | 'unavailable';

export function profileSurface(input: {
  requestedId: string | null | undefined;
  shownId: string | null | undefined;
  pending: boolean;
  denied: boolean;
}): ProfileSurface {
  if (!input.requestedId || input.denied) return 'unavailable';
  if (sameShownRecord(input.shownId, input.requestedId)) return 'content';
  if (input.pending) return 'skeleton';
  return 'unavailable';
}

export type ConversationSurface = 'missing' | 'skeleton' | 'messages';

export function conversationSurface(input: {
  missing: boolean;
  hasMessages: boolean;
  pending: boolean;
}): ConversationSurface {
  if (input.missing) return 'missing';
  if (input.hasMessages) return 'messages';
  if (input.pending) return 'skeleton';
  return 'messages';
}
