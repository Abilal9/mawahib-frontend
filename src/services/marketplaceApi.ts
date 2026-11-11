import { JobListing } from '../data/types';
import { apiRequest } from '../lib/apiClient';
import { formatMoneyAmountDigits } from '../utils/money';
import type { ApiWorkRequest } from './workRequestApi';

export type ApiEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'gig';

export type ApiJobListingStatus =
  | 'draft'
  | 'open'
  | 'archived'
  | 'closed'
  | 'in_progress'
  | 'completed'
  | 'expired';

export type ApiJobPricingType = 'fixed' | 'range' | 'negotiable';

export type ApiApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type ApiEngagementStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'pending_payment'
  | 'payment_failed'
  | 'in_progress'
  | 'delivered'
  | 'disputed'
  | 'completed';

export interface ApiPoster {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  isVerified: boolean;
  avatarUrl: string | null;
}

export interface ApiJobListing {
  id: string;
  posterId: string;
  title: string;
  companyName: string | null;
  employmentType: ApiEmploymentType;
  location: string;
  salaryLabel: string | null;
  /** Snapshotted poster default currency at create time. */
  currency: string;
  /** Structured compensation — the only source for payable amounts. */
  pricingType?: ApiJobPricingType;
  fixedAmount?: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  description: string;
  skills: string[];
  exploreTag: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  customCategory?: string | null;
  taxonomySkills?: { id: string; name: string }[];
  status: ApiJobListingStatus;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  poster: ApiPoster;
  isSaved?: boolean;
}

export interface ApiJobListingsPage {
  items: ApiJobListing[];
  total: number;
  take: number;
  skip: number;
}

export interface ApiParty {
  id: string;
  displayName: string;
  username: string;
  isVerified: boolean;
  avatarUrl: string | null;
  title: string | null;
  accountType?: string;
}

export interface ApiApplication {
  id: string;
  listingId: string;
  applicantId: string;
  coverLetter: string;
  status: ApiApplicationStatus;
  createdAt: string;
  updatedAt: string;
  applicant: ApiParty;
  listing: ApiJobListing | null;
}

export interface ApiEngagementDetail {
  serviceName: string;
  packageName: string;
  /** Package/base price only — never the amount to charge when add-ons exist. */
  packagePrice: string;
  currency: string;
  /** Canonical amount to charge (package + add-ons), decimal string e.g. "1250.00". */
  chargeableTotal: string;
  addons: unknown;
  deadlineLabel: string | null;
  locationUrl: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  notes: string;
  coverLetter: string;
}

export interface ApiEngagement {
  id: string;
  listingId: string | null;
  applicationId: string | null;
  serviceOfferingId: string | null;
  clientId: string;
  providerId: string;
  title: string;
  status: ApiEngagementStatus;
  source: string;
  dueAt: string | null;
  /** ISO timestamp set when the engagement reaches `completed`. */
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client: ApiParty;
  provider: ApiParty;
  detail: ApiEngagementDetail | null;
  events: Array<{
    id: string;
    fromStatus: ApiEngagementStatus | null;
    toStatus: ApiEngagementStatus;
    actorId: string | null;
    note: string;
    createdAt: string;
  }>;
  reviewState?: ApiReviewState | null;
}

/** Applying creates the application *and* the work request that carries it. */
export interface ApplyToListingResult {
  application: ApiApplication;
  workRequest: ApiWorkRequest;
}

/**
 * Selecting an applicant does NOT create an engagement — the talent still has
 * to accept the work request. `engagement` is therefore usually absent.
 */
export interface AcceptApplicationResult {
  application: ApiApplication;
  workRequest: ApiWorkRequest;
  engagement?: ApiEngagement;
}

/** PATCH /applications/:id returns the bare application unless it was accepted. */
export type PatchApplicationResult = ApiApplication | AcceptApplicationResult;

export function isAcceptApplicationResult(
  result: PatchApplicationResult,
): result is AcceptApplicationResult {
  return 'workRequest' in result && Boolean(result.workRequest);
}

export interface ApiWorkRequestAttachment {
  id: string;
  workRequestId: string;
  mediaAssetId: string;
  uploadedByUserId: string;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface ApiWorkRequestAttachmentUrl {
  url: string;
  originalFileName: string;
  mimeType: string;
}

export interface ApiUserReview {
  id: string;
  /** Public-safe label. Not a private engagement title. */
  contextLabel: string;
  /** Engagement role of the person who received the review. */
  receivedAs?: 'provider' | 'client';
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
  /** Optional review photos (jpeg/png). */
  media?: ApiReviewMedia[];
}

export interface ApiReviewMedia {
  id: string;
  mimeType: string;
  url: string | null;
}

export interface ApiUserReviewsPage {
  items: ApiUserReview[];
  nextCursor: string | null;
}

export interface ApiReviewStateReview {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  staffHidden?: boolean;
  media?: Array<{ id: string; mediaAssetId?: string; mimeType: string }>;
}

/** Server-owned review eligibility for the current user on one engagement. */
export interface ApiReviewState {
  eligible: boolean;
  canSubmit: boolean;
  windowClosesAt: string | null;
  published: boolean;
  myReview: ApiReviewStateReview | null;
  counterpartReview?: ApiReviewStateReview;
}

export interface ApiEngagementReview {
  id: string;
  engagementId: string;
  reviewerId: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface CreateEngagementReviewResult {
  review: ApiEngagementReview;
  conversationId?: string | null;
}

const EMPLOYMENT_TO_UI: Record<ApiEmploymentType, JobListing['type']> = {
  full_time: 'full-time',
  part_time: 'part-time',
  contract: 'contract',
  freelance: 'freelance',
  gig: 'gig',
};

const EMPLOYMENT_TO_API: Record<JobListing['type'], ApiEmploymentType> = {
  'full-time': 'full_time',
  'part-time': 'part_time',
  contract: 'contract',
  freelance: 'freelance',
  gig: 'gig',
};

export function employmentTypeToUi(
  type: ApiEmploymentType,
): JobListing['type'] {
  return EMPLOYMENT_TO_UI[type];
}

function listingStatusToUi(
  status: ApiJobListingStatus,
): NonNullable<JobListing['status']> {
  switch (status) {
    case 'in_progress':
      return 'in-progress';
    case 'completed':
      return 'completed';
    case 'closed':
    case 'archived':
    case 'expired':
      return 'cancelled';
    default:
      return 'open';
  }
}

/**
 * Compensation text for a listing. Structured amounts win over the free-text
 * display label; the label is appended as context, never parsed for money.
 * Amount-only (no currency prefix) — the UI renders the currency icon.
 */
export function listingCompensationLabel(
  api: Pick<
    ApiJobListing,
    'pricingType' | 'fixedAmount' | 'minAmount' | 'maxAmount' | 'salaryLabel'
  >,
): string {
  const label = api.salaryLabel?.trim() || '';
  let amount = '';
  if (api.pricingType === 'fixed' && api.fixedAmount != null) {
    amount = formatMoneyAmountDigits(api.fixedAmount);
  } else if (
    api.pricingType === 'range' &&
    api.minAmount != null &&
    api.maxAmount != null
  ) {
    amount = `${formatMoneyAmountDigits(api.minAmount)} – ${formatMoneyAmountDigits(api.maxAmount)}`;
  }
  if (amount && label) return `${amount} · ${label}`;
  return amount || label || 'Negotiable';
}

export function mapApiListingToJob(api: ApiJobListing): JobListing {
  const currency =
    api.currency === 'AED' || api.currency === 'SAR' ? api.currency : null;
  return {
    id: api.id,
    title: api.title,
    company: api.companyName || api.poster.displayName,
    type: EMPLOYMENT_TO_UI[api.employmentType],
    location: api.location,
    salary: listingCompensationLabel(api),
    currency,
    description: api.description,
    skills: api.skills ?? [],
    categoryId: api.categoryId ?? null,
    categoryName: api.categoryName ?? null,
    customCategory: api.customCategory ?? null,
    taxonomySkills: api.taxonomySkills ?? [],
    postedAt: api.postedAt || api.createdAt,
    status: listingStatusToUi(api.status),
    logo: api.poster.avatarUrl ?? undefined,
    exploreTag: api.exploreTag ?? undefined,
    companyVerified: api.poster.isVerified,
    isSaved: api.isSaved,
  };
}

export const marketplaceApi = {
  listOpenListings(params?: {
    q?: string;
    exploreTag?: string;
    employmentType?: ApiEmploymentType;
    categoryIds?: string;
    take?: number;
    skip?: number;
  }): Promise<ApiJobListingsPage> {
    const qs = new URLSearchParams();
    qs.set('status', 'open');
    if (params?.q) qs.set('q', params.q);
    if (params?.exploreTag) qs.set('exploreTag', params.exploreTag);
    if (params?.employmentType) qs.set('employmentType', params.employmentType);
    if (params?.categoryIds) qs.set('categoryIds', params.categoryIds);
    if (params?.take != null) qs.set('take', String(params.take));
    if (params?.skip != null) qs.set('skip', String(params.skip));
    return apiRequest<ApiJobListingsPage>(`/job-listings?${qs.toString()}`);
  },

  getListing(id: string): Promise<ApiJobListing> {
    return apiRequest<ApiJobListing>(`/job-listings/${id}`);
  },

  /** Listings the viewer posted — any account type may post. */
  listMyListings(): Promise<ApiJobListing[]> {
    return apiRequest<ApiJobListing[]>('/users/me/job-listings');
  },

  createListing(input: {
    title: string;
    companyName?: string;
    employmentType: JobListing['type'];
    location: string;
    /** Structured compensation. Omitted → backend treats as negotiable. */
    pricingType?: ApiJobPricingType;
    fixedAmount?: number;
    minAmount?: number;
    maxAmount?: number;
    /**
     * Note: the API has no `currency` field on create — the listing snapshots
     * the poster's default currency server-side (extra fields are rejected).
     */
    /** Display-only label; never used as the payable amount. */
    salaryLabel?: string;
    description?: string;
    categoryId: string;
    customCategory?: string | null;
    skillIds?: string[];
    publish?: boolean;
  }): Promise<ApiJobListing> {
    return apiRequest<ApiJobListing>('/job-listings', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        companyName: input.companyName,
        employmentType: EMPLOYMENT_TO_API[input.employmentType],
        location: input.location,
        pricingType: input.pricingType,
        fixedAmount: input.fixedAmount,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        salaryLabel: input.salaryLabel,
        description: input.description,
        categoryId: input.categoryId,
        ...(input.customCategory !== undefined
          ? { customCategory: input.customCategory }
          : {}),
        skillIds: input.skillIds ?? [],
        publish: input.publish ?? true,
      }),
    });
  },

  updateListing(
    id: string,
    input: Partial<{
      title: string;
      companyName: string | null;
      employmentType: JobListing['type'];
      location: string;
      salaryLabel: string | null;
      description: string;
      categoryId?: string;
      customCategory?: string | null;
      skillIds?: string[];
    }>,
  ): Promise<ApiJobListing> {
    return apiRequest<ApiJobListing>(`/job-listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...input,
        employmentType: input.employmentType
          ? EMPLOYMENT_TO_API[input.employmentType]
          : undefined,
      }),
    });
  },

  transitionListing(
    id: string,
    status: 'open' | 'archived' | 'closed',
  ): Promise<ApiJobListing> {
    return apiRequest<ApiJobListing>(`/job-listings/${id}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  deleteListing(id: string): Promise<void> {
    return apiRequest<void>(`/job-listings/${id}`, {
      method: 'DELETE',
    });
  },

  apply(listingId: string, coverLetter?: string): Promise<ApplyToListingResult> {
    return apiRequest<ApplyToListingResult>(
      `/job-listings/${listingId}/applications`,
      {
        method: 'POST',
        body: JSON.stringify({ coverLetter: coverLetter ?? '' }),
      },
    );
  },

  listApplicationsForListing(listingId: string): Promise<ApiApplication[]> {
    return apiRequest<ApiApplication[]>(
      `/job-listings/${listingId}/applications`,
    );
  },

  /** Applications the viewer submitted (status tells whether they were selected). */
  listMyApplications(): Promise<ApiApplication[]> {
    return apiRequest<ApiApplication[]>('/users/me/applications');
  },

  /** `accepted` selects the applicant and returns the work request to review. */
  patchApplication(
    applicationId: string,
    status: Exclude<ApiApplicationStatus, 'submitted'>,
  ): Promise<PatchApplicationResult> {
    return apiRequest<PatchApplicationResult>(`/applications/${applicationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getEngagement(id: string): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/engagements/${id}`);
  },

  transitionEngagement(
    id: string,
    status: ApiEngagementStatus,
    note?: string,
  ): Promise<ApiEngagement> {
    return apiRequest<ApiEngagement>(`/engagements/${id}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  },

  createEngagementReview(
    engagementId: string,
    input: { rating: number; body?: string; mediaAssetIds?: string[] },
  ): Promise<CreateEngagementReviewResult> {
    return apiRequest<CreateEngagementReviewResult>(
      `/engagements/${engagementId}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  listWorkRequestAttachments(
    workRequestId: string,
  ): Promise<ApiWorkRequestAttachment[]> {
    return apiRequest<ApiWorkRequestAttachment[]>(
      `/work-requests/${workRequestId}/attachments`,
    );
  },

  /** Registers an already-uploaded `work_request` media asset on the request. */
  addWorkRequestAttachment(
    workRequestId: string,
    input: { mediaAssetId: string; originalFileName: string },
  ): Promise<ApiWorkRequestAttachment> {
    return apiRequest<ApiWorkRequestAttachment>(
      `/work-requests/${workRequestId}/attachments`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },

  getWorkRequestAttachmentUrl(
    workRequestId: string,
    attachmentId: string,
  ): Promise<ApiWorkRequestAttachmentUrl> {
    return apiRequest<ApiWorkRequestAttachmentUrl>(
      `/work-requests/${workRequestId}/attachments/${attachmentId}/url`,
    );
  },

  /** 204. Uploader only, while the request is open or pending_payment. */
  deleteWorkRequestAttachment(
    workRequestId: string,
    attachmentId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/work-requests/${workRequestId}/attachments/${attachmentId}`,
      { method: 'DELETE' },
    );
  },

  listReviewsForUser(
    userId: string,
    params: {
      role?: 'provider' | 'client';
      cursor?: string;
      limit?: number;
    },
  ): Promise<ApiUserReviewsPage> {
    const qs = new URLSearchParams();
    if (params.role) qs.set('role', params.role);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return apiRequest<ApiUserReviewsPage>(
      `/users/${userId}/reviews?${qs.toString()}`,
    );
  },
};
