import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';

const ACTION_HIT_SLOP = { top: 6, bottom: 6, left: 2, right: 2 } as const;

export default function ProfileVisitorActions({
  connectLabel = 'Connect',
  connectIcon = 'person-add-outline',
  connectTone = 'default',
  messageEnabled = true,
  busy = false,
  onConnect,
  onMessage,
  onRequest,
}: {
  connectLabel?: string;
  connectIcon?: keyof typeof Ionicons.glyphMap;
  connectTone?: 'default' | 'pending' | 'done';
  messageEnabled?: boolean;
  busy?: boolean;
  onConnect: () => void;
  onMessage: () => void;
  onRequest: () => void;
}) {
  return (
    <>
      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={[
            styles.connectBtn,
            connectTone === 'done' && styles.connectBtnDone,
            connectTone === 'pending' && styles.connectBtnPending,
          ]}
          onPress={onConnect}
          disabled={busy}
          activeOpacity={0.85}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={connectLabel}
        >
          <Ionicons name={connectIcon} size={18} color={colors.white} />
          <Text style={styles.connectText}>{connectLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.messageBtn, !messageEnabled && styles.messageBtnDisabled]}
          onPress={onMessage}
          activeOpacity={0.85}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Message"
        >
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={messageEnabled ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[styles.messageText, !messageEnabled && styles.messageTextDisabled]}
          >
            Message
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.hireRow}>
        <TouchableOpacity
          style={styles.hireBtn}
          onPress={onRequest}
          activeOpacity={0.85}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Request Work"
        >
          <Ionicons name="briefcase-outline" size={17} color={colors.primary} />
          <Text style={styles.hireText}>Request Work</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  ctaRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  connectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 43,
  },
  connectBtnDone: {
    backgroundColor: '#00A63E',
  },
  connectBtnPending: {
    backgroundColor: '#627D98',
  },
  connectText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.white },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 43,
  },
  messageBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  messageText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.primary },
  messageTextDisabled: { color: colors.textSecondary },
  hireRow: {
    paddingHorizontal: spacing.screen,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  hireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    minHeight: 41,
  },
  hireText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.primary },
});
