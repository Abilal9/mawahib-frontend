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
import { mergeNotificationPages } from '../lib/notificationInbox';
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
  markRead: (id: string) => void;
  markAllRead: () => void;
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
  const pagedRef = useRef(false);
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
    shownLoading = false;
    shownFailed = false;
    shownLoadingMore = false;
    shownMoreFailed = false;
    shownHasMore = false;
    notificationsRef.current = [];
    nextCursorRef.current = null;
    pagedRef.current = false;
    refreshGen.current += 1;
    moreGen.current += 1;
    loadingMoreRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
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

  const refresh = useCallback(async () => {
    const generation = ++refreshGen.current;
    const startedUserId = userIdRef.current;
    const epochAtStart = epochRef.current;
    const token = tokenFor(startedUserId);
    if (!startedUserId || !token) {
      notificationsRef.current = [];
      nextCursorRef.current = null;
      pagedRef.current = false;
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
      const [page, count] = await Promise.all([
        notificationService.listPage(token),
        notificationService.unreadCount(token),
      ]);
      if (
        generation !== refreshGen.current ||
        shouldIgnoreStaleIdentityResult({
          startedUserId,
          currentUserId: userIdRef.current,
          epochAtStart,
          epochNow: epochRef.current,
        })
      ) {
        return;
      }
      const nextItems =
        !pagedRef.current && page.nextCursor === null
          ? page.items
          : mergeNotificationPages(notificationsRef.current, page.items);
      notificationsRef.current = nextItems;
      setNotifications(nextItems);
      setUnreadCount(count);
      if (!pagedRef.current) {
        nextCursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
      }
      setFailed(false);
    } catch (e) {
      console.warn('[notifications] refresh failed', e);
      if (
        generation !== refreshGen.current ||
        shouldIgnoreStaleIdentityResult({
          startedUserId,
          currentUserId: userIdRef.current,
          epochAtStart,
          epochNow: epochRef.current,
        })
      ) {
        return;
      }
      if (notificationsRef.current.length === 0) setFailed(true);
    } finally {
      if (
        generation === refreshGen.current &&
        !shouldIgnoreStaleIdentityResult({
          startedUserId,
          currentUserId: userIdRef.current,
          epochAtStart,
          epochNow: epochRef.current,
        })
      ) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    const generation = ++moreGen.current;
    const startedUserId = userIdRef.current;
    const epochAtStart = epochRef.current;
    const token = tokenFor(startedUserId);
    if (!startedUserId || !token) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    void (async () => {
      try {
        const page = await notificationService.listPage(token, { cursor });
        if (
          generation !== moreGen.current ||
          shouldIgnoreStaleIdentityResult({
            startedUserId,
            currentUserId: userIdRef.current,
            epochAtStart,
            epochNow: epochRef.current,
          })
        ) {
          return;
        }
        const nextItems = mergeNotificationPages(notificationsRef.current, page.items);
        notificationsRef.current = nextItems;
        pagedRef.current = true;
        nextCursorRef.current = page.nextCursor;
        setNotifications(nextItems);
        setHasMore(page.nextCursor !== null);
        setMoreFailed(false);
      } catch (e) {
        console.warn('[notifications] older page failed', e);
        if (
          generation !== moreGen.current ||
          shouldIgnoreStaleIdentityResult({
            startedUserId,
            currentUserId: userIdRef.current,
            epochAtStart,
            epochNow: epochRef.current,
          })
        ) {
          return;
        }
        setMoreFailed(true);
      } finally {
        if (generation === moreGen.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    })();
  }, []);

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
        if (stale(startedUserId, epochAtStart) || !token) return;
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
        void notificationService.markAllRead(token).catch(() => {
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
    [shownNotifications, shownUnread, shownLoading, shownFailed, shownLoadingMore, shownMoreFailed, shownHasMore, refresh, loadMore],
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
