const URL_REUSE_MARGIN_MS = 5 * 60 * 1000;

export type MergeableAttachment = {
  mediaAssetId: string;
  url?: string | null;
};

export type MergeableMessage = {
  id: string;
  createdAt: string;
  sequence?: number;
  attachments?: MergeableAttachment[] | null;
  receiptStatus?: 'sent' | 'delivered' | 'read' | null;
};

const RECEIPT_RANK: Record<'sent' | 'delivered' | 'read', number> = {
  sent: 1,
  delivered: 2,
  read: 3,
};

/** A late poll must not replace a read tick with an older sent or delivered tick. */
export function preferReceiptStatus<T extends MergeableMessage['receiptStatus']>(
  previous: T,
  incoming: T,
): T {
  const previousRank = previous ? RECEIPT_RANK[previous] ?? 0 : 0;
  const incomingRank = incoming ? RECEIPT_RANK[incoming] ?? 0 : 0;
  if (previousRank > incomingRank) return previous;
  return incomingRank > 0 ? incoming : previous;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    normalized.length % 4 === 0
      ? ''
      : '='.repeat(4 - (normalized.length % 4));
  return globalThis.atob(normalized + pad);
}

function signedUrlExpiryMs(url: string): number | null {
  try {
    const token = new URL(url).searchParams.get('token');
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Public URLs and unreadable tokens stay reusable. Near-expiry signatures do not. */
export function signedUrlStillUsable(
  url: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!url) return false;
  const expiry = signedUrlExpiryMs(url);
  if (expiry == null) return true;
  return expiry - now > URL_REUSE_MARGIN_MS;
}

function mergeMessage<T extends MergeableMessage>(
  previous: T,
  incoming: T,
  now: number,
): T {
  const merged: T = { ...previous, ...incoming, receiptStatus: preferReceiptStatus(
    previous.receiptStatus,
    incoming.receiptStatus,
  ) };
  if (!previous.attachments || !incoming.attachments) return merged;
  const priorByAsset = new Map(
    previous.attachments.map((attachment) => [
      attachment.mediaAssetId,
      attachment,
    ]),
  );
  merged.attachments = incoming.attachments.map((attachment) => {
    const prior = priorByAsset.get(attachment.mediaAssetId);
    if (!prior?.url || !signedUrlStillUsable(prior.url, now)) return attachment;
    return { ...attachment, url: prior.url };
  });
  return merged;
}

/**
 * Poll merge. The same media asset keeps the URL already on screen so a new
 * signature does not reload the image. A different asset id takes the new URL.
 */
export function mergeChatMessages<T extends MergeableMessage>(
  existing: T[],
  incoming: T[],
  now = Date.now(),
  preserveExistingUrls = true,
): T[] {
  const byId = new Map<string, T>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) {
    const previous = byId.get(message.id);
    if (!previous) {
      byId.set(message.id, message);
      continue;
    }
    byId.set(
      message.id,
      preserveExistingUrls
        ? mergeMessage(previous, message, now)
        : {
            ...previous,
            ...message,
            receiptStatus: preferReceiptStatus(
              previous.receiptStatus,
              message.receiptStatus,
            ),
          },
    );
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (
      Number.isInteger(a.sequence) &&
      Number.isInteger(b.sequence) &&
      a.sequence !== b.sequence
    ) {
      return a.sequence! - b.sequence!;
    }
    const delta =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
