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

/** Incoming rows replace the same id. Rows already loaded from older pages stay. */
export function mergeNotificationPages<T extends OrderedNotification>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(compareNotifications);
}
