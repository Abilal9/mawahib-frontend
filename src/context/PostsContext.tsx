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
import { Alert } from 'react-native';
import { Comment, Post } from '../data/types';
import { ApiError } from '../lib/apiClient';
import { useAuth } from './AuthContext';
import { useSaved } from './SavedContext';
import { postService } from '../services/postService';
import {
  clearFeedRequest,
  initialFeedRequest,
  isCurrentFeedRequest,
  replaceFeedRequest,
  settleFeedFailure,
  settleFeedSuccess,
  type FeedPhase,
} from '../lib/feedLifecycle';

interface PostsContextValue {
  posts: Post[];
  loading: boolean;
  /** Idle and pending are initial loads. Ready includes a completed empty feed. */
  feedPhase: FeedPhase;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  createPost: (input: {
    text?: string;
    mediaAssetIds?: string[];
  }) => Promise<Post>;
  getPostById: (id: string) => Post | undefined;
  fetchPostById: (id: string) => Promise<Post | undefined>;
  toggleLike: (postId: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  softDelete: (postId: string) => Promise<void>;
  getComments: (postId: string) => Promise<Comment[]>;
  addComment: (postId: string, text: string) => Promise<Comment>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
  patchLocalPost: (postId: string, patch: Partial<Post>) => void;
}

const PostsContext = createContext<PostsContextValue | undefined>(undefined);

export function PostsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, apiUser } = useAuth();
  const userId = apiUser?.id ?? null;
  const saved = useSaved();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const feedRef = useRef(initialFeedRequest());
  const [feedPhase, setFeedPhase] = useState<FeedPhase>(feedRef.current.phase);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const commitFeed = (next: ReturnType<typeof replaceFeedRequest>) => {
    feedRef.current = next;
    setFeedPhase(next.phase);
  };

  const refresh = useCallback(async () => {
    if (!isSignedIn || !userId) {
      commitFeed(clearFeedRequest(feedRef.current));
      setPosts([]);
      setNextCursor(null);
      setHasMore(false);
      setError(null);
      setLoading(false);
      return;
    }
    const ownerChanged = feedRef.current.ownerId !== userId;
    const started = replaceFeedRequest(feedRef.current, userId);
    commitFeed(started);
    if (ownerChanged) {
      setPosts([]);
      setNextCursor(null);
      setHasMore(false);
      setError(null);
    }
    setLoading(true);
    if (started.phase === 'pending') setError(null);
    try {
      const page = await postService.listFeed(undefined, 20);
      if (!isCurrentFeedRequest(feedRef.current, userId, started.requestId)) return;
      setPosts(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setError(null);
      commitFeed(settleFeedSuccess(feedRef.current, userId, started.requestId));
    } catch (e) {
      if (!isCurrentFeedRequest(feedRef.current, userId, started.requestId)) return;
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Failed to load feed');
      setPosts([]);
      setNextCursor(null);
      setHasMore(false);
      commitFeed(settleFeedFailure(feedRef.current, userId, started.requestId));
    } finally {
      if (isCurrentFeedRequest(feedRef.current, userId, started.requestId)) {
        setLoading(false);
      }
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!isSignedIn || !userId || !hasMore || !nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await postService.listFeed(nextCursor, 20);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const appended = page.items.filter((p) => !seen.has(p.id));
        return [...prev, ...appended];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      Alert.alert(
        'Could not load more',
        e instanceof Error ? e.message : 'Please try again',
      );
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, isSignedIn, nextCursor, userId]);

  const patchLocalPost = useCallback((postId: string, patch: Partial<Post>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  }, []);

  const getPostById = useCallback(
    (id: string) => postsRef.current.find((p) => p.id === id),
    [],
  );

  const fetchPostById = useCallback(async (id: string) => {
    try {
      const post = await postService.getById(id);
      setPosts((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return [post, ...prev];
        const existing = prev[idx];
        if (
          existing.likes === post.likes &&
          existing.comments === post.comments &&
          existing.isLiked === post.isLiked &&
          existing.isSaved === post.isSaved &&
          existing.caption === post.caption
        ) {
          return prev;
        }
        const next = [...prev];
        next[idx] = post;
        return next;
      });
      return post;
    } catch {
      return undefined;
    }
  }, []);

  const createPost = useCallback(
    async (input: { text?: string; mediaAssetIds?: string[] }) => {
      const created = await postService.create(input);
      setPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      return created;
    },
    [],
  );

  const engagementInFlight = useRef(new Set<string>());

  const toggleLike = useCallback(
    async (postId: string) => {
      if (engagementInFlight.current.has(`like:${postId}`)) return;
      const current = postsRef.current.find((p) => p.id === postId);
      if (!current) return;
      engagementInFlight.current.add(`like:${postId}`);
      const nextLiked = !current.isLiked;
      patchLocalPost(postId, {
        isLiked: nextLiked,
        likes: current.likes + (nextLiked ? 1 : -1),
      });
      try {
        const eng = nextLiked
          ? await postService.like(postId)
          : await postService.unlike(postId);
        // Patch engagement fields only — do not re-spread a stale post snapshot
        // (would wipe concurrent relationship / feedSource patches).
        patchLocalPost(postId, {
          likes: eng.likeCount,
          comments: eng.commentCount,
          isLiked: eng.isLiked,
          isSaved: eng.isSaved,
        });
      } catch (e) {
        patchLocalPost(postId, {
          isLiked: current.isLiked,
          likes: current.likes,
        });
        Alert.alert(
          'Could not update like',
          e instanceof Error ? e.message : 'Please try again',
        );
      } finally {
        engagementInFlight.current.delete(`like:${postId}`);
      }
    },
    [patchLocalPost],
  );

  const toggleSave = useCallback(
    async (postId: string) => {
      const current = postsRef.current.find((p) => p.id === postId);
      if (!current) return;
      const shown = saved.isSaved('post', postId, current.isSaved);
      const nextSaved = !shown;
      patchLocalPost(postId, { isSaved: nextSaved });
      const ok = await saved.setDesired('post', postId, nextSaved, current.isSaved);
      if (!ok) patchLocalPost(postId, { isSaved: current.isSaved });
    },
    [patchLocalPost, saved],
  );

  const softDelete = useCallback(async (postId: string) => {
    await postService.softDelete(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const getComments = useCallback(
    (postId: string) => postService.listComments(postId),
    [],
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      const created = await postService.addComment(postId, text);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: p.comments + 1 } : p,
        ),
      );
      return created;
    },
    [],
  );

  const deleteComment = useCallback(async (postId: string, commentId: string) => {
    await postService.deleteComment(commentId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comments: Math.max(0, p.comments - 1) }
          : p,
      ),
    );
  }, []);

  const value = useMemo<PostsContextValue>(
    () => ({
      posts,
      loading,
      feedPhase,
      loadingMore,
      error,
      hasMore,
      refresh,
      loadMore,
      patchLocalPost,
      createPost,
      getPostById,
      fetchPostById,
      toggleLike,
      toggleSave,
      softDelete,
      getComments,
      addComment,
      deleteComment,
    }),
    [
      posts,
      loading,
      feedPhase,
      loadingMore,
      error,
      hasMore,
      refresh,
      loadMore,
      patchLocalPost,
      createPost,
      getPostById,
      fetchPostById,
      toggleLike,
      toggleSave,
      softDelete,
      getComments,
      addComment,
      deleteComment,
    ],
  );

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export function usePosts() {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePosts must be used within PostsProvider');
  return ctx;
}
