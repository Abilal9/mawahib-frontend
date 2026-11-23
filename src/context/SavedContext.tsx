import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { savedApi } from '../services/savedApi';
import { mapFeedPost } from '../services/postsApi';
import { mapApiListingToJob } from '../services/marketplaceApi';
import { categoryCardLabel } from '../i18n/catalogLabel';
import { Job, Post, Service } from '../data/types';
import { SavedServiceItem } from '../services/savedApi';

export type SavedEntityType = 'post' | 'job' | 'service';
export type SavedCategory = 'posts' | 'jobs' | 'services';

type Slot = {
  userId: string;
  desired: boolean;
  confirmed: boolean;
  chain: Promise<boolean> | null;
};

type ListState<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

type Lists = {
  posts: ListState<Post>;
  jobs: ListState<Job>;
  services: ListState<Service & { ownerUserId?: string }>;
};

function emptyList<T>(): ListState<T> {
  return {
    items: [],
    cursor: null,
    hasMore: false,
    loading: false,
    error: null,
    loaded: false,
  };
}

function emptyLists(): Lists {
  return {
    posts: emptyList(),
    jobs: emptyList(),
    services: emptyList(),
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again';
}

function mapSavedService(row: SavedServiceItem): Service & { ownerUserId?: string } {
  const basic = row.packages?.[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: typeof basic?.price === 'number' ? basic.price : null,
    currency: basic?.currency || row.currency,
    duration: basic?.delivery || '',
    category: categoryCardLabel(row),
    provider: {
      id: row.userId || '',
      name: row.ownerDisplayName || '',
      username: row.ownerUsername || '',
      avatar: row.ownerAvatarUrl || '',
      isVerified: row.ownerIsVerified,
      followers: 0,
      following: 0,
      posts: 0,
    },
    rating: row.reviewSummary?.average ?? 0,
    reviewCount: row.reviewSummary?.count ?? 0,
    images: row.images,
    isSaved: true,
    ownerUserId: row.userId,
  };
}

type SavedContextValue = {
  isSaved: (type: SavedEntityType, id: string, serverValue: boolean) => boolean;
  setDesired: (
    type: SavedEntityType,
    id: string,
    desired: boolean,
    serverValue: boolean,
  ) => Promise<boolean>;
  lists: Lists;
  loadCategory: (category: SavedCategory, mode?: 'first' | 'more') => Promise<void>;
  unsaveFromList: (category: SavedCategory, id: string) => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | undefined>(undefined);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { apiUser } = useAuth();
  const userId = apiUser?.id ?? null;
  const userIdRef = useRef(userId);
  const slots = useRef(new Map<string, Slot>());
  const listsRef = useRef<Lists>(emptyLists());
  const epochs = useRef({ posts: 0, jobs: 0, services: 0 });
  const fetchGen = useRef({ posts: 0, jobs: 0, services: 0 });
  const [lists, setLists] = useState<Lists>(emptyLists());
  const [version, setVersion] = useState(0);
  const boundUser = useRef(userId);

  // Reset during render when the signed-in user changes. The context value
  // below uses the cleared lists in this same render, so the previous user's
  // rows are not passed to SavedScreen. In-flight responses are ignored
  // because their epoch no longer matches.
  userIdRef.current = userId;
  let shownLists = lists;
  if (boundUser.current !== userId) {
    boundUser.current = userId;
    slots.current.clear();
    epochs.current = {
      posts: epochs.current.posts + 1,
      jobs: epochs.current.jobs + 1,
      services: epochs.current.services + 1,
    };
    fetchGen.current = {
      posts: fetchGen.current.posts + 1,
      jobs: fetchGen.current.jobs + 1,
      services: fetchGen.current.services + 1,
    };
    const cleared = emptyLists();
    listsRef.current = cleared;
    shownLists = cleared;
    setLists(cleared);
    setVersion((value) => value + 1);
  }

  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const replaceLists = useCallback((next: Lists) => {
    listsRef.current = next;
    setLists(next);
  }, []);

  const isSaved = useCallback(
    (type: SavedEntityType, id: string, serverValue: boolean) => {
      if (!userId) return false;
      const slot = slots.current.get(`${userId}:${type}:${id}`);
      if (!slot || slot.userId !== userId) return serverValue;
      return slot.desired;
    },
    [userId, version],
  );

  const mutate = useCallback(async (type: SavedEntityType, id: string, desired: boolean) => {
    if (type === 'post') return desired ? savedApi.savePost(id) : savedApi.unsavePost(id);
    if (type === 'job') return desired ? savedApi.saveJob(id) : savedApi.unsaveJob(id);
    return desired ? savedApi.saveService(id) : savedApi.unsaveService(id);
  }, []);

  const setDesired = useCallback(
    (
      type: SavedEntityType,
      id: string,
      desired: boolean,
      serverValue: boolean,
    ): Promise<boolean> => {
      const currentUser = userIdRef.current;
      if (!currentUser) return Promise.resolve(false);
      const key = `${currentUser}:${type}:${id}`;
      let slot = slots.current.get(key);
      if (!slot || slot.userId !== currentUser) {
        slot = {
          userId: currentUser,
          desired: serverValue,
          confirmed: serverValue,
          chain: null,
        };
        slots.current.set(key, slot);
      }
      slot.desired = desired;
      bump();
      if (slot.chain) return slot.chain;

      const run = async (): Promise<boolean> => {
        let ok = true;
        const active = slots.current.get(key);
        if (!active) return true;
        while (userIdRef.current === active.userId && active.desired !== active.confirmed) {
          const target = active.desired;
          try {
            const remote = await mutate(type, id, target);
            if (userIdRef.current !== active.userId) return true;
            active.confirmed = remote;
            if (active.desired !== remote && active.desired === target) {
              active.desired = remote;
              ok = false;
              Alert.alert('Could not update save', 'Please try again');
              break;
            }
          } catch (error) {
            if (userIdRef.current !== active.userId) return true;
            if (active.desired !== target) continue;
            active.desired = active.confirmed;
            ok = false;
            Alert.alert('Could not update save', messageOf(error));
            break;
          }
        }
        bump();
        return ok;
      };

      slot.chain = run().finally(() => {
        const current = slots.current.get(key);
        if (current) current.chain = null;
      });
      return slot.chain;
    },
    [bump, mutate],
  );

  const loadCategory = useCallback(
    async (category: SavedCategory, mode: 'first' | 'more' = 'first') => {
      const currentUser = userIdRef.current;
      if (!currentUser) return;
      const current = listsRef.current[category];
      if (mode === 'more' && (!current.hasMore || current.loading)) return;
      const epoch = epochs.current[category];
      const generation = ++fetchGen.current[category];
      const cursor = mode === 'more' ? current.cursor : null;
      replaceLists({
        ...listsRef.current,
        [category]: { ...current, loading: true, error: null },
      });
      try {
        if (category === 'posts') {
          const page = await savedApi.listPosts(cursor);
          if (
            userIdRef.current !== currentUser ||
            epochs.current.posts !== epoch ||
            fetchGen.current.posts !== generation
          ) {
            return;
          }
          const items = page.items.map(mapFeedPost);
          const prev = listsRef.current.posts;
          replaceLists({
            ...listsRef.current,
            posts: {
              items: mode === 'more' ? [...prev.items, ...items] : items,
              cursor: page.nextCursor,
              hasMore: page.hasMore,
              loading: false,
              error: null,
              loaded: true,
            },
          });
          return;
        }
        if (category === 'jobs') {
          const page = await savedApi.listJobs(cursor);
          if (
            userIdRef.current !== currentUser ||
            epochs.current.jobs !== epoch ||
            fetchGen.current.jobs !== generation
          ) {
            return;
          }
          const items = page.items.map((row) => ({
            ...mapApiListingToJob(row),
            isSaved: true,
          }));
          const prev = listsRef.current.jobs;
          replaceLists({
            ...listsRef.current,
            jobs: {
              items: mode === 'more' ? [...prev.items, ...items] : items,
              cursor: page.nextCursor,
              hasMore: page.hasMore,
              loading: false,
              error: null,
              loaded: true,
            },
          });
          return;
        }
        const page = await savedApi.listServices(cursor);
        if (
          userIdRef.current !== currentUser ||
          epochs.current.services !== epoch ||
          fetchGen.current.services !== generation
        ) {
          return;
        }
        const items = page.items.map(mapSavedService);
        const prev = listsRef.current.services;
        replaceLists({
          ...listsRef.current,
          services: {
            items: mode === 'more' ? [...prev.items, ...items] : items,
            cursor: page.nextCursor,
            hasMore: page.hasMore,
            loading: false,
            error: null,
            loaded: true,
          },
        });
      } catch (error) {
        if (
          userIdRef.current !== currentUser ||
          epochs.current[category] !== epoch ||
          fetchGen.current[category] !== generation
        ) {
          return;
        }
        replaceLists({
          ...listsRef.current,
          [category]: {
            ...listsRef.current[category],
            loading: false,
            loaded: true,
            error: messageOf(error),
          },
        });
      }
    },
    [replaceLists],
  );

  const unsaveFromList = useCallback(
    async (category: SavedCategory, id: string) => {
      const currentUser = userIdRef.current;
      const list = listsRef.current[category];
      const index = list.items.findIndex((item) => item.id === id);
      if (index < 0 || !currentUser) return;
      const removed = list.items[index];
      const nextItems = list.items.filter((item) => item.id !== id);
      replaceLists({
        ...listsRef.current,
        [category]: { ...list, items: nextItems },
      });
      const type: SavedEntityType =
        category === 'posts' ? 'post' : category === 'jobs' ? 'job' : 'service';
      const serverValue = true;
      const ok = await setDesired(type, id, false, serverValue);
      if (!ok && userIdRef.current === currentUser) {
        const latest = listsRef.current[category];
        const restored = [...latest.items];
        restored.splice(Math.min(index, restored.length), 0, removed as (typeof restored)[number]);
        replaceLists({
          ...listsRef.current,
          [category]: { ...latest, items: restored },
        });
      }
    },
    [replaceLists, setDesired],
  );

  const value = useMemo(
    () => ({ isSaved, setDesired, lists: shownLists, loadCategory, unsaveFromList }),
    [isSaved, setDesired, shownLists, loadCategory, unsaveFromList],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within SavedProvider');
  return ctx;
}
