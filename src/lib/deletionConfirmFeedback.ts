export const DELETION_WAIT_TITLE = 'Deleting your account…';
export const DELETION_WAIT_BODY =
  'Please wait. Closing the app, going back, or losing the connection does not cancel a deletion that was already submitted.';
export const DELETION_UNCERTAIN_TITLE = "We couldn't confirm the result yet.";
export const DELETION_UNCERTAIN_BODY =
  'The connection was lost or the request timed out. Check again uses the same confirmation and does not start another deletion.';

export type DeletionConfirmFailure =
  | { kind: 'already-closed' }
  | { kind: 'uncertain' }
  | { kind: 'failed'; message: string; recovery: 'retry-same-key' | 'refresh-status' };

function asApiError(error: unknown): { status: number; message: string; code?: string } | null {
  if (!(error instanceof Error)) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') return null;
  const code = (error as { code?: unknown }).code;
  return { status, message: error.message, code: typeof code === 'string' ? code : undefined };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Deletion was not confirmed. Try again.';
}

function isUncertainTransport(error: unknown): boolean {
  const api = asApiError(error);
  if (api) return api.status === 0 || api.status === 408 || api.status === 504;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : '';
  return /network|timeout|timed out|failed to fetch|aborted|connection/i.test(message);
}

/**
 * Classifies a confirmation failure without starting a new deletion.
 * A lost connection is uncertain. Account unavailable means the close
 * already happened. Any other server response is a confirmed failure.
 */
export function classifyDeletionConfirmError(error: unknown): DeletionConfirmFailure {
  const api = asApiError(error);
  if (api?.status === 401 && api.code === 'ACCOUNT_UNAVAILABLE') return { kind: 'already-closed' };
  if (isUncertainTransport(error)) return { kind: 'uncertain' };
  if (api && api.status >= 500) {
    return { kind: 'failed', message: errorMessage(error), recovery: 'retry-same-key' };
  }
  return { kind: 'failed', message: errorMessage(error), recovery: 'refresh-status' };
}
