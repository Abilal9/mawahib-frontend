export type ReviewPromptJob = {
  id: string;
  requestId?: string;
  engagementId?: string;
  canSubmit?: boolean | null;
};

/**
 * Stars belong on a completed-work notice, and only while this account can
 * still submit. A work-request link is for navigation, including a moderation
 * notice, and does not invite a review.
 */
export function notificationShowsReviewPrompt(input: {
  apiType?: string | null;
  engagementStatus?: string | null;
  canSubmit?: boolean | null;
}): boolean {
  return (
    input.apiType === 'engagement_status' &&
    input.engagementStatus === 'completed' &&
    input.canSubmit === true
  );
}

/** Completion notices identify the engagement. Hide notices identify the work request. */
export function reviewPromptJob<T extends ReviewPromptJob>(input: {
  workRequestId?: string | null;
  engagementId?: string | null;
  jobs: T[];
}): T | undefined {
  if (input.workRequestId) {
    const match = input.jobs.find(
      (job) => job.id === input.workRequestId || job.requestId === input.workRequestId,
    );
    if (match) return match;
  }
  if (input.engagementId) {
    return input.jobs.find((job) => job.engagementId === input.engagementId);
  }
  return undefined;
}
