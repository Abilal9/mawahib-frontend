import { useCallback, useState } from 'react';
import { NavigationProp, ParamListBase } from '@react-navigation/native';
import { t } from '../i18n/runtime';
import type { MessageKey } from '../i18n/messages';
import {
  JobsLanding,
  MARKETPLACE_SUCCESS,
  MarketplaceSuccessKey,
  resetToJobs,
} from '../utils/marketplaceSuccess';

const SUCCESS_COPY: Record<MarketplaceSuccessKey, { title: MessageKey; message: MessageKey }> = {
  jobPosted: { title: 'work.successJobPostedTitle', message: 'work.successJobPostedBody' },
  applicationSent: { title: 'work.successApplicationTitle', message: 'work.successApplicationBody' },
  serviceRequestSent: { title: 'work.successServiceTitle', message: 'work.successServiceBody' },
  directRequestSent: { title: 'work.successDirectTitle', message: 'work.successDirectBody' },
  requestAccepted: { title: 'work.successAcceptedTitle', message: 'work.successAcceptedBody' },
  requestRejected: { title: 'work.successRejectedTitle', message: 'work.successRejectedBody' },
  requestCancelled: { title: 'work.successCancelledTitle', message: 'work.successCancelledBody' },
  changesRequested: { title: 'work.successChangesTitle', message: 'work.successChangesBody' },
  changesAccepted: { title: 'work.successChangesAcceptedTitle', message: 'work.successChangesAcceptedBody' },
  changesDeclined: { title: 'work.successChangesDeclinedTitle', message: 'work.successChangesDeclinedBody' },
  changesWithdrawn: { title: 'work.successChangesWithdrawnTitle', message: 'work.successChangesWithdrawnBody' },
  jobDelivered: { title: 'work.successDeliveredTitle', message: 'work.successDeliveredBody' },
  jobDisputed: { title: 'work.successDeclinedTitle', message: 'work.successDeclinedBody' },
  jobChangesRequested: { title: 'work.successJobChangesTitle', message: 'work.successJobChangesBody' },
  jobCompleted: { title: 'work.successCompletedTitle', message: 'work.successCompletedBody' },
  listingArchived: { title: 'work.successArchivedTitle', message: 'work.successArchivedBody' },
  listingReopened: { title: 'work.successReopenedTitle', message: 'work.successReopenedBody' },
  listingClosed: { title: 'work.successClosedTitle', message: 'work.successClosedBody' },
  listingDeleted: { title: 'work.successDeletedTitle', message: 'work.successDeletedBody' },
};

interface SuccessState {
  key: MarketplaceSuccessKey;
  title: string;
  message: string;
  landing: JobsLanding;
}

/**
 * Shows a success confirmation, then returns to the correct Jobs inbox view.
 * Call only after the backend operation has already succeeded (and refreshed).
 */
export function useMarketplaceSuccess(
  navigation: NavigationProp<ParamListBase>,
  refresh?: () => Promise<void>,
) {
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const showSuccess = useCallback(
    (key: MarketplaceSuccessKey, landingOverride?: Partial<JobsLanding>) => {
      const copy = MARKETPLACE_SUCCESS[key];
      const localized = SUCCESS_COPY[key];
      setSuccess({
        key,
        title: t(localized.title),
        message: t(localized.message),
        landing: { ...copy.landing, ...landingOverride },
      });
    },
    [],
  );

  const completeSuccess = useCallback(async () => {
    if (!success) return;
    const landing = success.landing;
    setSuccess(null);
    if (refresh) {
      try {
        await refresh();
      } catch {
        // Navigation still proceeds; Jobs focus effect will retry.
      }
    }
    resetToJobs(navigation, landing);
  }, [navigation, refresh, success]);

  return {
    successVisible: Boolean(success),
    successTitle: success?.title ?? '',
    successMessage: success?.message ?? '',
    showSuccess,
    completeSuccess,
  };
}
