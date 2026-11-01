/** Mirror of Phase D public pagination caps. */
export const PUBLIC_DEFAULT_TAKE = 20;
export const PUBLIC_MAX_TAKE = 20;
export const PUBLIC_MAX_SKIP = 200;
export const PUBLIC_Q_MIN_LENGTH = 2;
export const PUBLIC_Q_MAX_LENGTH = 120;
export const PUBLIC_MAX_CATEGORY_FILTERS = 11;

const PUBLIC_CATEGORY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicReviewRole = 'provider' | 'client';

export type PublicCursorQuery = {
  cursor?: string | null;
  take?: number;
  role?: PublicReviewRole;
};

export type PublicSearchQuery = {
  q?: string;
  skip?: number;
  take?: number;
  categoryIds?: string[];
};

function clampTake(take: number | undefined): number {
  const next = take ?? PUBLIC_DEFAULT_TAKE;
  return Math.max(1, Math.min(next, PUBLIC_MAX_TAKE));
}

function clampSkip(skip: number | undefined): number {
  const next = skip ?? 0;
  return Math.max(0, Math.min(next, PUBLIC_MAX_SKIP));
}

function toQuery(
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Cursor pages. Omits empty cursor. Caps take at 20. */
export function publicReviewRoleQuery(
  raw: string | null | undefined,
): PublicReviewRole | undefined {
  if (raw === 'provider' || raw === 'client') return raw;
  return undefined;
}

export function buildPublicCursorQuery(input: PublicCursorQuery = {}): string {
  return toQuery({
    cursor: input.cursor || undefined,
    take: clampTake(input.take),
    role: publicReviewRoleQuery(input.role),
  });
}

/**
 * Canonical public category IDs only. Drops malformed tokens and caps at 11.
 * Does not send authenticated extras (status, sort, locationCode).
 */
export function publicCategoryIdsQuery(
  raw: string[] | undefined,
): string | undefined {
  if (!raw?.length) return undefined;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw) {
    const token = value.trim();
    if (!PUBLIC_CATEGORY_UUID.test(token)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(token);
    if (ids.length >= PUBLIC_MAX_CATEGORY_FILTERS) break;
  }
  return ids.length ? ids.join(',') : undefined;
}

/**
 * Offset search/browse. Omits `q` when missing or shorter than 2.
 * Public category IDs are allowlisted separately from authenticated extras.
 */
export function buildPublicSearchQuery(input: PublicSearchQuery = {}): string {
  const raw = input.q?.trim() ?? '';
  const q =
    raw.length >= PUBLIC_Q_MIN_LENGTH
      ? raw.slice(0, PUBLIC_Q_MAX_LENGTH)
      : undefined;
  return toQuery({
    q,
    skip: clampSkip(input.skip),
    take: clampTake(input.take),
    categoryIds: publicCategoryIdsQuery(input.categoryIds),
  });
}
