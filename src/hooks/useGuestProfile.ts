import { useCallback, useEffect, useRef, useState } from 'react';
import { isBackendUserId } from '../lib/isBackendUserId';
import { isStaleIdentityError } from '../lib/identityFences';
import { isPublicNotFound, publicErrorMessage } from '../lib/publicErrors';
import {
  fetchPublicUser,
  fetchPublicUserPortfolio,
  fetchPublicUserPosts,
  fetchPublicUserServices,
  type GuestPortfolio,
  type GuestPost,
  type GuestProfile,
  type GuestService,
} from '../services/publicApi';

type Section<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
  nextCursor?: string | null;
};

const emptySection = <T,>(): Section<T> => ({
  items: [],
  loading: true,
  error: null,
});

export function useGuestProfile(userId: string | undefined) {
  const mounted = useRef(true);
  const gen = useRef(0);
  const valid = isBackendUserId(userId);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(!valid);
  const [posts, setPosts] = useState<Section<GuestPost>>(emptySection);
  const [services, setServices] = useState<Section<GuestService>>(emptySection);
  const [portfolio, setPortfolio] = useState<Section<GuestPortfolio>>(emptySection);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const requestGen = ++gen.current;
    if (!valid || !userId) {
      setNotFound(true);
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    setNotFound(false);
    setPosts(emptySection());
    setServices(emptySection());
    setPortfolio(emptySection());

    try {
      const next = await fetchPublicUser(userId);
      if (requestGen !== gen.current || !mounted.current) return;
      setProfile(next);
      setProfileLoading(false);
    } catch (error) {
      if (isStaleIdentityError(error)) return;
      if (requestGen !== gen.current || !mounted.current) return;
      setProfile(null);
      setProfileLoading(false);
      setNotFound(isPublicNotFound(error));
      setProfileError(publicErrorMessage(error));
      setPosts({ items: [], loading: false, error: null });
      setServices({ items: [], loading: false, error: null });
      setPortfolio({ items: [], loading: false, error: null });
      return;
    }

    const settled = await Promise.allSettled([
      fetchPublicUserPosts(userId, { take: 20 }),
      fetchPublicUserServices(userId),
      fetchPublicUserPortfolio(userId),
    ]);
    if (requestGen !== gen.current || !mounted.current) return;

    const applyPage = <T,>(
      result: PromiseSettledResult<{ items: T[]; nextCursor?: string | null } | T[]>,
      setSection: (next: Section<T>) => void,
    ) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        const items = Array.isArray(value) ? value : value.items;
        const nextCursor = Array.isArray(value) ? null : value.nextCursor;
        setSection({ items, loading: false, error: null, nextCursor });
        return;
      }
      if (isStaleIdentityError(result.reason)) return;
      setSection({
        items: [],
        loading: false,
        error: publicErrorMessage(result.reason),
      });
    };

    applyPage(settled[0], setPosts);
    applyPage(settled[1], setServices);
    applyPage(settled[2], setPortfolio);
  }, [userId, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    profile,
    profileLoading,
    profileError,
    notFound,
    posts,
    services,
    portfolio,
    refresh: load,
  };
}
