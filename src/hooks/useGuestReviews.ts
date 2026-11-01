import { useCallback, useEffect, useRef, useState } from 'react';
import { isBackendUserId } from '../lib/isBackendUserId';
import { isStaleIdentityError } from '../lib/identityFences';
import { isPublicNotFound, publicErrorMessage } from '../lib/publicErrors';
import {
  fetchPublicServiceReviews,
  fetchPublicUserReviews,
  type GuestReview,
} from '../services/publicApi';
import type { PublicReviewRole } from '../services/publicQuery';

export function useGuestReviews(input: {
  userId?: string;
  serviceId?: string;
  role?: PublicReviewRole;
}) {
  const mounted = useRef(true);
  const gen = useRef(0);
  const targetId = input.serviceId || input.userId;
  const kind = input.serviceId ? 'service' : 'user';
  const role = kind === 'user' ? input.role : undefined;
  const valid = isBackendUserId(targetId);
  const [items, setItems] = useState<GuestReview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(!valid);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    (cursor?: string | null) => {
      if (!targetId) return Promise.reject(new Error('Missing review target'));
      if (kind === 'service') {
        return fetchPublicServiceReviews(targetId, { cursor, take: 20 });
      }
      return fetchPublicUserReviews(targetId, { cursor, take: 20, role });
    },
    [kind, role, targetId],
  );

  const load = useCallback(async () => {
    const requestGen = ++gen.current;
    if (!valid || !targetId) {
      setNotFound(true);
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const page = await fetchPage(null);
      if (requestGen !== gen.current || !mounted.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setLoading(false);
    } catch (reason) {
      if (isStaleIdentityError(reason)) return;
      if (requestGen !== gen.current || !mounted.current) return;
      setItems([]);
      setLoading(false);
      setNotFound(isPublicNotFound(reason));
      setError(publicErrorMessage(reason));
    }
  }, [fetchPage, targetId, valid]);

  const loadMore = useCallback(async () => {
    if (!valid || !targetId || !nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    const requestGen = gen.current;
    try {
      const page = await fetchPage(nextCursor);
      if (requestGen !== gen.current || !mounted.current) return;
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (isStaleIdentityError(reason)) return;
      if (requestGen !== gen.current || !mounted.current) return;
      setError(publicErrorMessage(reason));
    } finally {
      if (requestGen === gen.current && mounted.current) setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, nextCursor, targetId, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    loading,
    loadingMore,
    error,
    notFound,
    hasMore: Boolean(nextCursor),
    refresh: load,
    loadMore,
  };
}
