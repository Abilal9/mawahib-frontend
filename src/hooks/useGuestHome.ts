import { useCallback, useEffect, useRef, useState } from 'react';
import { isStaleIdentityError } from '../lib/identityFences';
import { publicErrorMessage } from '../lib/publicErrors';
import {
  applyGuestHomeSectionFailure,
  applyGuestHomeSectionSuccess,
  emptyGuestHomeSection,
  releaseGuestHomeSectionPending,
  GUEST_HOME_REFRESH_WATCHDOG_MS,
  shouldClearGuestHomeRefresh,
  type GuestHomeSectionState,
} from '../lib/guestHomeSections';
import {
  fetchPublicExploreServices,
  fetchPublicExploreTalents,
  fetchPublicFeed,
  fetchPublicJobListings,
  PUBLIC_HOME_POSTS_TAKE,
  PUBLIC_HOME_SECTION_TAKE,
  type GuestExploreService,
  type GuestExploreTalent,
  type GuestJob,
  type GuestPost,
} from '../services/publicApi';

export type GuestHomeSection<T> = GuestHomeSectionState<T>;
export type GuestHomeSectionKey = 'talents' | 'services' | 'jobs' | 'posts';

type SectionWave = Record<GuestHomeSectionKey, number>;

export function useGuestHome() {
  const mounted = useRef(true);
  const refreshWave = useRef(0);
  const refreshWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionWave = useRef<SectionWave>({
    talents: 0,
    services: 0,
    jobs: 0,
    posts: 0,
  });
  const [talents, setTalents] = useState<GuestHomeSection<GuestExploreTalent>>(
    emptyGuestHomeSection,
  );
  const [services, setServices] = useState<
    GuestHomeSection<GuestExploreService>
  >(emptyGuestHomeSection);
  const [jobs, setJobs] = useState<GuestHomeSection<GuestJob>>(
    emptyGuestHomeSection,
  );
  const [posts, setPosts] = useState<GuestHomeSection<GuestPost>>(
    emptyGuestHomeSection,
  );
  const [refreshing, setRefreshing] = useState(false);

  const clearRefreshWatchdog = () => {
    if (refreshWatchdog.current) {
      clearTimeout(refreshWatchdog.current);
      refreshWatchdog.current = null;
    }
  };

  useEffect(() => {
    return () => {
      mounted.current = false;
      clearRefreshWatchdog();
    };
  }, []);

  const loadSection = useCallback(
    async <T,>(
      key: GuestHomeSectionKey,
      requestGen: number,
      preserveItems: boolean,
      fetcher: () => Promise<{ items: T[] }>,
      setter: React.Dispatch<React.SetStateAction<GuestHomeSection<T>>>,
    ) => {
      try {
        const page = await fetcher();
        setter((current) =>
          applyGuestHomeSectionSuccess(current, page.items, {
            requestGen,
            liveGen: sectionWave.current[key],
            mounted: mounted.current,
          }),
        );
      } catch (reason) {
        if (isStaleIdentityError(reason)) {
          setter((current) =>
            releaseGuestHomeSectionPending(current, {
              requestGen,
              liveGen: sectionWave.current[key],
              mounted: mounted.current,
            }),
          );
          return;
        }
        setter((current) =>
          applyGuestHomeSectionFailure(current, publicErrorMessage(reason), {
            requestGen,
            liveGen: sectionWave.current[key],
            mounted: mounted.current,
            preserveItems,
          }),
        );
      }
    },
    [],
  );

  const load = useCallback(
    async (isRefresh: boolean) => {
      const wave = isRefresh ? ++refreshWave.current : refreshWave.current;
      if (isRefresh) {
        setRefreshing(true);
        setTalents((current) => ({ ...current, error: null }));
        setServices((current) => ({ ...current, error: null }));
        setJobs((current) => ({ ...current, error: null }));
        setPosts((current) => ({ ...current, error: null }));
      } else {
        setTalents((current) => ({ ...current, loading: true, error: null }));
        setServices((current) => ({ ...current, loading: true, error: null }));
        setJobs((current) => ({ ...current, loading: true, error: null }));
        setPosts((current) => ({ ...current, loading: true, error: null }));
      }

      const talentsGen = ++sectionWave.current.talents;
      const servicesGen = ++sectionWave.current.services;
      const jobsGen = ++sectionWave.current.jobs;
      const postsGen = ++sectionWave.current.posts;

      if (isRefresh) {
        clearRefreshWatchdog();
        refreshWatchdog.current = setTimeout(() => {
          if (
            shouldClearGuestHomeRefresh({
              requestGen: wave,
              liveGen: refreshWave.current,
              mounted: mounted.current,
            })
          ) {
            setRefreshing(false);
          }
        }, GUEST_HOME_REFRESH_WATCHDOG_MS);
      }

      void Promise.allSettled([
        loadSection(
          'talents',
          talentsGen,
          isRefresh,
          () =>
            fetchPublicExploreTalents({
              skip: 0,
              take: PUBLIC_HOME_SECTION_TAKE,
            }),
          setTalents,
        ),
        loadSection(
          'services',
          servicesGen,
          isRefresh,
          () =>
            fetchPublicExploreServices({
              skip: 0,
              take: PUBLIC_HOME_SECTION_TAKE,
            }),
          setServices,
        ),
        loadSection(
          'jobs',
          jobsGen,
          isRefresh,
          () =>
            fetchPublicJobListings({ skip: 0, take: PUBLIC_HOME_SECTION_TAKE }),
          setJobs,
        ),
        loadSection(
          'posts',
          postsGen,
          isRefresh,
          () => fetchPublicFeed({ take: PUBLIC_HOME_POSTS_TAKE }),
          setPosts,
        ),
      ]).then(() => {
        if (
          shouldClearGuestHomeRefresh({
            requestGen: wave,
            liveGen: refreshWave.current,
            mounted: mounted.current,
          })
        ) {
          clearRefreshWatchdog();
          setRefreshing(false);
        }
      });
    },
    [loadSection],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const retrySection = useCallback(
    (key: GuestHomeSectionKey) => {
      const run = <T,>(
        setter: React.Dispatch<React.SetStateAction<GuestHomeSection<T>>>,
        fetcher: () => Promise<{ items: T[] }>,
      ) => {
        const requestGen = ++sectionWave.current[key];
        setter((current) => ({
          ...current,
          loading: current.items.length === 0,
          error: null,
        }));
        return loadSection(key, requestGen, true, fetcher, setter);
      };
      if (key === 'talents') {
        void run(setTalents, () =>
          fetchPublicExploreTalents({ skip: 0, take: PUBLIC_HOME_SECTION_TAKE }),
        );
      } else if (key === 'services') {
        void run(setServices, () =>
          fetchPublicExploreServices({
            skip: 0,
            take: PUBLIC_HOME_SECTION_TAKE,
          }),
        );
      } else if (key === 'jobs') {
        void run(setJobs, () =>
          fetchPublicJobListings({ skip: 0, take: PUBLIC_HOME_SECTION_TAKE }),
        );
      } else {
        void run(setPosts, () => fetchPublicFeed({ take: PUBLIC_HOME_POSTS_TAKE }));
      }
    },
    [loadSection],
  );

  return {
    talents,
    services,
    jobs,
    posts,
    refreshing,
    refresh,
    retrySection,
  };
}
