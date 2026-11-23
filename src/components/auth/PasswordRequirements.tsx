import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import { colors, spacing, typography } from '../../theme';
import { evaluatePassword } from '../../lib/passwordRules';

const PASSWORD_LABELS: Record<string, MessageKey> = {
  length: 'password.length',
  uppercase: 'password.upper',
  lowercase: 'password.lower',
  number: 'password.number',
  special: 'password.special',
};

export default function PasswordRequirements({ password }: { password: string }) {
  const checks = evaluatePassword(password);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {checks.map((check) => (
        <View key={check.id} style={styles.row}>
          <Ionicons
            name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={check.met ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.label,
              check.met ? styles.labelMet : styles.labelPending,
            ]}
          >
            {t(PASSWORD_LABELS[check.id] ?? 'password.length')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
  },
  labelMet: {
    color: colors.primary,
  },
  labelPending: {
    color: colors.textSecondary,
  },
});
