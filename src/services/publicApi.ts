import { publicRequest } from '../lib/apiClient';
import {
  captureGuestRequestFence,
  isGuestResultStale,
} from '../lib/guestRequestFence';
import { StaleIdentityError } from '../lib/identityFences';
import {
  getProductTreeEpoch,
  isAuthenticatedProductActive,
} from '../lib/productTree';
import {
  buildPublicCursorQuery,
  buildPublicSearchQuery,
  PUBLIC_DEFAULT_TAKE,
  PUBLIC_MAX_SKIP,
  PUBLIC_MAX_TAKE,
  PUBLIC_Q_MAX_LENGTH,
  PUBLIC_Q_MIN_LENGTH,
  type PublicCursorQuery,
  type PublicSearchQuery,
} from './publicQuery';

export {
  buildPublicCursorQuery,
  buildPublicSearchQuery,
  PUBLIC_DEFAULT_TAKE,
  PUBLIC_MAX_SKIP,
  PUBLIC_MAX_TAKE,
  PUBLIC_Q_MAX_LENGTH,
  PUBLIC_Q_MIN_LENGTH,
};

export const PUBLIC_HOME_SECTION_TAKE = 8;
export const PUBLIC_HOME_POSTS_TAKE = 12;

export type GuestActorCard = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  title: string | null;
  accountType: string;
};

export type GuestMedia = {
  url: string;
  position: number;
};

export type GuestAbout = {
  languages: unknown[];
  education: unknown[];
  experience: unknown[];
  certifications: unknown[];
};

export type GuestReviewAggregate = {
  average: number | null;
  count: number;
  stars?: [number, number, number, number, number];
};

export type GuestReviewSummaryPair = {
  overall: GuestReviewAggregate;
  asProvider: GuestReviewAggregate;
  asClient: GuestReviewAggregate;
};

export type GuestProfile = {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  title: string | null;
  bio: string;
  skills: string[];
  reviewSummary: GuestReviewSummaryPair;
  postsCount: number;
  locationCity: string | null;
  locationCountry: string | null;
  about: GuestAbout | null;
};

export type GuestPost = {
  id: string;
  author: GuestActorCard;
  text: string;
  media: GuestMedia[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

export type GuestPostPage = {
  items: GuestPost[];
  nextCursor: string | null;
};

export type GuestJob = {
  id: string;
  title: string;
  description: string;
  companyName: string | null;
  employmentType: string;
  location: string;
  currency: string;
  pricingType: string;
  fixedAmount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  salaryLabel: string | null;
  categoryId: string | null;
  categoryName: string | null;
  customCategory: string | null;
  skills: string[];
  taxonomySkills: Array<{ id: string; name: string }>;
  poster: GuestActorCard;
  createdAt: string;
  postedAt: string | null;
};

export type GuestJobPage = {
  items: GuestJob[];
  take: number;
  skip: number;
};

export type GuestServicePackage = {
  name: 'Basic' | 'Standard' | 'Premium';
  priceLabel: string;
  delivery: string;
  includes: string[];
  price: number;
  currency: string;
};

export type GuestServiceAddon = {
  id: string;
  title: string;
  priceLabel: string;
  price: number;
  currency: string;
};

export type GuestService = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  categoryId: string | null;
  categoryName: string | null;
  customCategory: string | null;
  taxonomySkills: Array<{ id: string; name: string }>;
  currency: string;
  reviewSummary: GuestReviewAggregate;
  images: string[];
  packages: GuestServicePackage[];
  addons: GuestServiceAddon[];
  provider: GuestActorCard;
};

export type GuestPortfolio = {
  id: string;
  title: string;
  description: string;
  images: string[];
};

export type GuestReviewMedia = {
  url: string;
  mimeType: string;
};

export type GuestReview = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  reviewer: GuestActorCard;
  media: GuestReviewMedia[];
  contextLabel?: string;
  receivedAs?: 'provider' | 'client';
};

export type GuestReviewPage = {
  items: GuestReview[];
  nextCursor: string | null;
};

export type GuestExploreTalent = {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  title: string | null;
  bio: string;
  skills: string[];
  locationCity: string | null;
  locationCountry: string | null;
  reviewSummary: GuestReviewSummaryPair;
};

export type GuestExploreService = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  images: string[];
  reviewSummary: GuestReviewAggregate;
  provider: GuestActorCard;
  startingPrice: number | null;
  currency: string | null;
  fromPrice: boolean;
};

export type GuestExplorePage<T> = {
  items: T[];
  take: number;
  skip: number;
};

export type PublicTaxonomySkill = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
};

export type PublicTaxonomyCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  allowsCustomCategory?: boolean;
  skills: PublicTaxonomySkill[];
};

export type PublicTaxonomy = {
  categories: PublicTaxonomyCategory[];
};

export type { PublicCursorQuery, PublicSearchQuery };

async function publicGet<T>(path: string): Promise<T> {
  const started = captureGuestRequestFence(getProductTreeEpoch());
  const data = await publicRequest<T>(path);
  if (
    isGuestResultStale(started, {
      epoch: getProductTreeEpoch(),
      authenticatedProductActive: isAuthenticatedProductActive(),
    })
  ) {
    throw new StaleIdentityError();
  }
  return data;
}

export function fetchPublicFeed(query: PublicCursorQuery = {}): Promise<GuestPostPage> {
  return publicGet(`/public/feed${buildPublicCursorQuery(query)}`);
}

export function fetchPublicPost(id: string): Promise<GuestPost> {
  return publicGet(`/public/posts/${id}`);
}

export function fetchPublicUser(id: string): Promise<GuestProfile> {
  return publicGet(`/public/users/${id}`);
}

export function fetchPublicUserPosts(
  id: string,
  query: PublicCursorQuery = {},
): Promise<GuestPostPage> {
  return publicGet(`/public/users/${id}/posts${buildPublicCursorQuery(query)}`);
}

export function fetchPublicUserServices(id: string): Promise<GuestService[]> {
  return publicGet(`/public/users/${id}/services`);
}

export function fetchPublicUserPortfolio(id: string): Promise<GuestPortfolio[]> {
  return publicGet(`/public/users/${id}/portfolio`);
}

export function fetchPublicUserReviews(
  id: string,
  query: PublicCursorQuery = {},
): Promise<GuestReviewPage> {
  return publicGet(`/public/users/${id}/reviews${buildPublicCursorQuery(query)}`);
}

export function fetchPublicService(id: string): Promise<GuestService> {
  return publicGet(`/public/services/${id}`);
}

export function fetchPublicServiceReviews(
  id: string,
  query: PublicCursorQuery = {},
): Promise<GuestReviewPage> {
  return publicGet(
    `/public/services/${id}/reviews${buildPublicCursorQuery(query)}`,
  );
}

export function fetchPublicJobListings(
  query: PublicSearchQuery = {},
): Promise<GuestJobPage> {
  return publicGet(`/public/job-listings${buildPublicSearchQuery(query)}`);
}

export function fetchPublicJob(id: string): Promise<GuestJob> {
  return publicGet(`/public/job-listings/${id}`);
}

export function fetchPublicExploreTalents(
  query: PublicSearchQuery = {},
): Promise<GuestExplorePage<GuestExploreTalent>> {
  return publicGet(`/public/explore/talents${buildPublicSearchQuery(query)}`);
}

export function fetchPublicExploreServices(
  query: PublicSearchQuery = {},
): Promise<GuestExplorePage<GuestExploreService>> {
  return publicGet(`/public/explore/services${buildPublicSearchQuery(query)}`);
}

let publicTaxonomyPromise: Promise<PublicTaxonomy> | null = null;
let publicTaxonomyEpoch = -1;

export function resetPublicTaxonomyCache(): void {
  publicTaxonomyPromise = null;
  publicTaxonomyEpoch = -1;
}

export function fetchPublicTaxonomy(): Promise<PublicTaxonomy> {
  const epoch = getProductTreeEpoch();
  if (
    publicTaxonomyPromise &&
    publicTaxonomyEpoch === epoch &&
    !isAuthenticatedProductActive()
  ) {
    return publicTaxonomyPromise;
  }
  publicTaxonomyEpoch = epoch;
  publicTaxonomyPromise = publicGet<PublicTaxonomy>('/public/taxonomy').catch(
    (error) => {
      if (publicTaxonomyEpoch === epoch) {
        publicTaxonomyPromise = null;
        publicTaxonomyEpoch = -1;
      }
      throw error;
    },
  );
  return publicTaxonomyPromise;
}
