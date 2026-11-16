import { apiRequest } from '../lib/apiClient';

export type DeletionBlocker = {
  code: 'engagement_unresolved' | 'payment_unresolved' | 'financial_follow_up_outstanding';
  explanation: string;
  engagementId: string;
  engagementTitle: string;
  engagementStatus: string;
  paymentId: string | null;
};

export type DeletionRequestView = {
  selfOrigin: boolean;
  staffOrigin: boolean;
  restrictionsActive: boolean;
  eligibility:
    | { status: 'eligible'; blockers: [] }
    | { status: 'blocked'; blockers: DeletionBlocker[] }
    | { status: 'unavailable' };
};

export function loadDeletionRequest(): Promise<DeletionRequestView> {
  return apiRequest<DeletionRequestView>('/account/deletion');
}

export function createDeletionRequest(idempotencyKey: string): Promise<DeletionRequestView> {
  return apiRequest<DeletionRequestView>('/account/deletion/request', {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey }),
    refreshSession: true,
  });
}

export function cancelDeletionRequest(): Promise<DeletionRequestView> {
  return apiRequest<DeletionRequestView>('/account/deletion/cancel', { method: 'POST' });
}
