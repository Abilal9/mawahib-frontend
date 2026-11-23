import { Service, Talent, User } from '../data/types';
import {
  overallAggregate,
  ratingFields,
  type ReviewAggregate,
  type ReviewSummaryPair,
} from '../utils/reviewSummary';
import { categoryCardLabel } from '../i18n/catalogLabel';
import { displayCategory, displayPrice } from '../domain/truthfulFacts';
import { apiRequest } from '../lib/apiClient';

export interface ExploreProfile {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  isVerified: boolean;
  title: string | null;
  bio: string;
  locationCity: string | null;
  locationCountry: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  skills: string[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reviewSummary: ReviewSummaryPair;
}

export interface ExploreServiceRow {
  id: string;
  title: string;
  description: string;
  category: string | null;
  categoryName?: string | null;
  categoryNameAr?: string | null;
  customCategory?: string | null;
  price: number | null;
  currency: string;
  duration: string;
  reviewSummary: ReviewAggregate;
  images: string[];
  exploreTag: string | null;
  provider: ExploreProfile;
  isSaved?: boolean;
}

function profileToUser(p: ExploreProfile): User {
  return {
    id: p.id,
    name: p.displayName,
    username: p.username,
    avatar: p.avatarUrl || '',
    coverImage: p.coverUrl || undefined,
    bio: p.bio,
    location: [p.locationCity, p.locationCountry].filter(Boolean).join(', ') || undefined,
    skills: p.skills,
    accountType: p.accountType,
    followers: p.followersCount,
    following: p.followingCount,
    posts: p.postsCount,
    isVerified: p.isVerified,
    title: p.title || undefined,
    reviewSummary: p.reviewSummary,
    ...ratingFields(overallAggregate(p)),
  };
}

export function mapExploreTalent(p: ExploreProfile): Talent {
  const user = profileToUser(p);
  return {
    id: `talent-${p.id}`,
    user,
    category: p.title || p.skills[0] || 'Talent',
    ...ratingFields(overallAggregate(p)),
    // Not shown. Mawahib has no hourly rate or mutual-connection data yet.
    hourlyRate: 0,
    skills: p.skills,
    mutualConnections: 0,
    mutualAvatars: [],
    connectStatus: 'connect',
    tags: p.skills.slice(0, 3),
  };
}

export function mapExploreService(row: ExploreServiceRow): Service {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: displayPrice(row.price),
    currency: row.currency,
    duration: row.duration,
    category: displayCategory(
      categoryCardLabel({
        customCategory: row.customCategory,
        categoryName: row.categoryName,
        categoryNameAr: row.categoryNameAr,
        category: row.category,
      }),
    ),
    provider: profileToUser(row.provider),
    ...ratingFields(row.reviewSummary),
    images: row.images,
    exploreTag: row.exploreTag || undefined,
    isSaved: row.isSaved,
  };
}

export interface ExplorePage<T> {
  items: T[];
  total: number;
  take: number;
  skip: number;
}

export interface ExploreTalentPage extends ExplorePage<ExploreProfile> {
  businesses: ExploreProfile[];
}

export interface ExploreListQuery {
  q?: string;
  locationCode?: string;
  sort?: 'recommended' | 'top-rated' | 'newest';
  categoryIds?: string;
  skip?: number;
  take?: number;
}

function exploreQuery(path: string, params?: ExploreListQuery): string {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.locationCode) qs.set('locationCode', params.locationCode);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.categoryIds) qs.set('categoryIds', params.categoryIds);
  if (params?.skip != null) qs.set('skip', String(params.skip));
  if (params?.take != null) qs.set('take', String(params.take));
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export const exploreApi = {
  listTalents(params?: ExploreListQuery): Promise<ExploreTalentPage> {
    return apiRequest<ExploreTalentPage>(exploreQuery('/explore/talents', params));
  },

  listServices(params?: ExploreListQuery): Promise<ExplorePage<ExploreServiceRow>> {
    return apiRequest<ExplorePage<ExploreServiceRow>>(
      exploreQuery('/explore/services', params),
    );
  },
};
