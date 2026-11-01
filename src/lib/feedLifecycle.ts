/**
 * Signed-in feed request lifecycle. Idle is not an empty result.
 * No React or network imports so Node selftests can run the transitions.
 */

export type FeedPhase = 'idle' | 'pending' | 'ready' | 'error';

export type FeedRequest = {
  ownerId: string | null;
  requestId: number;
  phase: FeedPhase;
};

export function initialFeedRequest(): FeedRequest {
  return { ownerId: null, requestId: 0, phase: 'idle' };
}

/**
 * Start the fetch for this account. A repeat for the same owner keeps a
 * visible ready or error phase so refresh does not look like a first load.
 * A different owner starts pending.
 */
export function replaceFeedRequest(
  current: FeedRequest,
  ownerId: string,
): FeedRequest {
  const sameOwner = current.ownerId === ownerId;
  const keepVisible =
    sameOwner && (current.phase === 'ready' || current.phase === 'error');
  return {
    ownerId,
    requestId: current.requestId + 1,
    phase: keepVisible ? current.phase : 'pending',
  };
}

/** Drop ownership so an in-flight result cannot settle a later account. */
export function clearFeedRequest(current: FeedRequest): FeedRequest {
  return {
    ownerId: null,
    requestId: current.requestId + 1,
    phase: 'idle',
  };
}

export function isCurrentFeedRequest(
  current: FeedRequest,
  ownerId: string,
  requestId: number,
): boolean {
  return current.ownerId === ownerId && current.requestId === requestId;
}

export function settleFeedSuccess(
  current: FeedRequest,
  ownerId: string,
  requestId: number,
): FeedRequest {
  if (!isCurrentFeedRequest(current, ownerId, requestId)) return current;
  return { ...current, phase: 'ready' };
}

export function settleFeedFailure(
  current: FeedRequest,
  ownerId: string,
  requestId: number,
): FeedRequest {
  if (!isCurrentFeedRequest(current, ownerId, requestId)) return current;
  return { ...current, phase: 'error' };
}

/** True only before the first completion for the visible account. */
export function feedInitialPending(phase: FeedPhase): boolean {
  return phase === 'idle' || phase === 'pending';
}
