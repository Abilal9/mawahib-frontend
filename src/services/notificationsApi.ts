import { apiRequest } from '../lib/apiClient';

export type ApiNotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'message_received'
  | 'engagement_status'
  | 'work_request_event'
  | 'system'
  | 'post_liked'
  | 'post_commented';

export interface NotificationActor {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface ApiNotification {
  id: string;
  type: ApiNotificationType;
  title: string;
  body: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
  actor: NotificationActor | null;
}

export interface NotificationUnreadSummary {
  unreadCount: number;
}

export interface MarkAllReadResult {
  updatedCount: number;
}

export const notificationsApi = {
  list(options: {
    accessToken?: string;
    cursor?: string | null;
    take?: number;
  } = {}): Promise<{ items: ApiNotification[]; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (options.cursor) qs.set('cursor', options.cursor);
    if (options.take) qs.set('take', String(options.take));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiRequest<{ items: ApiNotification[]; nextCursor: string | null }>(
      `/users/me/notifications${suffix}`,
      { accessToken: options.accessToken },
    );
  },

  unreadSummary(accessToken?: string): Promise<NotificationUnreadSummary> {
    return apiRequest<NotificationUnreadSummary>(
      '/users/me/notifications/unread-summary',
      { accessToken },
    );
  },

  markRead(id: string, accessToken?: string): Promise<ApiNotification> {
    return apiRequest<ApiNotification>(`/users/me/notifications/${id}/read`, {
      method: 'POST',
      accessToken,
    });
  },

  markAllRead(accessToken?: string): Promise<MarkAllReadResult> {
    return apiRequest<MarkAllReadResult>('/users/me/notifications/read-all', {
      method: 'POST',
      accessToken,
    });
  },
};
