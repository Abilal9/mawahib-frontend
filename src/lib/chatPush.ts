export type ChatPushTarget = {
  conversationId: string;
  recipientUserId: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function chatPushTarget(data: unknown): ChatPushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.type !== 'chat_message') return null;
  if (typeof record.conversationId !== 'string' || !UUID.test(record.conversationId)) return null;
  if (typeof record.recipientUserId !== 'string' || !UUID.test(record.recipientUserId)) return null;
  return { conversationId: record.conversationId, recipientUserId: record.recipientUserId };
}

export type ChatPushRoute = 'wait' | 'sign-in' | 'unavailable' | 'open';

/** A tap never marks messages read and never changes the signed-in account. */
export function chatPushRoute(input: {
  sessionReady: boolean;
  signedInUserId: string | null;
  target: ChatPushTarget;
}): ChatPushRoute {
  if (!input.sessionReady) return 'wait';
  if (!input.signedInUserId) return 'sign-in';
  if (input.signedInUserId !== input.target.recipientUserId) return 'unavailable';
  return 'open';
}

export function shouldRenewChatPushViewing(input: {
  appActive: boolean;
  focused: boolean;
}): boolean {
  return input.appActive && input.focused;
}

export function canRegisterChatPush(input: {
  expoGo: boolean;
  projectId: string | null;
  permission: 'granted' | 'denied' | 'undetermined';
}): boolean {
  return !input.expoGo && Boolean(input.projectId) && input.permission === 'granted';
}

const seenResponses = new Set<string>();

export function claimChatPushResponse(identifier: string): boolean {
  if (!identifier || seenResponses.has(identifier)) return false;
  seenResponses.add(identifier);
  return true;
}
