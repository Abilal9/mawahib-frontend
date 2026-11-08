import { apiRequest } from '../lib/apiClient';
import type { Comment, Post, User } from '../data/types';

export type FeedSource = 'self' | 'connection' | 'discovery';
export type RelationshipStatus =
  | 'self'
  | 'none'
  | 'outgoing'
  | 'incoming'
  | 'connected';

export interface ApiFeedAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: string;
  title: string | null;
  isVerified: boolean;
  locationCity: string | null;
  locationCountry: string | null;
}

export interface ApiFeedPost {
  id: string;
  feedSource: FeedSource;
  author: ApiFeedAuthor;
  relationship: {
    status: RelationshipStatus;
    connectionRequestId: string | null;
  };
  text: string;
  visibility: string;
  moderation?: { hiddenByMawahib: true } | null;
  media: Array<{ mediaAssetId: string; url: string | null; position: number }>;
  engagement: {
    likeCount: number;
    commentCount: number;
    isLiked: boolean;
    isSaved: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApiFeedPage {
  items: ApiFeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiComment {
  id: string;
  postId: string;
  text: string;
  createdAt: string;
  moderation?: { hiddenByMawahib: true } | null;
  author: ApiFeedAuthor;
  canDelete: boolean;
}

export interface ApiCommentsPage {
  items: ApiComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiLikersPage {
  items: ApiFeedAuthor[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiEngagement {
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function mapFeedAuthor(a: ApiFeedAuthor): User {
  return {
    id: a.id,
    name: a.displayName,
    username: a.username,
    avatar: a.avatarUrl?.trim() || '',
    title: a.title || undefined,
    isVerified: a.isVerified,
    location:
      [a.locationCity, a.locationCountry].filter(Boolean).join(', ') || undefined,
    followers: 0,
    following: 0,
    posts: 0,
  };
}

export function mapFeedPost(dto: ApiFeedPost): Post {
  const images = [...dto.media]
    .sort((x, y) => x.position - y.position)
    .map((m) => m.url)
    .filter((u): u is string => Boolean(u));
  return {
    id: dto.id,
    author: mapFeedAuthor(dto.author),
    caption: dto.text,
    images,
    likes: dto.engagement.likeCount,
    comments: dto.engagement.commentCount,
    shares: 0,
    isLiked: dto.engagement.isLiked,
    isSaved: dto.engagement.isSaved,
    createdAt: dto.createdAt,
    role: dto.author.title || undefined,
    timeAgo: timeAgo(dto.createdAt),
    feedSource: dto.feedSource,
    relationship: dto.relationship,
    visibility: dto.visibility,
    hiddenByMawahib: dto.moderation?.hiddenByMawahib === true,
  };
}

export function mapApiComment(c: ApiComment): Comment {
  return {
    id: c.id,
    userId: c.author.id,
    user: c.author.displayName,
    avatar: c.author.avatarUrl?.trim() || '',
    text: c.text,
    time: timeAgo(c.createdAt),
    canDelete: Boolean(c.canDelete),
    hiddenByMawahib: c.moderation?.hiddenByMawahib === true,
  };
}

export const postsApi = {
  listFeed(params?: { cursor?: string; limit?: number }): Promise<ApiFeedPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<ApiFeedPage>(`/feed${suffix}`);
  },

  create(input: {
    text?: string;
    mediaAssetIds?: string[];
    visibility?: 'public' | 'connections';
  }): Promise<ApiFeedPost> {
    return apiRequest<ApiFeedPost>('/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getById(id: string): Promise<ApiFeedPost> {
    return apiRequest<ApiFeedPost>(`/posts/${id}`);
  },

  softDelete(id: string): Promise<void> {
    return apiRequest<void>(`/posts/${id}`, { method: 'DELETE' });
  },

  like(id: string): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/posts/${id}/likes`, { method: 'POST' });
  },

  unlike(id: string): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/posts/${id}/likes`, { method: 'DELETE' });
  },

  save(id: string): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/posts/${id}/saves`, { method: 'POST' });
  },

  unsave(id: string): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/posts/${id}/saves`, { method: 'DELETE' });
  },

  listComments(
    postId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<ApiCommentsPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<ApiCommentsPage>(`/posts/${postId}/comments${suffix}`);
  },

  createComment(postId: string, text: string): Promise<ApiComment> {
    return apiRequest<ApiComment>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  deleteComment(commentId: string): Promise<void> {
    return apiRequest<void>(`/comments/${commentId}`, { method: 'DELETE' });
  },

  listLikes(
    postId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<ApiLikersPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<ApiLikersPage>(`/posts/${postId}/likes${suffix}`);
  },

  listUserPosts(
    userId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<ApiFeedPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<ApiFeedPage>(`/users/${userId}/posts${suffix}`);
  },
};
