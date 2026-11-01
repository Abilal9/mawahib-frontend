/**
 * Guest Home section publication. Independent of React so Node selftests
 * can verify generation fences without mounting screens.
 */

export const GUEST_HOME_REFRESH_WATCHDOG_MS = 30_000;

export type GuestHomeSectionState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

export function emptyGuestHomeSection<T>(): GuestHomeSectionState<T> {
  return { items: [], loading: true, error: null };
}

export function applyGuestHomeSectionSuccess<T>(
  current: GuestHomeSectionState<T>,
  items: T[],
  input: { requestGen: number; liveGen: number; mounted: boolean },
): GuestHomeSectionState<T> {
  if (!input.mounted || input.requestGen !== input.liveGen) return current;
  return { items, loading: false, error: null };
}

export function applyGuestHomeSectionFailure<T>(
  current: GuestHomeSectionState<T>,
  error: string,
  input: {
    requestGen: number;
    liveGen: number;
    mounted: boolean;
    preserveItems: boolean;
  },
): GuestHomeSectionState<T> {
  if (!input.mounted || input.requestGen !== input.liveGen) return current;
  return {
    items: input.preserveItems ? current.items : [],
    loading: false,
    error,
  };
}

/**
 * A stale-identity cancellation is not a network error. Settle the pending
 * flag only when this request is still the visible one.
 */
export function releaseGuestHomeSectionPending<T>(
  current: GuestHomeSectionState<T>,
  input: { requestGen: number; liveGen: number; mounted: boolean },
): GuestHomeSectionState<T> {
  if (!input.mounted || input.requestGen !== input.liveGen) return current;
  if (!current.loading) return current;
  return { ...current, loading: false };
}

export function shouldClearGuestHomeRefresh(input: {
  requestGen: number;
  liveGen: number;
  mounted: boolean;
}): boolean {
  return input.mounted && input.requestGen === input.liveGen;
}
