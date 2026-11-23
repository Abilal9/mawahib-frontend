import { reviewCountLabel as localizedReviewCount } from '../i18n/runtime';

export interface ReviewAggregate {
  average: number | null;
  count: number;
  /** Published counts for star values 1 through 5. */
  stars?: [number, number, number, number, number];
}

export interface ReviewSummaryPair {
  overall: ReviewAggregate;
  asProvider: ReviewAggregate;
  asClient: ReviewAggregate;
}

export const EMPTY_AGGREGATE: ReviewAggregate = { average: null, count: 0 };

function emptyUserAggregate(): ReviewAggregate {
  return { average: null, count: 0, stars: [0, 0, 0, 0, 0] };
}

export const EMPTY_REVIEW_SUMMARY: ReviewSummaryPair = {
  overall: emptyUserAggregate(),
  asProvider: emptyUserAggregate(),
  asClient: emptyUserAggregate(),
};

type RatedUser = {
  reviewSummary?: ReviewSummaryPair;
  rating?: number;
  reviewCount?: number;
};

/** Every published review this person received, as talent or as client. */
export function overallAggregate(user: RatedUser | null | undefined): ReviewAggregate {
  if (user?.reviewSummary?.overall) return user.reviewSummary.overall;
  const count = user?.reviewCount ?? 0;
  return {
    average: count > 0 ? (user?.rating ?? null) : null,
    count,
  };
}

export function reviewCountLabel(count: number): string {
  return localizedReviewCount(count);
}

export function formatReviewAverage(average: number | null | undefined): string | null {
  if (average == null || Number.isNaN(average)) return null;
  return average.toFixed(1);
}

/** Display-only. Eligibility stays on the server deadline. */
export function reviewByLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `Review by ${formatted}`;
}

export function ratingFields(aggregate: ReviewAggregate | null | undefined): {
  rating: number;
  reviewCount: number;
} {
  return {
    rating: aggregate?.average ?? 0,
    reviewCount: aggregate?.count ?? 0,
  };
}
