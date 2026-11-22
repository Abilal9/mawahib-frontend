/** Values sent as `category`. All omits the parameter. */
export const NOTIFICATION_LIST_CATEGORIES = [
  'jobs',
  'messages',
  'connections',
  'posts',
  'platform_updates',
] as const;

export type NotificationListCategory = (typeof NOTIFICATION_LIST_CATEGORIES)[number];

export type NotificationScreenTab =
  | 'All'
  | 'Jobs'
  | 'Messages'
  | 'Connections'
  | 'Posts'
  | 'Platform Updates';

const API_CATEGORY: Record<NotificationListCategory, Exclude<NotificationScreenTab, 'All'>> = {
  jobs: 'Jobs',
  messages: 'Messages',
  connections: 'Connections',
  posts: 'Posts',
  platform_updates: 'Platform Updates',
};

export function notificationCategoryParam(
  tab: NotificationScreenTab,
): NotificationListCategory | null {
  switch (tab) {
    case 'Jobs':
      return 'jobs';
    case 'Messages':
      return 'messages';
    case 'Connections':
      return 'connections';
    case 'Posts':
      return 'posts';
    case 'Platform Updates':
      return 'platform_updates';
    case 'All':
      return null;
  }
}

/** UI row type for an API notification. Unknown and legacy types stay system. */
export function uiTypeForApiType(
  type: string,
): 'like' | 'comment' | 'follow' | 'job' | 'message' | 'system' {
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
    default:
      return 'system';
  }
}

export function screenTabForUiType(type: string): Exclude<NotificationScreenTab, 'All'> {
  switch (type) {
    case 'job':
      return 'Jobs';
    case 'message':
      return 'Messages';
    case 'follow':
      return 'Connections';
    case 'like':
    case 'comment':
      return 'Posts';
    default:
      return 'Platform Updates';
  }
}

/** Same event mapping as the server. Anything else, including a legacy type, is Platform Updates. */
export function categoryForApiType(type: string): Exclude<NotificationScreenTab, 'All'> {
  return screenTabForUiType(uiTypeForApiType(type));
}

export function tabForListCategory(
  category: NotificationListCategory | null,
): NotificationScreenTab {
  if (!category) return 'All';
  return API_CATEGORY[category];
}
