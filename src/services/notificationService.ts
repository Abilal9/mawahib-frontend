import { Notification } from '../data/types';
import { notificationDisplayCopy } from '../i18n/noticeCopy';
import { uiTypeForApiType } from '../lib/notificationCategories';
import {
  notificationsApi,
  type ApiNotification,
  type ApiNotificationType,
} from './notificationsApi';

type UiNotificationType = Notification['type'];

function mapType(type: ApiNotificationType): UiNotificationType {
  return uiTypeForApiType(type);
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
  return notificationDisplayCopy({
    type: api.type,
    title: api.title,
    body: api.body,
    actorName: api.actor?.displayName?.trim(),
    params,
  });
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
    options?: { cursor?: string | null; take?: number; category?: string | null },
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const page = await notificationsApi.list({
      accessToken,
      cursor: options?.cursor,
      take: options?.take,
      category: options?.category,
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
