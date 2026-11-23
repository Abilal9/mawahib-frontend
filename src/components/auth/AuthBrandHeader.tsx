import React from 'react';
import { backIcon } from '../../i18n/direction';
import { t } from '../../i18n/runtime';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

/**
 * Auth/onboarding brand mark — matches WelcomeScreen logo treatment:
 * arabic-emblem, 112 drawn in a 48 layout slot, centered under the safe area.
 * Visual-only; optional back does not shift the logo off-center.
 */
const AUTH_LOGO_LAYOUT = 48;
const AUTH_LOGO_DRAW = 112;

type Props = {
  onBack?: () => void;
};

export default function AuthBrandHeader({ onBack }: Props) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('auth.back')}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.logoSlot} pointerEvents="none">
        <Image
          source={require('../../../assets/images/arabic-emblem.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: AUTH_LOGO_LAYOUT,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    width: AUTH_LOGO_DRAW,
    height: AUTH_LOGO_DRAW,
  },
});
