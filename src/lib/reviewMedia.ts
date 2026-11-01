/**
 * Review media helpers with no RN imports so Node selftests can execute them.
 */

export type ReviewMediaItem = {
  url: string | null | undefined;
  mimeType?: string | null;
};

const IMAGE_MIME = /^image\//i;

export function isReviewImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return true;
  return IMAGE_MIME.test(mimeType.trim());
}

export function isReviewVideoMime(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && /^video\//i.test(mimeType.trim()));
}

/** Image URLs eligible for the signed-in gallery. Videos are excluded. */
export function reviewImageUrls(
  media: ReviewMediaItem[] | undefined,
  fallbackImages: string[] | undefined,
  limit = 4,
): string[] {
  if (media && media.length > 0) {
    return media
      .filter(
        (item): item is ReviewMediaItem & { url: string } =>
          Boolean(item.url) && isReviewImageMime(item.mimeType),
      )
      .map((item) => item.url)
      .slice(0, limit);
  }
  return (fallbackImages ?? []).filter(Boolean).slice(0, limit);
}

export function reviewHasUnsupportedVideo(
  media: ReviewMediaItem[] | undefined,
): boolean {
  return Boolean(media?.some((item) => item.url && isReviewVideoMime(item.mimeType)));
}
