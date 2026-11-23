import React from 'react';
import { chevronForwardIcon } from '../../i18n/direction';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../../theme';
import { ABOUT_SECTION_LABELS } from '../../data/types/profile';
import {
  AboutCompletionKey,
  AboutCompletionState,
  ABOUT_COMPLETION_KEYS,
} from '../../utils/aboutCompletion';

type Props = {
  visible: boolean;
  state: AboutCompletionState;
  onClose: () => void;
  onSelect: (key: AboutCompletionKey) => void;
};

export default function AboutCompletionPrompt({
  visible,
  state,
  onClose,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Complete your profile</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Add your bio, languages, and talents so clients can understand your work.
        </Text>
        {ABOUT_COMPLETION_KEYS.map((key) => {
          const done =
            key === 'bio'
              ? state.bioComplete
              : key === 'languages'
                ? state.languagesComplete
                : state.talentsComplete;
          return (
            <TouchableOpacity
              key={key}
              style={styles.row}
              onPress={() => onSelect(key)}
              activeOpacity={0.85}
            >
              <View style={[styles.statusIcon, done && styles.statusIconDone]}>
                <Ionicons
                  name={done ? 'checkmark' : 'alert'}
                  size={14}
                  color={done ? colors.white : colors.primary}
                />
              </View>
              <Text style={styles.rowLabel}>{ABOUT_SECTION_LABELS[key]}</Text>
              <Ionicons name={chevronForwardIcon()} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, color: colors.text },
  closeBtn: { padding: 4 },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusIconDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
});
