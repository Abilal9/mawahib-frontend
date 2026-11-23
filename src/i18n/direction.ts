import { I18nManager } from 'react-native';

/** Navigation back. Media controls and non-directional icons stay as drawn. */
export function backIcon(): 'arrow-back' | 'arrow-forward' {
  return I18nManager.isRTL ? 'arrow-forward' : 'arrow-back';
}

export function chevronBackIcon(): 'chevron-back' | 'chevron-forward' {
  return I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
}

export function chevronForwardIcon(): 'chevron-forward' | 'chevron-back' {
  return I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
}
