import type {
  ReviewDistribution,
  ReviewItem,
  ReviewsBundle,
} from '../data/types/reviews';
import type { ApiUserReview } from '../services/marketplaceApi';

/** `just now` · `5m ago` · `3h ago` · `2d ago` · `Mar 4, 2026`. */
export function formatReviewTimeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function mapApiReviewToItem(
  review: ApiUserReview,
  now: Date = new Date(),
): ReviewItem {
  return {
    id: review.id,
    authorId: review.reviewer.id,
    authorName: review.reviewer.displayName,
    authorAvatar: review.reviewer.avatarUrl ?? '',
    timeAgo: formatReviewTimeAgo(review.createdAt, now),
    rating: review.rating,
    serviceName: review.contextLabel,
    body: review.body,
    images: (review.media ?? [])
      .filter((item) => item.url && (!item.mimeType || /^image\//i.test(item.mimeType)))
      .map((item) => item.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
      .slice(0, 4),
    receivedAs: review.receivedAs,
  };
}

export function buildDistribution(
  reviews: Pick<ReviewItem, 'rating'>[],
): ReviewDistribution[] {
  const total = reviews.length;
  return ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    percent:
      total === 0
        ? 0
        : reviews.filter((r) => Math.round(r.rating) === stars).length / total,
  }));
}

/**
 * Reviews bundle from the real list API. `total` is the server count so the
 * header always matches the list; the average is computed from the loaded
 * rows when the whole list was fetched, otherwise from the profile aggregate.
 */
export function buildReviewsBundleFromApi(
  items: ApiUserReview[],
  serverTotal: number,
  profile: { rating?: number | null; reviewCount?: number | null } | null | undefined,
  now: Date = new Date(),
): ReviewsBundle {
  const mapped = items.map((item) => mapApiReviewToItem(item, now));
  const total = Math.max(serverTotal, 0);
  const complete = mapped.length >= total;
  let average = 0;
  if (mapped.length > 0 && complete) {
    average =
      Math.round(
        (mapped.reduce((sum, r) => sum + r.rating, 0) / mapped.length) * 10,
      ) / 10;
  } else if (total > 0 && (profile?.reviewCount ?? 0) > 0) {
    average = profile?.rating ?? 0;
  }
  return {
    average,
    total,
    distribution: buildDistribution(mapped),
    reviews: mapped,
  };
}
