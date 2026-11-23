import type { MessageKey } from './messages';
import { t } from './runtime';

type NoticeInput = {
  type: string;
  title: string;
  body: string;
  actorName?: string;
  params: Record<string, unknown>;
};

const SYSTEM_TITLES: Record<string, MessageKey> = {
  Messages: 'notice.titleMessages',
  'Connection request': 'notice.titleConnectionRequest',
  Connection: 'notice.titleConnection',
  Someone: 'notice.titleSomeone',
  'Work update': 'notice.titleWorkUpdate',
  'Work request': 'notice.titleWorkRequest',
  Notification: 'notice.titleNotification',
  'the other party': 'notice.otherParty',
};

const WORK_REQUEST_BODIES: Record<string, MessageKey> = {
  'sent you a work request': 'notice.sentWorkRequest',
  'accepted your work request': 'notice.acceptedWorkRequest',
  'rejected your work request': 'notice.rejectedWorkRequest',
  'selected you — review and accept the request': 'notice.selectedApplicant',
  'cancelled the accepted work before payment': 'notice.cancelledBeforePayment',
  'requested changes': 'notice.requestedChanges',
};

const ENGAGEMENT_BODIES: Record<string, MessageKey> = {
  'started the job': 'notice.startedJob',
  'marked the job as delivered': 'notice.markedDelivered',
  'declined the delivery': 'notice.declinedDelivery',
  'completed the job': 'notice.completedJob',
  'mawahib closed this work. payments and invoices are unchanged.': 'notice.closedByMawahib',
  'mawahib cancelled this unpaid work. no refund is issued.': 'notice.cancelledUnpaid',
};

const SYSTEM_EVENTS: Record<string, MessageKey> = {
  hid_review: 'notice.hidReview',
  hid_post: 'notice.hidPost',
  hid_comment: 'notice.hidComment',
  hid_job: 'notice.hidJob',
  hid_service: 'notice.hidService',
};

function staffEventMessage(params: Record<string, unknown>): string | null {
  const event = textParam(params, 'event');
  const audience = textParam(params, 'audience');
  if (event === 'returned_for_client_review' && audience === 'client') return t('notice.reviewAgainClient');
  if (event === 'returned_for_client_review' && audience === 'provider') return t('notice.reviewAgainProvider');
  if (event === 'further_work_agreed' && audience === 'client') return t('notice.furtherWorkClient');
  if (event === 'further_work_agreed' && audience === 'provider') return t('notice.furtherWorkProvider');
  if (event === 'closed_by_mawahib') return t('notice.closedByMawahib');
  if (event === 'cancelled_unpaid') return t('notice.cancelledUnpaid');
  const hidden = event ? SYSTEM_EVENTS[event] : undefined;
  return hidden ? t(hidden) : null;
}

const SYSTEM_BODIES: Record<string, MessageKey> = {
  'Mawahib hid one of your reviews.': 'notice.hidReview',
  'Mawahib hid one of your posts.': 'notice.hidPost',
  'Mawahib hid one of your comments.': 'notice.hidComment',
  'Mawahib hid one of your jobs.': 'notice.hidJob',
  'Mawahib hid one of your services.': 'notice.hidService',
};

function textParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function systemTitle(actorName: string | undefined, storedTitle: string, fallback: MessageKey): string {
  if (actorName) return actorName;
  const known = SYSTEM_TITLES[storedTitle];
  if (known) return t(known);
  if (storedTitle.trim()) return storedTitle;
  return t(fallback);
}

function engagementMessage(params: Record<string, unknown>, body: string): string {
  return staffEventMessage(params) ?? (params.closedByMawahib === true
    ? t('notice.closedByMawahib')
    : params.cancelledByMawahib === true
      ? t('notice.cancelledUnpaid')
      : knownOrStored(body.trim(), ENGAGEMENT_BODIES));
}

function knownOrStored(body: string, table: Record<string, MessageKey>): string {
  const key = table[body] ?? table[body.toLowerCase()];
  if (key) return t(key);
  const trimmed = body.trim();
  if (trimmed.length > 0) return trimmed;
  return t('notice.generic');
}

/**
 * Display copy from notification type and payload. Stored titles that are
 * people's names, job titles, and comment previews are not rewritten.
 * An unknown stored sentence stays as written, including long or multi-line text.
 * Chat notices never use that sentence; they use the message type instead.
 */
export function notificationDisplayCopy(input: NoticeInput): {
  title: string;
  message: string;
  context?: string;
} {
  const jobTitle = textParam(input.params, 'jobTitle');
  const event = textParam(input.params, 'event');
  const actorName = input.actorName?.trim() || undefined;

  switch (input.type) {
    case 'message_received': {
      if (event === 'work_chat_started') {
        return {
          title: t('notice.workChatStarted'),
          message: jobTitle ? jobTitle : actorName ? t('notice.withPerson', { name: actorName }) : t('notice.workChatReady'),
          context: actorName && jobTitle ? t('notice.withPerson', { name: actorName }) : undefined,
        };
      }
      const body = input.body.trim().toLowerCase();
      const started =
        event === 'conversation_started' ||
        body === 'started a conversation with you' ||
        body === 'started a chat with you';
      return {
        title: systemTitle(actorName, input.title, 'notice.titleMessages'),
        message: started ? t('notice.conversationStarted') : t('notice.sentMessage'),
        context: jobTitle,
      };
    }
    case 'connection_request':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleConnectionRequest'),
        message: t('notice.connectionRequest'),
      };
    case 'connection_accepted':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleConnection'),
        message: t('notice.connectionAccepted'),
      };
    case 'post_liked':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleSomeone'),
        message: t('notice.likedPost'),
      };
    case 'post_commented':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleSomeone'),
        message: t('notice.commentedPost'),
        context: textParam(input.params, 'commentPreview'),
      };
    case 'engagement_status':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleWorkUpdate'),
        message: engagementMessage(input.params, input.body),
        context: jobTitle,
      };
    case 'work_request_event':
      return {
        title: systemTitle(actorName, input.title, 'notice.titleWorkRequest'),
        message: knownOrStored(input.body.trim(), WORK_REQUEST_BODIES),
        context: jobTitle,
      };
    case 'system': {
      const structured = staffEventMessage(input.params);
      const exact = SYSTEM_BODIES[input.body.trim()];
      return {
        title: input.title.trim() === 'Mawahib' ? 'Mawahib' : systemTitle(actorName, input.title, 'notice.titleNotification'),
        message: structured ?? (exact ? t(exact) : knownOrStored(input.body, {})),
        context: jobTitle,
      };
    }
    default:
      return {
        title: systemTitle(actorName, input.title, 'notice.titleNotification'),
        message: knownOrStored(input.body, {}),
        context: jobTitle,
      };
  }
}

export function systemChatText(input: { body: string; systemPayload: unknown }): string {
  if (!input.systemPayload || typeof input.systemPayload !== 'object' || Array.isArray(input.systemPayload)) {
    return input.body;
  }
  const record = input.systemPayload as Record<string, unknown>;
  if (record.event === 'engagement_in_progress') return t('system.workStarted');
  if (record.event === 'engagement_status') {
    if (record.toStatus === 'delivered') return t('system.workDelivered');
    if (record.toStatus === 'disputed') return t('system.deliveryDeclined');
    if (record.toStatus === 'completed') return t('system.workCompleted');
  }
  return input.body;
}

const TAB_LABELS: Record<string, MessageKey> = {
  All: 'notice.tabAll',
  Jobs: 'tab.jobs',
  Messages: 'tab.messages',
  Connections: 'nav.connections',
  Posts: 'notice.tabPosts',
  'Platform Updates': 'notice.tabPlatform',
};

export function notificationTabLabel(tab: string): string {
  const key = TAB_LABELS[tab];
  return key ? t(key) : tab;
}
