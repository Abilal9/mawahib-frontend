import { ServiceOffering, ServicePackage } from '../data/types';
import { ratingFields, type ReviewAggregate } from '../utils/reviewSummary';
import { apiRequest } from '../lib/apiClient';

export interface ApiServiceOffering {
  id: string;
  title: string;
  description: string;
  category: string | null;
  currency: string;
  reviewSummary: ReviewAggregate;
  images: string[];
  mediaAssetIds: string[];
  packages: Array<{
    name: 'Basic' | 'Standard' | 'Premium';
    priceLabel: string;
    delivery: string;
    includes: string[];
    price: number;
    currency: string;
  }>;
  addons: Array<{
    id: string;
    title: string;
    priceLabel: string;
    price: number;
    currency: string;
  }>;
  position: number;
  createdAt: string;
  updatedAt: string;
  categoryId?: string | null;
  categoryName?: string | null;
  customCategory?: string | null;
  taxonomySkills?: Array<{ id: string; name: string }>;
  status?: 'draft' | 'published' | 'archived';
  staffHidden?: boolean;
  isSaved?: boolean;
}

export interface ApiServiceReview {
  id: string;
  contextLabel: string;
  rating: number;
  body: string;
  createdAt: string;
  reviewer: {
    id: string;
    displayName: string;
    username: string;
    isVerified: boolean;
    avatarUrl: string | null;
    title: string | null;
  };
}

export function mapServiceOffering(api: ApiServiceOffering): ServiceOffering {
  return {
    id: api.id,
    title: api.title,
    description: api.description,
    ...ratingFields(api.reviewSummary),
    images: api.images,
    mediaAssetIds: api.mediaAssetIds,
    currency: api.currency,
    packages: api.packages.map(
      (p): ServicePackage => ({
        name: p.name,
        price: p.price,
        currency: p.currency,
        priceLabel: p.priceLabel,
        delivery: p.delivery,
        includes: p.includes,
      }),
    ),
    addons: api.addons.map((a) => ({
      id: a.id,
      title: a.title,
      price: a.price,
      currency: a.currency,
      priceLabel: a.priceLabel,
    })),
    category: api.category,
    categoryId: api.categoryId ?? null,
    categoryName: api.categoryName ?? null,
    customCategory: api.customCategory ?? null,
    taxonomySkills: api.taxonomySkills ?? [],
    status: api.status,
    staffHidden: api.staffHidden === true,
    isSaved: api.isSaved,
  };
}

const TIER_API: Record<ServicePackage['name'], 'basic' | 'standard' | 'premium'> =
  {
    Basic: 'basic',
    Standard: 'standard',
    Premium: 'premium',
  };

export const servicesApi = {
  listMine(accessToken?: string): Promise<ApiServiceOffering[]> {
    return apiRequest<ApiServiceOffering[]>('/users/me/services', {
      accessToken,
    });
  },

  listForUser(userId: string): Promise<ApiServiceOffering[]> {
    return apiRequest<ApiServiceOffering[]>(`/users/${userId}/services`);
  },

  create(input: {
    title: string;
    description?: string;
    mediaAssetIds: string[];
    packages: Array<{
      name: ServicePackage['name'];
      price: number;
      deliveryLabel: string;
      includes: string[];
    }>;
    addons?: Array<{ title: string; price: number }>;
    categoryId: string;
    customCategory?: string | null;
    skillIds?: string[];
  },
  accessToken?: string,
  ): Promise<ApiServiceOffering> {
    return apiRequest<ApiServiceOffering>('/users/me/services', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        ...(input.customCategory !== undefined
          ? { customCategory: input.customCategory }
          : {}),
        skillIds: input.skillIds ?? [],
        media: input.mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId })),
        packages: input.packages.map((p) => ({
          tier: TIER_API[p.name],
          price: p.price,
          deliveryLabel: p.deliveryLabel,
          includes: p.includes,
        })),
        addons: input.addons,
      }),
    });
  },

  update(
    id: string,
    input: {
      title?: string;
      description?: string;
      mediaAssetIds?: string[];
      packages?: Array<{
        name: ServicePackage['name'];
        price: number;
        deliveryLabel: string;
        includes: string[];
      }>;
      addons?: Array<{ title: string; price: number }>;
      categoryId?: string;
      customCategory?: string | null;
      skillIds?: string[];
    },
    accessToken?: string,
  ): Promise<ApiServiceOffering> {
    return apiRequest<ApiServiceOffering>(`/users/me/services/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.customCategory !== undefined
          ? { customCategory: input.customCategory }
          : {}),
        ...(input.skillIds !== undefined ? { skillIds: input.skillIds } : {}),
        media: input.mediaAssetIds?.map((mediaAssetId) => ({ mediaAssetId })),
        packages: input.packages?.map((p) => ({
          tier: TIER_API[p.name],
          price: p.price,
          deliveryLabel: p.deliveryLabel,
          includes: p.includes,
        })),
        addons: input.addons,
      }),
    });
  },

  remove(id: string, accessToken?: string): Promise<void> {
    return apiRequest<void>(`/users/me/services/${id}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  listReviews(
    serviceId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<{ items: ApiServiceReview[]; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/services/${serviceId}/reviews${suffix}`);
  },

  reorder(
    serviceIds: string[],
    accessToken?: string,
  ): Promise<ApiServiceOffering[]> {
    return apiRequest<ApiServiceOffering[]>('/users/me/services/order', {
      method: 'PUT',
      accessToken,
      body: JSON.stringify({ serviceIds }),
    });
  },
};
