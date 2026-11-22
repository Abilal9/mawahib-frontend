import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Notification } from '../data/types';
import { NOTIFICATIONS_POLL_MS } from '../config/messaging';
import { usePolling } from '../hooks/usePolling';
import type { NotificationListCategory } from '../lib/notificationCategories';
import {
  acceptNotificationResult,
  applyNotificationRefresh,
  mergeNotificationPages,
  notificationListQuery,
} from '../lib/notificationInbox';
import { notificationService } from '../services';
import { useAuth } from './AuthContext';
import { shouldIgnoreStaleIdentityResult } from './identityGuard';
import { accessTokenSubject } from '../lib/apiClient';

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  /** First page has not arrived yet. */
  loading: boolean;
  failed: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Switch the one active page stream. The first page of a category never reuses another cursor. */
  setCategory: (category: NotificationListCategory | null) => void;
  markRead: (id: string) => void;
  markAllRead: () => Promise<void>;
  /** Local-only: strip inline accept/decline (legacy mock UX). */
  clearActions: (id: string) => void;
  /** Local-only: hide rating prompt (legacy mock UX). */
  clearRatingPrompt: (id: string) => void;
  /** Local-only remove until next refresh. */
  remove: (id: string) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { apiUser, isSignedIn, accessToken } = useAuth();
  const userId = apiUser?.id ?? null;
  const userIdRef = useRef(userId);
  const accessTokenRef = useRef(accessToken);
  const epochRef = useRef(0);
  const boundUser = useRef(userId);
  accessTokenRef.current = accessToken;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);
  const nextCursorRef = useRef<string | null>(null);
  const categoryRef = useRef<NotificationListCategory | null>(null);
  const refreshGen = useRef(0);
  const moreGen = useRef(0);
  const loadingMoreRef = useRef(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );

  // Drop the previous account's inbox in this render. The list endpoint
  // returns one page with no cursor, so list + unread count are one refresh.
  userIdRef.current = userId;
  let shownNotifications = notifications;
  let shownUnread = unreadCount;
  let shownLoading = loading;
  let shownFailed = failed;
  let shownLoadingMore = loadingMore;
  let shownMoreFailed = moreFailed;
  let shownHasMore = hasMore;
  if (boundUser.current !== userId) {
    boundUser.current = userId;
    epochRef.current += 1;
    shownNotifications = [];
    shownUnread = 0;
    shownLoading = Boolean(userId);
    shownFailed = false;
    shownLoadingMore = false;
    shownMoreFailed = false;
    shownHasMore = false;
    notificationsRef.current = [];
    nextCursorRef.current = null;
    refreshGen.current += 1;
    moreGen.current += 1;
    loadingMoreRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setLoading(Boolean(userId));
    setFailed(false);
    setLoadingMore(false);
    setMoreFailed(false);
    setHasMore(false);
  }

  const stale = (startedUserId: string | null, epochAtStart: number) =>
    shouldIgnoreStaleIdentityResult({
      startedUserId,
      currentUserId: userIdRef.current,
      epochAtStart,
      epochNow: epochRef.current,
    });

  const tokenFor = (startedUserId: string | null) => {
    const token = accessTokenRef.current;
    if (!startedUserId || !token) return null;
    if (accessTokenSubject(token) !== startedUserId) return null;
    return token;
  };

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      setAppActive(next === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const stillCurrent = (
    startedUserId: string | null,
    epochAtStart: number,
    generation: number,
    currentGeneration: number,
    category: NotificationListCategory | null,
  ) =>
    acceptNotificationResult({
      requestGeneration: generation,
      currentGeneration,
      requestCategory: category,
      currentCategory: categoryRef.current,
      staleIdentity: shouldIgnoreStaleIdentityResult({
        startedUserId,
        currentUserId: userIdRef.current,
        epochAtStart,
        epochNow: epochRef.current,
      }),
    });

  const refresh = useCallback(async () => {
    const generation = ++refreshGen.current;
    moreGen.current += 1;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const category = categoryRef.current;
    const startedUserId = userIdRef.current;
    const epochAtStart = epochRef.current;
    const token = tokenFor(startedUserId);
    if (!startedUserId || !token) {
      notificationsRef.current = [];
      nextCursorRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setFailed(false);
      setHasMore(false);
      return;
    }
    const firstPage = notificationsRef.current.length === 0;
    if (firstPage) setLoading(true);
    setFailed(false);
    try {
      const query = notificationListQuery({
        mode: 'refresh',
        category,
        cursor: nextCursorRef.current,
      });
      const [page, count] = await Promise.all([
        notificationService.listPage(token, query),
        notificationService.unreadCount(token),
      ]);
      if (!stillCurrent(startedUserId, epochAtStart, generation, refreshGen.current, category)) {
        return;
      }
      moreGen.current += 1;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      const refreshed = applyNotificationRefresh(notificationsRef.current, page);
      notificationsRef.current = refreshed.items;
      nextCursorRef.current = refreshed.cursor;
      setNotifications(refreshed.items);
      setUnreadCount(count);
      setHasMore(refreshed.hasMore);
      setFailed(false);
    } catch (e) {
      console.warn('[notifications] refresh failed', e);
      if (!stillCurrent(startedUserId, epochAtStart, generation, refreshGen.current, category)) {
        return;
      }
      if (notificationsRef.current.length === 0) setFailed(true);
    } finally {
      if (stillCurrent(startedUserId, epochAtStart, generation, refreshGen.current, category)) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    const generation = ++moreGen.current;
    const refreshAtStart = refreshGen.current;
    const category = categoryRef.current;
    const startedUserId = userIdRef.current;
    const epochAtStart = epochRef.current;
    const token = tokenFor(startedUserId);
    if (!startedUserId || !token) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    void (async () => {
      try {
        const query = notificationListQuery({ mode: 'more', category, cursor });
        const page = await notificationService.listPage(token, query);
        if (
          refreshGen.current !== refreshAtStart ||
          !stillCurrent(startedUserId, epochAtStart, generation, moreGen.current, category)
        ) {
          return;
        }
        const nextItems = mergeNotificationPages(notificationsRef.current, page.items);
        notificationsRef.current = nextItems;
        nextCursorRef.current = page.nextCursor;
        setNotifications(nextItems);
        setHasMore(page.nextCursor !== null);
        setMoreFailed(false);
      } catch (e) {
        console.warn('[notifications] older page failed', e);
        if (
          refreshGen.current !== refreshAtStart ||
          !stillCurrent(startedUserId, epochAtStart, generation, moreGen.current, category)
        ) {
          return;
        }
        setMoreFailed(true);
      } finally {
        if (
          refreshGen.current === refreshAtStart &&
          stillCurrent(startedUserId, epochAtStart, generation, moreGen.current, category)
        ) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    })();
  }, []);

  const setCategory = useCallback((category: NotificationListCategory | null) => {
    if (categoryRef.current === category) return;
    categoryRef.current = category;
    notificationsRef.current = [];
    nextCursorRef.current = null;
    refreshGen.current += 1;
    moreGen.current += 1;
    loadingMoreRef.current = false;
    setNotifications([]);
    setFailed(false);
    setMoreFailed(false);
    setLoadingMore(false);
    setHasMore(false);
    setLoading(Boolean(userIdRef.current));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [userId, refresh]);

  usePolling(refresh, NOTIFICATIONS_POLL_MS, isSignedIn && appActive);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: shownNotifications,
      unreadCount: shownUnread,
      loading: shownLoading,
      failed: shownFailed,
      loadingMore: shownLoadingMore,
      moreFailed: shownMoreFailed,
      hasMore: shownHasMore,
      loadMore,
      setCategory,
      markRead: (id) => {
        const startedUserId = userIdRef.current;
        const epochAtStart = epochRef.current;
        const token = tokenFor(startedUserId);
        if (stale(startedUserId, epochAtStart) || !token) return;
        const current = notificationsRef.current.find((item) => item.id === id);
        if (!current || current.read) {
          void notificationService.markRead(id, token).catch(() => undefined);
          return;
        }
        const nextItems = notificationsRef.current.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        );
        notificationsRef.current = nextItems;
        setNotifications(nextItems);
        setUnreadCount((count) => Math.max(0, count - 1));
        void notificationService.markRead(id, token).catch(() => {
          if (stale(startedUserId, epochAtStart)) return;
          void refresh();
        });
      },
      markAllRead: () => {
        const startedUserId = userIdRef.current;
        const epochAtStart = epochRef.current;
        const token = tokenFor(startedUserId);
        if (stale(startedUserId, epochAtStart) || !token) return Promise.resolve();
        setNotifications((prev) => {
          if (stale(startedUserId, epochAtStart)) return prev;
          const next = prev.map((n) => ({ ...n, read: true }));
          notificationsRef.current = next;
          return next;
        });
        setUnreadCount((c) => {
          if (stale(startedUserId, epochAtStart)) return c;
          return 0;
        });
        return notificationService.markAllRead(token).catch(() => {
          if (stale(startedUserId, epochAtStart)) return;
          void refresh();
        });
      },
      clearActions: (id) => {
        const startedUserId = userIdRef.current;
        const epochAtStart = epochRef.current;
        setNotifications((prev) => {
          if (stale(startedUserId, epochAtStart)) return prev;
          return prev.map((n) =>
            n.id === id ? { ...n, actions: undefined } : n,
          );
        });
      },
      clearRatingPrompt: (id) => {
        const startedUserId = userIdRef.current;
        const epochAtStart = epochRef.current;
        setNotifications((prev) => {
          if (stale(startedUserId, epochAtStart)) return prev;
          return prev.map((n) =>
            n.id === id ? { ...n, showRating: false } : n,
          );
        });
      },
      remove: (id) => {
        const startedUserId = userIdRef.current;
        const epochAtStart = epochRef.current;
        setNotifications((prev) => {
          if (stale(startedUserId, epochAtStart)) return prev;
          const target = prev.find((n) => n.id === id);
          if (target && !target.read) {
            setUnreadCount((c) => {
              if (stale(startedUserId, epochAtStart)) return c;
              return Math.max(0, c - 1);
            });
          }
          const next = prev.filter((n) => n.id !== id);
          notificationsRef.current = next;
          return next;
        });
      },
      refresh,
    }),
    [shownNotifications, shownUnread, shownLoading, shownFailed, shownLoadingMore, shownMoreFailed, shownHasMore, refresh, loadMore, setCategory],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    );
  }
  return ctx;
}
