import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categoriesForExploreTab,
  toggleExploreCategory,
} from '../domain/exploreTaxonomy';
import { resolveGuestExploreQuery } from '../lib/guestExploreQuery';
import { isStaleIdentityError } from '../lib/identityFences';
import { publicErrorMessage } from '../lib/publicErrors';
import {
  fetchPublicExploreServices,
  fetchPublicExploreTalents,
  fetchPublicJobListings,
  fetchPublicTaxonomy,
  PUBLIC_MAX_SKIP,
  PUBLIC_MAX_TAKE,
  type GuestExploreService,
  type GuestExploreTalent,
  type GuestJob,
  type PublicTaxonomyCategory,
} from '../services/publicApi';
import type { ExploreTab } from '../data/mock/explore';

export const GUEST_EXPLORE_DEBOUNCE_MS = 300;
export const GUEST_EXPLORE_REFRESH_WATCHDOG_MS = 30_000;

export type GuestExploreItem =
  | { kind: 'talent'; talent: GuestExploreTalent }
  | { kind: 'service'; service: GuestExploreService }
  | { kind: 'job'; job: GuestJob };

type Bucket = {
  items: GuestExploreItem[];
  error: string | null;
  initialLoading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
};

const emptyBucket = (): Bucket => ({
  items: [],
  error: null,
  initialLoading: true,
  refreshing: false,
  loadingMore: false,
  hasMore: false,
});

export function useGuestExplore(initialTab: ExploreTab = 'talents') {
  const mounted = useRef(true);
  const gen = useRef(0);
  const refreshWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshWatchdog = () => {
    if (refreshWatchdog.current) {
      clearTimeout(refreshWatchdog.current);
      refreshWatchdog.current = null;
    }
  };
  const [tab, setTab] = useState<ExploreTab>(initialTab);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [taxonomy, setTaxonomy] = useState<PublicTaxonomyCategory[]>([]);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyAttempt, setTaxonomyAttempt] = useState(0);
  const [bucket, setBucket] = useState<Bucket>(emptyBucket);

  useEffect(() => {
    return () => {
      mounted.current = false;
      clearRefreshWatchdog();
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const delay = trimmed ? GUEST_EXPLORE_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setTaxonomyLoading(true);
    void fetchPublicTaxonomy()
      .then((catalog) => {
        if (cancelled || !mounted.current) return;
        setTaxonomy(catalog.categories);
        setTaxonomyError(null);
        setTaxonomyLoading(false);
      })
      .catch((error) => {
        if (cancelled || !mounted.current) return;
        if (isStaleIdentityError(error)) {
          setTaxonomyLoading(false);
          return;
        }
        setTaxonomyError(publicErrorMessage(error));
        setTaxonomyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taxonomyAttempt]);

  const categories = useMemo(
    () => categoriesForExploreTab(taxonomy, tab),
    [taxonomy, tab],
  );

  const search = resolveGuestExploreQuery(debouncedQuery, categoryIds);

  const load = useCallback(
    async (mode: 'reset' | 'more' | 'refresh') => {
      if (search.blocked) {
        if (mode === 'refresh') {
          clearRefreshWatchdog();
          setBucket((current) => ({ ...current, refreshing: false }));
        }
        return;
      }
      const requestGen = mode === 'more' ? gen.current : ++gen.current;
      if (mode !== 'more') clearRefreshWatchdog();
      if (mode === 'reset') {
        setBucket({
          items: [],
          error: null,
          initialLoading: true,
          refreshing: false,
          loadingMore: false,
          hasMore: false,
        });
      } else if (mode === 'refresh') {
        setBucket((current) => ({ ...current, error: null, refreshing: true }));
        refreshWatchdog.current = setTimeout(() => {
          if (requestGen !== gen.current || !mounted.current) return;
          setBucket((current) => ({ ...current, refreshing: false }));
        }, GUEST_EXPLORE_REFRESH_WATCHDOG_MS);
      } else {
        setBucket((current) => ({ ...current, loadingMore: true }));
      }

      const skip = mode === 'more' ? bucket.items.length : 0;
      if (skip > PUBLIC_MAX_SKIP) {
        setBucket((current) => ({ ...current, loadingMore: false, hasMore: false }));
        return;
      }

      try {
        const queryInput = {
          q: search.q,
          skip,
          take: PUBLIC_MAX_TAKE,
          categoryIds: search.categoryIds,
        };
        let nextItems: GuestExploreItem[] = [];
        let pageLen = 0;
        if (tab === 'talents') {
          const page = await fetchPublicExploreTalents(queryInput);
          pageLen = page.items.length;
          nextItems = page.items.map((talent) => ({ kind: 'talent' as const, talent }));
        } else if (tab === 'services') {
          const page = await fetchPublicExploreServices(queryInput);
          pageLen = page.items.length;
          nextItems = page.items.map((service) => ({
            kind: 'service' as const,
            service,
          }));
        } else {
          const page = await fetchPublicJobListings(queryInput);
          pageLen = page.items.length;
          nextItems = page.items.map((job) => ({ kind: 'job' as const, job }));
        }

        if (requestGen !== gen.current || !mounted.current) return;
        clearRefreshWatchdog();
        setBucket((current) => {
          const items = mode === 'more' ? [...current.items, ...nextItems] : nextItems;
          return {
            items,
            error: null,
            initialLoading: false,
            refreshing: false,
            loadingMore: false,
            hasMore:
              pageLen >= PUBLIC_MAX_TAKE && skip + pageLen <= PUBLIC_MAX_SKIP,
          };
        });
      } catch (error) {
        if (requestGen !== gen.current || !mounted.current) return;
        clearRefreshWatchdog();
        if (isStaleIdentityError(error)) {
          setBucket((current) => ({
            ...current,
            initialLoading: false,
            refreshing: false,
            loadingMore: false,
          }));
          return;
        }
        setBucket((current) => ({
          items: mode === 'reset' ? [] : current.items,
          error: publicErrorMessage(error),
          initialLoading: false,
          refreshing: false,
          loadingMore: false,
          hasMore: false,
        }));
      }
    },
    [bucket.items.length, search.blocked, search.q, categoryIds, tab],
  );

  useEffect(() => {
    setCategoryIds([]);
  }, [tab]);

  useEffect(() => {
    if (search.blocked) return;
    void load('reset');
    // Reload when tab, text query, or category IDs change — not on load identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search.blocked, search.q, categoryIds]);

  const loadMore = useCallback(() => {
    if (
      search.blocked ||
      bucket.initialLoading ||
      bucket.loadingMore ||
      !bucket.hasMore ||
      bucket.items.length > PUBLIC_MAX_SKIP
    ) {
      return;
    }
    void load('more');
  }, [bucket.hasMore, bucket.initialLoading, bucket.items.length, bucket.loadingMore, load, search.blocked]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const toggleCategory = useCallback((id: string) => {
    setCategoryIds((current) => toggleExploreCategory(current, id));
  }, []);

  const clearCategories = useCallback(() => {
    setCategoryIds([]);
  }, []);

  const retryTaxonomy = useCallback(() => {
    setTaxonomyAttempt((current) => current + 1);
  }, []);

  return {
    tab,
    setTab,
    query,
    setQuery,
    categories,
    categoryIds,
    toggleCategory,
    clearCategories,
    taxonomyLoading,
    taxonomyError,
    retryTaxonomy,
    items: bucket.items,
    error: bucket.error,
    initialLoading: bucket.initialLoading,
    refreshing: bucket.refreshing,
    loadingMore: bucket.loadingMore,
    hasMore: bucket.hasMore,
    searchBlocked: search.blocked,
    refresh,
    loadMore,
  };
}
