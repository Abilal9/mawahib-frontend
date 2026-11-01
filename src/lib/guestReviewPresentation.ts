/**
 * Map public reviews onto the signed-in ReviewItem presentation model.
 * No RN imports.
 */

import { formatReviewTimeAgo } from '../utils/reviewsMapping';
import {
  reviewImageUrls,
  type ReviewMediaItem,
} from './reviewMedia';

export type GuestReviewLike = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  reviewer: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  media?: ReviewMediaItem[];
  contextLabel?: string;
  receivedAs?: 'provider' | 'client';
};

export function guestReviewToItem(
  review: GuestReviewLike,
  now: Date = new Date(),
) {
  const images = reviewImageUrls(review.media, undefined, 4);
  return {
    id: review.id,
    authorId: review.reviewer.id,
    authorName: review.reviewer.displayName,
    authorAvatar: review.reviewer.avatarUrl ?? '',
    timeAgo: formatReviewTimeAgo(review.createdAt, now),
    rating: review.rating,
    serviceName: review.contextLabel ?? '',
    body: review.text,
    images,
    receivedAs: review.receivedAs,
    media: review.media,
  };
}
