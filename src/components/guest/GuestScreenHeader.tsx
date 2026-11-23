import React from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';

export default function GuestScreenHeader({
  title,
  onBack,
}: {
  title?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.side} accessibilityRole="button">
        <Ionicons name={backIcon()} size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  side: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
});
