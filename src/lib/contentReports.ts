import { ApiError, apiRequest } from './apiClient'

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'hate_or_violence', label: 'Hate or violence' },
  { id: 'sexual_content', label: 'Sexual content' },
  { id: 'scam_or_fraud', label: 'Scam or fraud' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'illegal_or_dangerous', label: 'Illegal or dangerous' },
  { id: 'other', label: 'Something else' },
] as const

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id']

export type ContentReportTarget =
  | 'post_comment'
  | 'work_request'
  | 'user'
  | 'post'
  | 'engagement_review'
  | 'job_listing'
  | 'service_offering'

export function reportCanSend(reason: ReportReasonId | null, details: string): boolean {
  const text = details.trim()
  if (!reason) return false
  if (text.length > 1000) return false
  if (reason === 'other') return text.length >= 10
  return true
}

export type ReportSubmitResult =
  | { outcome: 'sent' | 'already' }
  | { outcome: 'unavailable' | 'own' | 'limited' | 'unconfirmed' }

export async function submitContentReport(input: {
  targetType: ContentReportTarget
  targetId: string
  reason: ReportReasonId
  details: string
}): Promise<ReportSubmitResult> {
  try {
    const body = await apiRequest<{ alreadyReported?: boolean }>('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      acceptedStatuses: [200, 201],
      body: JSON.stringify({
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details.trim() || undefined,
      }),
    })
    return { outcome: body.alreadyReported ? 'already' : 'sent' }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return { outcome: 'unavailable' }
      if (error.status === 400 && error.code === 'REPORT_OWN_CONTENT') return { outcome: 'own' }
      if (error.status === 429) return { outcome: 'limited' }
    }
    return { outcome: 'unconfirmed' }
  }
}

export function reportResultMessage(
  result: ReportSubmitResult,
  target: ContentReportTarget = 'post_comment',
): { title: string; message: string; confirmed: boolean } {
  if (result.outcome === 'sent') {
    return { title: 'Report sent', message: 'Mawahib staff can review this report. The other person is not told who reported it.', confirmed: true }
  }
  if (result.outcome === 'already') {
    return { title: 'Already reported', message: 'You already have an open report for this.', confirmed: true }
  }
  if (result.outcome === 'unavailable') {
    return { title: 'Unavailable', message: 'This is no longer available.', confirmed: false }
  }
  if (result.outcome === 'own') {
    const subject = target === 'user' ? 'account' : target === 'post' ? 'post' : target === 'post_comment' ? 'comment' : target === 'engagement_review' ? 'review' : target === 'job_listing' ? 'job' : target === 'service_offering' ? 'service' : 'request'
    return { title: 'Not sent', message: `You cannot report your own ${subject}.`, confirmed: false }
  }
  if (result.outcome === 'limited') {
    return { title: 'Too many reports', message: 'Try again later.', confirmed: false }
  }
  return { title: 'Not confirmed', message: "We couldn't confirm your report was sent. Try again.", confirmed: false }
}
