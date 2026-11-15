import type { User } from './index';

/**
 * Card-level status for a work request (or a listing the viewer posted).
 * Mirrors the backend work-request status plus the engagement stages that
 * follow acceptance.
 */
export type UserJobStatus =
  | 'pending'
  | 'under-review'
  | 'selected'
  | 'changes-requested'
  | 'changes-declined'
  | 'pending-payment'
  | 'in-progress'
  | 'delivered'
  | 'disputed'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'withdrawn'
  | 'posted';

/** Statuses that belong in the History tab aside from staff-closed work. */
export const COMPLETED_USER_JOB_STATUSES: UserJobStatus[] = [
  'completed',
  'rejected',
  'withdrawn',
];

export function isCompletedStatus(status: UserJobStatus): boolean {
  return COMPLETED_USER_JOB_STATUSES.includes(status);
}

/**
 * Client acceptance only. Staff closure uses status `cancelled` and the History
 * section, and is not successful completion.
 */
export function isSuccessfulCompletion(status: UserJobStatus): boolean {
  return status === 'completed';
}

/** Where the row came from — drives the small uppercase badge on cards. */
export type UserJobSource =
  | 'job_posting'
  | 'service_request'
  | 'direct_request'
  | 'posted_listing';

export type UserJobSection =
  | 'requests'
  | 'pending-payment'
  | 'in-progress'
  | 'completed'
  | 'posted';

export interface UserJobAddon {
  name: string;
  price: number;
}

export interface UserJobDetails {
  serviceName: string;
  packageName: string;
  addons: UserJobAddon[];
  deadline: string;
  locationUrl?: string;
  notes: string;
  attachmentName: string;
  attachmentSize: string;
  packagePrice: number;
  currencySymbol: string;
  requestedAt: string;
}

export interface UserJob {
  /** Work request id for requests, `listing-{uuid}` for posted listings. */
  id: string;
  /** Set on every work request row; never a listing/application/engagement id. */
  requestId?: string;
  /** Set once the request has been accepted into an engagement. */
  engagementId?: string;
  /** Source job listing, when the row is linked to one. */
  listingId?: string;
  source: UserJobSource;
  title: string;
  type: 'received' | 'sent';
  status: UserJobStatus;
  statusLabel: string;
  /** Uppercase pill copy, e.g. JOB POSTING */
  sourceLabel: string;
  counterpart: User;
  date: string;
  createdAt: string;
  /** Last server update of the work request / listing (ISO). */
  updatedAt?: string;
  /** ISO time the engagement completed (from the engagement DTO). */
  completedAt?: string;
  dueDate?: string;
  jobType?: string;
  unread?: boolean;
  section: UserJobSection;
  activityLabel?: string;
  activityValue?: string;
  details?: UserJobDetails;
  /**
   * Canonical review eligibility from the engagement. When present, screens
   * must use `canSubmit` instead of inferring it from status and review lists.
   */
  reviewState?: {
    eligible: boolean;
    canSubmit: boolean;
    windowClosesAt: string | null;
    published: boolean;
    myReview: { id: string; rating: number; body: string; createdAt: string } | null;
    counterpartReview?: {
      id: string;
      rating: number;
      body: string;
      createdAt: string;
    };
  } | null;
  /** The viewer's own review of the other party (set once it exists). */
  rating?: number;
  reviewText?: string;
  reviewImages?: string[];
}

/**
 * A work request created by applying to a listing — a UserJob with
 * source `job_posting`.
 */
export type JobApplication = UserJob;

/**
 * Detail fields for a card, with empty placeholders where the backend has
 * nothing yet. Never invents packages, add-ons or attachments.
 */
export function resolveJobDetails(job: UserJob): UserJobDetails {
  if (job.details) return job.details;
  return {
    serviceName: job.title,
    packageName: '',
    addons: [],
    deadline: job.dueDate ?? '',
    notes: '',
    attachmentName: '',
    attachmentSize: '',
    packagePrice: 0,
    currencySymbol: '',
    requestedAt: job.createdAt,
  };
}

export function jobTotalPrice(details: UserJobDetails): number {
  const addons = details.addons.reduce((sum, a) => sum + a.price, 0);
  return details.packagePrice + addons;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Sort key for History "most recent": completedAt → updatedAt → createdAt. */
export function jobRecencyTime(job: UserJob): number {
  for (const iso of [job.completedAt, job.updatedAt, job.createdAt]) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}
