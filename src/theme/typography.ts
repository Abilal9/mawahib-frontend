import { I18nManager, TextStyle } from 'react-native';

const arabic = I18nManager.isRTL;

/**
 * English uses Inter. Arabic uses the platform font so Arabic letters are not
 * drawn from a Latin-only file. Direction is fixed for the process.
 */
export const fontFamily = arabic
  ? {
      regular: undefined,
      medium: undefined,
      semiBold: undefined,
      bold: undefined,
    }
  : {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semiBold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    };

function weight(name: '400' | '500' | '600' | '700'): TextStyle {
  return arabic ? { fontWeight: name } : {};
}

export const typography: Record<string, TextStyle> = {
  h1: {
    fontFamily: fontFamily.bold,
    ...weight('700'),
    fontSize: 28,
    lineHeight: arabic ? 40 : 34,
    letterSpacing: arabic ? 0 : -0.5,
  },
  h2: {
    fontFamily: fontFamily.bold,
    ...weight('700'),
    fontSize: 22,
    lineHeight: arabic ? 34 : 28,
    letterSpacing: arabic ? 0 : -0.3,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    ...weight('600'),
    fontSize: 18,
    lineHeight: arabic ? 30 : 24,
  },
  body: {
    fontFamily: fontFamily.regular,
    ...weight('400'),
    fontSize: 16,
    lineHeight: arabic ? 28 : 24,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    ...weight('500'),
    fontSize: 16,
    lineHeight: arabic ? 28 : 24,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    ...weight('400'),
    fontSize: 14,
    lineHeight: arabic ? 24 : 20,
  },
  caption: {
    fontFamily: fontFamily.regular,
    ...weight('400'),
    fontSize: 12,
    lineHeight: arabic ? 20 : 16,
  },
  label: {
    fontFamily: fontFamily.medium,
    ...weight('500'),
    fontSize: 14,
    lineHeight: arabic ? 24 : 20,
  },
  button: {
    fontFamily: fontFamily.semiBold,
    ...weight('600'),
    fontSize: 16,
    lineHeight: arabic ? 26 : 20,
  },
};
