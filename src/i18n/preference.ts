import * as SecureStore from 'expo-secure-store';
import { AppLocale, normalizeLocale } from './locale';

const KEY = 'mawahib.locale';

export async function readSavedLocale(): Promise<AppLocale> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return normalizeLocale(raw);
  } catch {
    return 'en';
  }
}

export async function writeSavedLocale(locale: AppLocale): Promise<void> {
  await SecureStore.setItemAsync(KEY, locale);
}
