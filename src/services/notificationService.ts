import { Notification } from '../data/types';
import {
  notificationsApi,
  type ApiNotification,
  type ApiNotificationType,
} from './notificationsApi';

type UiNotificationType = Notification['type'];

function mapType(type: ApiNotificationType): UiNotificationType {
  switch (type) {
    case 'connection_request':
    case 'connection_accepted':
      return 'follow';
    case 'message_received':
      return 'message';
    case 'engagement_status':
    case 'work_request_event':
      return 'job';
    case 'post_liked':
      return 'like';
    case 'post_commented':
      return 'comment';
    case 'system':
    default:
      return 'system';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export interface NotificationDeepLink {
  screen?: string;
  params?: Record<string, unknown>;
}

export function parseNotificationPayload(
  payload: unknown,
): NotificationDeepLink {
  if (!isRecord(payload)) return {};
  const screen =
    typeof payload.screen === 'string' ? payload.screen : undefined;
  const params = isRecord(payload.params) ? payload.params : undefined;
  return { screen, params };
}

const KNOWN_EVENT_SUMMARIES = new Set([
  'sent you a message',
  'started a chat with you',
  'started a conversation with you',
  'a work chat was started',
  'a work chat has started',
  'wants to connect with you',
  'accepted your connection request',
  'sent you a work request',
  'accepted your work request',
  'rejected your work request',
  'requested changes',
  'started the job',
  'marked the job as delivered',
  'declined the delivery',
  'completed the job',
]);

/**
 * Build compact event-summary copy. Never surface raw message / attachment
 * contents — including for legacy rows that stored the chat body.
 */
function eventCopy(api: ApiNotification): {
  title: string;
  message: string;
  context?: string;
} {
  const deep = parseNotificationPayload(api.payload);
  const params = deep.params ?? {};
  const actorName = api.actor?.displayName?.trim();
  const jobTitle =
    typeof params.jobTitle === 'string' && params.jobTitle.trim()
      ? params.jobTitle.trim()
      : undefined;
  const event =
    typeof params.event === 'string' ? params.event : undefined;

  switch (api.type) {
    case 'message_received': {
      if (event === 'work_chat_started') {
        return {
          title: 'A work chat has started',
          message: jobTitle
            ? jobTitle
            : actorName
              ? `with ${actorName}`
              : 'Work conversation is ready',
          context: actorName && jobTitle ? `with ${actorName}` : undefined,
        };
      }
      const started =
        event === 'conversation_started' ||
        /started a (chat|conversation)/i.test(api.body);
      // Legacy per-message rows may still exist; show a neutral summary and
      // never the message body. New sends no longer create those rows.
      return {
        title: actorName || api.title || 'Messages',
        message: started
          ? 'started a conversation with you'
          : 'sent you a message',
        context: jobTitle,
      };
    }
    case 'connection_request':
      return {
        title: actorName || api.title || 'Connection request',
        message: 'wants to connect with you',
      };
    case 'connection_accepted':
      return {
        title: actorName || api.title || 'Connection',
        message: 'accepted your connection request',
      };
    case 'post_liked':
      return {
        title: actorName || api.title || 'Someone',
        message: 'liked your post',
      };
    case 'post_commented': {
      const preview =
        typeof params.commentPreview === 'string' && params.commentPreview.trim()
          ? params.commentPreview.trim()
          : undefined;
      return {
        title: actorName || api.title || 'Someone',
        message: 'commented on your post',
        context: preview,
      };
    }
    case 'engagement_status':
    case 'work_request_event': {
      const body = api.body.trim();
      const safeBody = KNOWN_EVENT_SUMMARIES.has(body.toLowerCase())
        ? body
        : body.length <= 80 && !body.includes('\n')
          ? body
          : 'updated a work request';
      return {
        title: actorName || api.title || 'Work update',
        message: safeBody,
        context: jobTitle,
      };
    }
    default:
      return {
        title: actorName || api.title || 'Notification',
        message:
          api.body.trim().length > 120
            ? 'You have a new notification'
            : api.body.trim() || 'You have a new notification',
        context: jobTitle,
      };
  }
}

export function mapApiNotification(api: ApiNotification): Notification {
  const deep = parseNotificationPayload(api.payload);
  const params = deep.params ?? {};
  const copy = eventCopy(api);

  const conversationId =
    typeof params.conversationId === 'string'
      ? params.conversationId
      : undefined;
  // Never treat connection `requestId` as a work request id.
  const userJobId =
    typeof params.workRequestId === 'string'
      ? params.workRequestId
      : deep.screen === 'work_request' || deep.screen === 'WorkRequestDetail'
        ? typeof params.requestId === 'string'
          ? params.requestId
          : undefined
        : undefined;
  const jobId =
    typeof params.listingId === 'string' ? params.listingId : undefined;
  const postId =
    typeof params.postId === 'string' ? params.postId : undefined;

  return {
    id: api.id,
    type: mapType(api.type),
    title: copy.title,
    message: copy.message,
    context: copy.context,
    createdAt: api.createdAt,
    read: !!api.readAt,
    conversationId,
    userJobId,
    jobId,
    postId,
    user: api.actor
      ? {
          id: api.actor.id,
          name: api.actor.displayName,
          username: api.actor.username,
          avatar: api.actor.avatarUrl ?? '',
          followers: 0,
          following: 0,
          posts: 0,
        }
      : undefined,
    deepLink: deep,
    apiType: api.type,
    payload: api.payload,
  };
}

export const notificationService = {
  async listPage(
    accessToken?: string,
    options?: { cursor?: string | null; take?: number },
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const page = await notificationsApi.list({
      accessToken,
      cursor: options?.cursor,
      take: options?.take,
    });
    return {
      items: page.items.map(mapApiNotification),
      nextCursor: page.nextCursor,
    };
  },

  async markRead(id: string, accessToken?: string): Promise<void> {
    await notificationsApi.markRead(id, accessToken);
  },

  async markAllRead(accessToken?: string): Promise<void> {
    await notificationsApi.markAllRead(accessToken);
  },

  async unreadCount(accessToken?: string): Promise<number> {
    const summary = await notificationsApi.unreadSummary(accessToken);
    return summary.unreadCount;
  },
};
