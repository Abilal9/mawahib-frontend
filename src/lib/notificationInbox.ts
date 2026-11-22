export type OrderedNotification = {
  id: string;
  createdAt: string;
};

/** Newest first. The same timestamp stays ordered by id so pages do not skip or repeat a row. */
export function compareNotifications(a: OrderedNotification, b: OrderedNotification): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * A refresh always asks for the first page. Older pages keep the cursor they
 * already walked. A new category never reuses another category's cursor.
 */
export function notificationListQuery(input: {
  mode: 'refresh' | 'more';
  category: string | null;
  cursor: string | null;
}): { category: string | null; cursor?: string } {
  if (input.mode === 'more' && input.cursor) {
    return { category: input.category, cursor: input.cursor };
  }
  return { category: input.category };
}

/** Drop a page that belongs to an older request, another category, or another account. */
export function acceptNotificationResult(input: {
  requestGeneration: number;
  currentGeneration: number;
  requestCategory: string | null;
  currentCategory: string | null;
  staleIdentity: boolean;
}): boolean {
  return (
    input.requestGeneration === input.currentGeneration &&
    input.requestCategory === input.currentCategory &&
    !input.staleIdentity
  );
}

export type NotificationListPhase = 'loading' | 'error' | 'empty' | 'ready';

/** Empty is only a finished category with nothing left to load. */
export function notificationListPhase(input: {
  loading: boolean;
  failed: boolean;
  count: number;
  hasMore: boolean;
}): NotificationListPhase {
  if (input.loading && input.count === 0) return 'loading';
  if (input.failed && input.count === 0) return 'error';
  if (!input.loading && !input.failed && input.count === 0 && !input.hasMore) return 'empty';
  return 'ready';
}

/**
 * A refresh keeps rows already loaded, and the next older page starts at the
 * new first page. Keeping the previous continuation cursor would skip rows
 * that arrived between that page and the old boundary.
 */
export function applyNotificationRefresh<T extends OrderedNotification>(
  existing: T[],
  page: { items: T[]; nextCursor: string | null },
): { items: T[]; cursor: string | null; hasMore: boolean } {
  return {
    items: page.nextCursor === null ? page.items : mergeNotificationPages(existing, page.items),
    cursor: page.nextCursor,
    hasMore: page.nextCursor !== null,
  };
}

/** Incoming rows replace the same id. Rows already loaded from older pages stay. */
export function mergeNotificationPages<T extends OrderedNotification>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(compareNotifications);
}
