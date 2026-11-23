import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import { UserJobStatus } from '../../data/types/userJobs';

export type JobsSort = 'newest' | 'oldest' | 'due-date';

export interface JobsFilters {
  status: 'all' | UserJobStatus;
  sort: JobsSort;
}

export const defaultJobsFilters: JobsFilters = {
  status: 'all',
  sort: 'newest',
};

interface JobsFilterSheetProps {
  visible: boolean;
  filters: JobsFilters;
  onClose: () => void;
  onApply: (filters: JobsFilters) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: { id: JobsFilters['status']; labelKey: MessageKey }[] = [
  { id: 'all', labelKey: 'discover.allStatuses' },
  { id: 'pending', labelKey: 'status.pending' },
  { id: 'under-review', labelKey: 'status.underReview' },
  { id: 'selected', labelKey: 'status.selected' },
  { id: 'changes-requested', labelKey: 'status.changesRequested' },
  { id: 'changes-declined', labelKey: 'status.changesDeclined' },
  { id: 'pending-payment', labelKey: 'status.pendingPayment' },
  { id: 'in-progress', labelKey: 'status.inProgress' },
  { id: 'delivered', labelKey: 'status.delivered' },
  { id: 'completed', labelKey: 'status.completed' },
  { id: 'rejected', labelKey: 'status.rejected' },
  { id: 'withdrawn', labelKey: 'status.cancelled' },
];

const SORT_OPTIONS: { id: JobsSort; labelKey: MessageKey }[] = [
  { id: 'newest', labelKey: 'discover.newestFirst' },
  { id: 'oldest', labelKey: 'discover.oldestFirst' },
  { id: 'due-date', labelKey: 'discover.dueDate' },
];

export default function JobsFilterSheet({
  visible,
  filters,
  onClose,
  onApply,
  onReset,
}: JobsFilterSheetProps) {
  const [draft, setDraft] = React.useState(filters);

  React.useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{t('discover.filterJobs')}</Text>
          <TouchableOpacity onPress={onReset}>
            <Text style={styles.reset}>{t('discover.reset')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>{t('discover.status')}</Text>
        <View style={styles.chipWrap}>
          {STATUS_OPTIONS.map((option) => {
            const selected = draft.status === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setDraft((prev) => ({ ...prev, status: option.id }))}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {t(option.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{t('discover.sortBy')}</Text>
        <View style={styles.chipWrap}>
          {SORT_OPTIONS.map((option) => {
            const selected = draft.sort === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setDraft((prev) => ({ ...prev, sort: option.id }))}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {t(option.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <Text style={styles.applyText}>{t('discover.applyFiltersLong')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h3, color: colors.text },
  reset: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  sectionLabel: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#FFF0F7' },
  chipText: { ...typography.bodySmall, color: colors.textSecondary },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  applyText: { ...typography.button, color: colors.white },
});
