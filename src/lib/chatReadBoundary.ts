export interface ReadBoundaryMessage {
  id: string;
  sequence?: number | null;
}

/**
 * The message id the client may report as read.
 * Only a visible prefix of not-yet-read messages counts. A newer message that
 * is loaded but not visible stays unread, including one that shares a timestamp.
 * Unloaded older messages also block the boundary, because sequence gaps are
 * not assumed to be empty.
 */
export function visibleReadBoundaryId(input: {
  messages: ReadBoundaryMessage[];
  visibleIds: ReadonlySet<string>;
  lastReadSequence: number | null;
  hasOlder: boolean;
}): string | null {
  const loaded = input.messages.filter(
    (message): message is ReadBoundaryMessage & { sequence: number } =>
      typeof message.sequence === 'number' &&
      Number.isInteger(message.sequence) &&
      message.sequence > 0 &&
      message.id.length > 0,
  );
  if (loaded.length === 0) return null;

  const minLoaded = loaded.reduce(
    (min, message) => Math.min(min, message.sequence),
    loaded[0].sequence,
  );
  const noUnreadUnloaded =
    !input.hasOlder ||
    (input.lastReadSequence != null &&
      input.lastReadSequence >= minLoaded - 1);
  if (!noUnreadUnloaded) return null;

  const unread = loaded
    .filter(
      (message) =>
        input.lastReadSequence == null ||
        message.sequence > input.lastReadSequence,
    )
    .sort((a, b) => a.sequence - b.sequence);

  let boundary: (typeof unread)[number] | null = null;
  for (const message of unread) {
    if (!input.visibleIds.has(message.id)) break;
    boundary = message;
  }
  return boundary?.id ?? null;
}

/** Read state advances only while this conversation is on screen. */
export function canAcknowledgeRead(input: {
  appActive: boolean;
  focused: boolean;
}): boolean {
  return input.appActive && input.focused;
}

export interface ConversationReadSnapshot {
  id: string;
  lastReadSequence: number | null;
  hasUnread: boolean;
}

/**
 * A refresh captured before a read acknowledgement must not move the local
 * marker backward. Other conversation fields still update.
 */
export function applyConversationSnapshot<T extends ConversationReadSnapshot>(
  current: T | null,
  incoming: T,
): T {
  if (
    current &&
    current.id === incoming.id &&
    current.lastReadSequence != null &&
    (incoming.lastReadSequence == null ||
      incoming.lastReadSequence < current.lastReadSequence)
  ) {
    return {
      ...incoming,
      lastReadSequence: current.lastReadSequence,
      hasUnread: current.hasUnread,
    };
  }
  return incoming;
}

export interface UnreadDividerMessage {
  id: string;
  sequence?: number | null;
  kind: string;
  senderId: string | null;
}

/**
 * The first unread incoming message, once that prefix is loaded.
 * An older unloaded page may contain the real start, so the latest page
 * must not invent a divider there.
 */
export function unreadDividerMessageId(input: {
  messages: UnreadDividerMessage[];
  viewerId: string;
  lastReadSequence: number | null;
  hasOlder: boolean;
}): string | null {
  const sequenced = input.messages.filter(
    (message): message is UnreadDividerMessage & { sequence: number } =>
      typeof message.sequence === 'number' &&
      Number.isInteger(message.sequence) &&
      message.sequence > 0,
  );
  if (sequenced.length === 0) return null;
  const minLoaded = sequenced.reduce(
    (min, message) => Math.min(min, message.sequence),
    sequenced[0].sequence,
  );
  const unreadMightBeUnloaded =
    input.hasOlder &&
    (input.lastReadSequence == null ||
      input.lastReadSequence < minLoaded - 1);
  if (unreadMightBeUnloaded) return null;

  const chronological = [...sequenced].sort((a, b) => a.sequence - b.sequence);
  const first = chronological.find(
    (message) =>
      message.kind === 'user' &&
      message.senderId != null &&
      message.senderId !== input.viewerId &&
      (input.lastReadSequence == null ||
        message.sequence > input.lastReadSequence),
  );
  return first?.id ?? null;
}
