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
