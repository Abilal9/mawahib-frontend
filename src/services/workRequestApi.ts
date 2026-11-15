import { apiRequest } from '../lib/apiClient';
import type {
  ApiEngagement,
  ApiEngagementStatus,
  ApiReviewState,
  ApiWorkRequestAttachment,
} from './marketplaceApi';
import { formatMoneyDisplay } from '../data/location/geo';

/** Entry point a work request came from. */
export type WorkRequestSource =
  | 'job_posting'
  | 'service_request'
  | 'direct_request';

/**
 * Negotiation status. `pending_payment` is the accepted terminal state —
 * the engagement it creates waits for money (Phase 5).
 * `changes_declined` keeps negotiation open after the sender declines a proposal.
 */
export type WorkRequestStatus =
  | 'pending'
  | 'changes_requested'
  | 'changes_declined'
  | 'pending_payment'
  | 'rejected'
  | 'withdrawn';

export type WorkRequestEventType =
  | 'created'
  | 'changes_requested'
  | 'changes_accepted'
  | 'changes_declined'
  | 'changes_cancelled'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'viewed'
  | 'listing_closed'
  | 'note';

export const DEFAULT_CURRENCY = 'SAR';

export type DeadlineType =
  | 'exact_date'
  | 'date_range'
  | 'duration'
  | 'flexible';

export type DurationUnit = 'days' | 'weeks' | 'months';

export const DEADLINE_TYPES: readonly DeadlineType[] = [
  'exact_date',
  'date_range',
  'duration',
  'flexible',
];

export const DURATION_UNITS: readonly DurationUnit[] = [
  'days',
  'weeks',
  'months',
];

/** Amount + currency. Money is structured so the UI never parses labels. */
export interface WorkRequestMoney {
  amount: number;
  currency: string;
}

/**
 * Structured deadline as returned by the API. Dates are `YYYY-MM-DD`; fields
 * may come back null when the counterparty left them blank.
 */
export type WorkRequestDeadline =
  | { type: 'exact_date'; startDate: string | null }
  | { type: 'date_range'; startDate: string | null; endDate: string | null }
  | {
      type: 'duration';
      durationValue: number | null;
      durationUnit: DurationUnit | null;
    }
  | { type: 'flexible' };

export interface WorkRequestAddon {
  id: string;
  title: string;
  money: WorkRequestMoney;
}

/** Snapshot of what is being agreed on. Display strings are derived. */
export interface WorkRequestTerms {
  title: string;
  scope: string;
  money: WorkRequestMoney | null;
  deadline: WorkRequestDeadline | null;
  notes: string;
  location?: string | null;
  /** Exact saved Google Maps URL, when the client entered one. */
  mapsUrl?: string | null;
  employmentType?: string | null;
  packageTier?: string | null;
  packageName?: string | null;
  addons?: WorkRequestAddon[];
}

export interface WorkRequestParty {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  isVerified: boolean;
  avatarUrl: string | null;
  title: string | null;
}

export interface WorkRequestEvent {
  id: string;
  type: WorkRequestEventType;
  actorId: string | null;
  fromStatus: WorkRequestStatus | null;
  toStatus: WorkRequestStatus | null;
  note: string;
  payload: unknown;
  createdAt: string;
}

export interface ApiWorkRequest {
  id: string;
  source: WorkRequestSource;
  status: WorkRequestStatus;
  title: string;
  senderUserId: string;
  recipientUserId: string;
  clientUserId: string;
  providerUserId: string;
  jobListingId: string | null;
  jobApplicationId: string | null;
  /** Canonical application status. Null for service and direct requests. */
  jobApplicationStatus?:
    | 'submitted'
    | 'under_review'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | null;
  serviceOfferingId: string | null;
  serviceTitle: string | null;
  workEngagementId: string | null;
  workEngagementStatus: ApiEngagementStatus | null;
  closedByMawahib?: boolean;
  workEngagementCompletedAt?: string | null;
  reviewState?: ApiReviewState | null;
  terms: WorkRequestTerms;
  proposedTerms: WorkRequestTerms | null;
  agreedTerms: WorkRequestTerms | null;
  proposedByUserId: string | null;
  proposalComment: string;
  rejectionComment: string;
  sender: WorkRequestParty;
  recipient: WorkRequestParty;
  direction: 'sent' | 'received' | null;
  counterparty: WorkRequestParty | null;
  unread: boolean;
  events: WorkRequestEvent[];
  /** Real uploaded files (never parsed from notes). */
  attachments?: ApiWorkRequestAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkRequestUnreadSummary {
  sentUnread: number;
  receivedUnread: number;
}

export interface AcceptWorkRequestResult {
  workRequest: ApiWorkRequest;
  engagement: ApiEngagement;
}

export type PackageTier = 'basic' | 'standard' | 'premium';

/** Money on the way out: currency defaults to SAR server-side when omitted. */
export interface WorkRequestMoneyInput {
  amount: number;
  currency?: string;
}

/** Deadline on the way out — every field the chosen type needs is required. */
export type WorkRequestDeadlineInput =
  | { type: 'exact_date'; startDate: string }
  | { type: 'date_range'; startDate: string; endDate: string }
  | {
      type: 'duration';
      durationValue: number;
      durationUnit: DurationUnit;
    }
  | { type: 'flexible' };

export interface CreateServiceWorkRequestInput {
  serviceOfferingId: string;
  packageTier?: PackageTier;
  addonIds?: string[];
  notes?: string;
  /** Place text. A raw maps URL is not accepted as the opened link. */
  location?: string;
  /** Exact Google Maps HTTPS URL. */
  mapsUrl?: string;
  /** Delivery schedule. Package and add-on prices are taken from the catalog. */
  deadline?: WorkRequestDeadlineInput;
}

export interface CreateDirectWorkRequestInput {
  recipientUserId: string;
  title: string;
  scope?: string;
  money?: WorkRequestMoneyInput;
  deadline?: WorkRequestDeadlineInput;
  message?: string;
}

/**
 * Partial terms a party proposes when asking for changes. Omitted keys keep
 * their current value; `money: null` clears the agreed amount.
 */
export interface ProposedTermsInput {
  title?: string;
  scope?: string;
  money?: WorkRequestMoneyInput | null;
  deadline?: WorkRequestDeadlineInput;
  notes?: string;
}

/** The effective terms both parties are looking at right now. */
export function effectiveTerms(request: ApiWorkRequest): WorkRequestTerms {
  return request.agreedTerms ?? request.proposedTerms ?? request.terms;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function isIsoDate(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `YYYY-MM-DD` in local time, so a picked day never shifts across midnight. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight Date, or null when malformed. */
export function fromIsoDate(value: string | null | undefined): Date | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day);
}

/**
 * Canonical money label (`SAR 500.00` / `Dhs 500.00`).
 */
export function formatMoney(money: WorkRequestMoney | null | undefined): string {
  if (!money) return '';
  return formatMoneyDisplay({
    amount: Number(money.amount) || 0,
    currency: money.currency || DEFAULT_CURRENCY,
  });
}

function formatIsoDateLabel(value: string, withYear: boolean): string {
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const label = `${MONTH_NAMES[month - 1]} ${day}`;
  return withYear ? `${label}, ${year}` : label;
}

/** `May 9, 2027` | `May 6 – May 9` | `3 days` | `Flexible` when that mode was chosen. */
export function formatDeadline(
  deadline: WorkRequestDeadline | null | undefined,
): string {
  if (!deadline) return '';
  switch (deadline.type) {
    case 'flexible':
      return 'Flexible';
    case 'exact_date':
      return isIsoDate(deadline.startDate)
        ? formatIsoDateLabel(deadline.startDate, true)
        : '';
    case 'date_range': {
      const { startDate: start, endDate: end } = deadline;
      if (!isIsoDate(start) || !isIsoDate(end)) return '';
      const sameYear = start.slice(0, 4) === end.slice(0, 4);
      return `${formatIsoDateLabel(start, !sameYear)} – ${formatIsoDateLabel(
        end,
        !sameYear,
      )}`;
    }
    case 'duration': {
      const value = Number(deadline.durationValue);
      const unit = deadline.durationUnit;
      if (!Number.isFinite(value) || value < 1 || !unit) return '';
      return `${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`;
    }
    default:
      return '';
  }
}

/** Total of the package price plus every add-on, in the package currency. */
export function termsTotal(
  terms: Pick<WorkRequestTerms, 'money' | 'addons'>,
): WorkRequestMoney | null {
  const addons = terms.addons ?? [];
  if (!terms.money && addons.length === 0) return null;
  const currency = terms.money?.currency ?? DEFAULT_CURRENCY;
  const total = addons.reduce(
    (sum, addon) => sum + (Number(addon.money?.amount) || 0),
    terms.money?.amount ?? 0,
  );
  return { amount: Math.round(total * 100) / 100, currency };
}

/** Sum of add-on amounts only (excludes package/base price). */
export function termsAddonsSum(
  terms: WorkRequestTerms,
): WorkRequestMoney | null {
  const addons = terms.addons ?? [];
  if (addons.length === 0) return null;
  const currency =
    terms.money?.currency ?? addons[0]?.money?.currency ?? DEFAULT_CURRENCY;
  const total = addons.reduce(
    (sum, addon) => sum + (Number(addon.money?.amount) || 0),
    0,
  );
  return { amount: Math.round(total * 100) / 100, currency };
}

export interface WorkRequestTermsChange {
  previousTerms: WorkRequestTerms;
  proposedTerms: WorkRequestTerms;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Reads the `{ previousTerms, proposedTerms }` payload on a proposal event. */
export function termsChangeFromPayload(
  payload: unknown,
): WorkRequestTermsChange | null {
  if (!isRecord(payload)) return null;
  const { previousTerms, proposedTerms } = payload;
  if (!isRecord(previousTerms) || !isRecord(proposedTerms)) return null;
  return {
    previousTerms: previousTerms as unknown as WorkRequestTerms,
    proposedTerms: proposedTerms as unknown as WorkRequestTerms,
  };
}

/** `Package Price SAR 3,000.00 → SAR 3,500.00` — only the fields that actually moved. */
export function summarizeTermsChange(change: WorkRequestTermsChange): string {
  const parts: string[] = [];
  const beforeMoney = formatMoney(change.previousTerms.money) || 'Negotiable';
  const afterMoney = formatMoney(change.proposedTerms.money) || 'Negotiable';
  if (beforeMoney !== afterMoney) {
    parts.push(`Package Price ${beforeMoney} → ${afterMoney}`);
  }
  const beforeDeadline = formatDeadline(change.previousTerms.deadline);
  const afterDeadline = formatDeadline(change.proposedTerms.deadline);
  if (beforeDeadline !== afterDeadline) {
    parts.push(`Deadline ${beforeDeadline} → ${afterDeadline}`);
  }
  return parts.join(' · ');
}

export const SOURCE_BADGE_LABEL: Record<WorkRequestSource, string> = {
  job_posting: 'JOB POSTING',
  service_request: 'SERVICE REQUEST',
  direct_request: 'DIRECT REQUEST',
};

export const workRequestApi = {
  listMine(
    direction: 'sent' | 'received',
    status?: WorkRequestStatus,
  ): Promise<ApiWorkRequest[]> {
    const qs = new URLSearchParams({ direction });
    if (status) qs.set('status', status);
    return apiRequest<ApiWorkRequest[]>(
      `/users/me/work-requests?${qs.toString()}`,
    );
  },

  unreadSummary(): Promise<WorkRequestUnreadSummary> {
    return apiRequest<WorkRequestUnreadSummary>(
      '/users/me/work-requests/unread-summary',
    );
  },

  get(id: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}`);
  },

  markViewed(id: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/view`, {
      method: 'POST',
    });
  },

  accept(id: string): Promise<AcceptWorkRequestResult> {
    return apiRequest<AcceptWorkRequestResult>(
      `/work-requests/${id}/accept`,
      { method: 'POST' },
    );
  },

  requestChanges(
    id: string,
    proposedTerms: ProposedTermsInput,
    comment?: string,
  ): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ proposedTerms, comment }),
    });
  },

  acceptChanges(id: string): Promise<AcceptWorkRequestResult> {
    return apiRequest<AcceptWorkRequestResult>(
      `/work-requests/${id}/accept-changes`,
      { method: 'POST' },
    );
  },

  declineChanges(id: string, comment?: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/decline-changes`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  /** Withdraw Change Request (overflow). Restores prior open negotiation status. */
  cancelChanges(id: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/cancel-changes`, {
      method: 'POST',
    });
  },

  reject(id: string, comment?: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  withdraw(id: string, comment?: string): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>(`/work-requests/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  createFromService(
    input: CreateServiceWorkRequestInput,
  ): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>('/work-requests/service', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  createDirect(input: CreateDirectWorkRequestInput): Promise<ApiWorkRequest> {
    return apiRequest<ApiWorkRequest>('/work-requests/direct', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
