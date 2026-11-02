import {
  isPublicRateLimit,
  PUBLIC_RATE_LIMIT_MESSAGE,
  publicErrorMessage,
} from './publicErrors';

export type ExploreLoadMode = 'reset' | 'more' | 'refresh';

export type ExploreLoadBucket<T> = {
  items: T[];
  error: string | null;
  initialLoading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
};

export function exploreLoadMoreBlocked(input: {
  searchBlocked: boolean;
  initialLoading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  itemCount: number;
  maxSkip: number;
  error: string | null;
}): boolean {
  return (
    input.searchBlocked ||
    input.initialLoading ||
    input.refreshing ||
    input.loadingMore ||
    !input.hasMore ||
    input.itemCount > input.maxSkip ||
    input.error === PUBLIC_RATE_LIMIT_MESSAGE
  );
}

export function releaseExploreMoreLock(ticket: number, current: number): number {
  return ticket === current ? 0 : current;
}

export function exploreMoreDispatch(input: {
  blocked: boolean;
  inFlight: boolean;
}): 'start' | 'ignore' {
  return input.blocked || input.inFlight ? 'ignore' : 'start';
}

/** Invalidate a refresh that is still the current generation so its late result cannot land. */
export function expireExploreRefresh(requestGen: number, currentGen: number): number | null {
  if (requestGen !== currentGen) return null;
  return currentGen + 1;
}

export function exploreResultIsCurrent(
  requestGen: number,
  currentGen: number,
  mounted: boolean,
): boolean {
  return mounted && requestGen === currentGen;
}

export function exploreBucketAfterPage<T>(
  current: ExploreLoadBucket<T>,
  mode: ExploreLoadMode,
  page: readonly T[],
  pageLen: number,
  skip: number,
  take: number,
  maxSkip: number,
): ExploreLoadBucket<T> {
  return {
    items: mode === 'more' ? [...current.items, ...page] : [...page],
    error: null,
    initialLoading: false,
    refreshing: false,
    loadingMore: false,
    hasMore: pageLen >= take && skip + pageLen <= maxSkip,
  };
}

export function exploreBucketAfterFailure<T>(
  current: ExploreLoadBucket<T>,
  mode: ExploreLoadMode,
  error: unknown,
): ExploreLoadBucket<T> {
  return {
    items: mode === 'reset' ? [] : current.items,
    error: publicErrorMessage(error),
    initialLoading: false,
    refreshing: false,
    loadingMore: false,
    hasMore: isPublicRateLimit(error) && mode !== 'reset' ? current.hasMore : false,
  };
}
