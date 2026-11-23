import { useCallback, useState } from 'react';
import { NavigationProp, ParamListBase } from '@react-navigation/native';
import { t } from '../i18n/runtime';
import {
  JobsLanding,
  MARKETPLACE_SUCCESS,
  MarketplaceSuccessKey,
  resetToJobs,
} from '../utils/marketplaceSuccess';

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
      const localized =
        key === 'jobPosted'
          ? { title: t('work.successJobPostedTitle'), message: t('work.successJobPostedBody') }
          : key === 'applicationSent'
            ? { title: t('work.successApplicationTitle'), message: t('work.successApplicationBody') }
            : key === 'serviceRequestSent'
              ? { title: t('work.successServiceTitle'), message: t('work.successServiceBody') }
              : key === 'directRequestSent'
                ? { title: t('work.successDirectTitle'), message: t('work.successDirectBody') }
                : { title: copy.title, message: copy.message };
      setSuccess({
        key,
        title: localized.title,
        message: localized.message,
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
