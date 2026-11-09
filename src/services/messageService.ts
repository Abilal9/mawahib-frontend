import { User } from '../data/types';
import {
  messagingApi,
  type ApiConversation,
  type ApiMessage,
  type ConversationListScope,
  type PeerSummary,
} from './messagingApi';

function peerToUser(peer: PeerSummary | null | undefined): User {
  if (!peer) {
    return {
      id: '',
      name: 'Unknown',
      username: 'unknown',
      avatar: '',
      followers: 0,
      following: 0,
      posts: 0,
    };
  }
  return {
    id: peer.id,
    name: peer.displayName,
    username: peer.username,
    avatar: peer.avatarUrl ?? '',
    isVerified: peer.isVerified,
    title: peer.title ?? undefined,
    followers: 0,
    following: 0,
    posts: 0,
  };
}

export function isConversationUnread(c: ApiConversation): boolean {
  return c.hasUnread === true;
}

/** Inbox subtitle. A real last message wins over the job title. */
export function conversationPreview(c: ApiConversation): string {
  const raw = c.lastMessagePreview?.trim() ?? '';
  if (raw === '[attachment]') return 'Photo';
  if (raw) return raw;
  if (c.type === 'work' && c.workContext?.title) return c.workContext.title;
  return 'No messages yet';
}

export const messageService = {
  listConversations(
    type?: 'connection' | 'work',
    scope: ConversationListScope = 'inbox',
  ): Promise<ApiConversation[]> {
    return messagingApi.listConversations(type, scope);
  },

  getConversation(id: string): Promise<ApiConversation> {
    return messagingApi.getConversation(id);
  },

  async getMessages(
    conversationId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<{ items: ApiMessage[]; nextCursor: string | null }> {
    return messagingApi.listMessages(conversationId, params);
  },

  sendMessage(
    conversationId: string,
    input: {
      body?: string;
      mediaAssetIds?: string[];
      clientMessageId?: string;
    },
  ): Promise<ApiMessage> {
    return messagingApi.sendMessage(conversationId, input);
  },

  markRead(
    conversationId: string,
    throughMessageId: string,
  ): Promise<ApiConversation> {
    return messagingApi.markRead(conversationId, throughMessageId);
  },

  archive(conversationId: string): Promise<ApiConversation> {
    return messagingApi.archive(conversationId);
  },

  unarchive(conversationId: string): Promise<ApiConversation> {
    return messagingApi.unarchive(conversationId);
  },

  softDelete(conversationId: string): Promise<void> {
    return messagingApi.softDelete(conversationId);
  },

  unreadSummary(): Promise<{ unreadCount: number }> {
    return messagingApi.unreadSummary();
  },

  peerToUser,

  findWorkConversation(
    conversations: ApiConversation[],
    engagementId: string,
  ): ApiConversation | undefined {
    return conversations.find(
      (c) =>
        c.type === 'work' &&
        (c.workEngagementId === engagementId ||
          c.workContext?.engagementId === engagementId),
    );
  },
};
