import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

/**
 * Nonanimated reserved space for a Home section that is still pending after
 * other content is already on screen.
 */
export default function HomePendingPlaceholder({
  height = 96,
}: {
  height?: number;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.borderLight,
  },
});
