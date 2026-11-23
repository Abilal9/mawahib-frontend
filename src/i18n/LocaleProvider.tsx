import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, I18nManager, View } from 'react-native';
import { colors } from '../theme';
import { AppLocale, appliedLocaleFor } from './locale';
import { readSavedLocale, writeSavedLocale } from './preference';
import { setAppliedLocale, t } from './runtime';

type LocaleContextValue = {
  applied: AppLocale;
  saved: AppLocale;
  /** True when the saved choice still needs a fresh app launch to change layout. */
  pending: boolean;
  selectLanguage: (next: AppLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<AppLocale>('en');
  const [applied, setApplied] = useState<AppLocale>('en');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextSaved = await readSavedLocale();
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(nextSaved === 'ar');
      const nextApplied = appliedLocaleFor({
        saved: nextSaved,
        nativeIsRTL: I18nManager.isRTL,
      });
      setAppliedLocale(nextApplied);
      if (cancelled) return;
      setSaved(nextSaved);
      setApplied(nextApplied);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      applied,
      saved,
      pending: saved !== applied,
      selectLanguage: async (next) => {
        if (next === saved) return;
        await writeSavedLocale(next);
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(next === 'ar');
        setSaved(next);
      },
    }),
    [applied, saved],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    return {
      applied: 'en',
      saved: 'en',
      pending: false,
      selectLanguage: async () => undefined,
    };
  }
  return value;
}

export { t };
