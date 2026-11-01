/**
 * Star-bucket helpers with no RN imports so Node selftests can execute them.
 */

export type ReviewStarBucket = {
  stars: 1 | 2 | 3 | 4 | 5;
  percent: number;
};

/**
 * Convert published 1–5 counts into bar percents.
 * Returns null when buckets are absent so callers do not fabricate zeros.
 */
export function distributionFromStars(
  stars: readonly number[] | undefined,
  total: number,
): ReviewStarBucket[] | null {
  if (!stars || stars.length !== 5) return null;
  return ([5, 4, 3, 2, 1] as const).map((star) => ({
    stars: star,
    percent: total === 0 ? 0 : (stars[star - 1] ?? 0) / total,
  }));
}
