import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, typography } from '../../theme';

/**
 * Blocks the product tree during fail-closed media-cache cleanup.
 * Does not unmount NavigationContainer.
 */
export default function AuthTransitionOverlay({
  visible,
  retrying,
  failed,
  onRetry,
}: {
  visible: boolean;
  retrying?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {failed ? (
        <>
          <Text style={styles.title}>Couldn’t clear saved images</Text>
          <Text style={styles.body}>
            Images from the previous session are still on this device. Try again
            before continuing.
          </Text>
          <Button
            title="Try again"
            onPress={() => onRetry?.()}
            loading={retrying}
            disabled={retrying}
          />
        </>
      ) : (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(247, 249, 251, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    zIndex: 50,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
