import { apiRequest } from '../lib/apiClient';
import type { ApiEngagementStatus } from './marketplaceApi';

export type ConversationType = 'connection' | 'work' | 'support';
export type MessageKind = 'user' | 'system';
export type ConversationListScope = 'inbox' | 'archived';
export type MessageReceiptStatus = 'sent' | 'delivered' | 'read';

export interface PeerSummary {
  id: string;
  displayName: string;
  username: string;
  isVerified: boolean;
  avatarUrl: string | null;
  title: string | null;
}

export interface WorkContext {
  title: string;
  source: string;
  status: ApiEngagementStatus;
  /** Chargeable total (base + add-ons). */
  price: string | null;
  /** Package/base only when present. */
  packagePrice?: string | null;
  currency: string | null;
  deadline: string | null;
  workRequestId: string | null;
  engagementId: string;
  /** Present after the viewer submitted a review (1–5). */
  viewerReviewRating?: number | null;
  /** Server answer: this viewer may still submit their one review. */
  canSubmit?: boolean;
  windowClosesAt?: string | null;
  published?: boolean;
}

export interface ApiConversation {
  id: string;
  type: ConversationType;
  connectionId: string | null;
  workEngagementId: string | null;
  archivedAt: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
  peer: PeerSummary | null;
  workContext: WorkContext | null;
  lastReadAt: string | null;
  lastReadSequence: number | null;
  hasUnread: boolean;
  writable: boolean;
  viewerArchivedAt?: string | null;
  viewerDeletedAt?: string | null;
  viewerArchived?: boolean;
}

export interface MessageAttachment {
  id: string;
  mediaAssetId: string;
  position: number;
  mimeType: string;
  url?: string | null;
  byteSize?: string | number | null;
  fileName?: string | null;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: MessageKind;
  body: string;
  clientMessageId: string | null;
  systemPayload: unknown;
  createdAt: string;
  sequence: number;
  attachments: MessageAttachment[];
  sender: PeerSummary | null;
  receiptStatus?: MessageReceiptStatus | null;
}

export interface MessagesPage {
  items: ApiMessage[];
  nextCursor: string | null;
}

export interface ConversationMediaItem {
  id: string;
  mediaAssetId: string;
  messageId: string;
  url: string | null;
  mimeType: string;
  createdAt: string;
}

export interface ConversationMediaPage {
  items: ConversationMediaItem[];
  nextCursor: string | null;
}

export interface ConversationUnreadSummary {
  /** Count of conversations with unread messages (not total unread messages). */
  unreadCount: number;
}

export const messagingApi = {
  listConversations(
    type?: ConversationType,
    scope: ConversationListScope = 'inbox',
  ): Promise<ApiConversation[]> {
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    if (scope) qs.set('scope', scope);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<ApiConversation[]>(`/users/me/conversations${suffix}`);
  },

  unreadSummary(): Promise<ConversationUnreadSummary> {
    return apiRequest<ConversationUnreadSummary>(
      '/users/me/conversations/unread-summary',
    );
  },

  getConversation(id: string): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(`/conversations/${id}`);
  },

  listMessages(
    conversationId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<MessagesPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<MessagesPage>(
      `/conversations/${conversationId}/messages${suffix}`,
    );
  },

  listConversationMedia(
    conversationId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<ConversationMediaPage> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<ConversationMediaPage>(
      `/conversations/${conversationId}/media${suffix}`,
    );
  },

  sendMessage(
    conversationId: string,
    input: {
      body?: string;
      mediaAssetIds?: string[];
      clientMessageId?: string;
    },
  ): Promise<ApiMessage> {
    return apiRequest<ApiMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  markRead(
    conversationId: string,
    throughMessageId: string,
  ): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(
      `/conversations/${conversationId}/read`,
      {
        method: 'POST',
        body: JSON.stringify({ throughMessageId }),
      },
    );
  },

  archive(conversationId: string): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(
      `/conversations/${conversationId}/archive`,
      { method: 'POST' },
    );
  },

  unarchive(conversationId: string): Promise<ApiConversation> {
    return apiRequest<ApiConversation>(
      `/conversations/${conversationId}/unarchive`,
      { method: 'POST' },
    );
  },

  softDelete(conversationId: string): Promise<void> {
    return apiRequest<void>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  },
};
