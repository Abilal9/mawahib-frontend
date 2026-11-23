import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import TextInput from '../../components/ui/TextInput';
import MoneyAmountField from '../../components/ui/MoneyAmountField';
import CalendarPicker from '../../components/ui/CalendarPicker';
import { startOfLocalMonth } from '../../utils/calendarDay';
import { getAppliedLocale, t } from '../../i18n/runtime';
import { formatGregorianLocalDay } from '../../utils/gregorianCivilDate';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import { colors, spacing, radius, typography } from '../../theme';
import { ApiError } from '../../lib/apiClient';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { useVisitorUser } from '../../hooks/useVisitorUser';
import { ScreenProps } from '../../navigation/types';
import {
  DURATION_UNITS,
  DurationUnit,
  WorkRequestDeadlineInput,
  toIsoDate,
} from '../../services/workRequestApi';
import type { CurrencyCode } from '../../data/location/geo';
import { normalizeCurrencyCode } from '../../data/location/geo';
import {
  normalizeMoneyInputEditing,
  parseMoneyInput,
} from '../../utils/money';
import type { LocalPickedFile } from '../../lib/uploadMedia';
import {
  attachFilesToWorkRequest,
  attachmentFailureMessage,
  promptPickWorkRequestFile,
} from '../../lib/workRequestAttachmentUpload';
import { attachmentIcon, WORK_REQUEST_ATTACHMENT_MAX_COUNT } from '../../utils/workRequestAttachments';
import { formatBytes } from '../../utils/formatBytes';

type DeadlineMode = 'exact_date' | 'duration' | 'flexible';

type PendingAttachment = { id: string; file: LocalPickedFile };

function deadlineModeLabel(id: DeadlineMode): string {
  if (id === 'exact_date') return t('work.exactDate');
  if (id === 'duration') return t('work.durationMode');
  return t('work.flexible');
}

function durationUnitLabel(unit: DurationUnit): string {
  if (unit === 'days') return t('work.days');
  if (unit === 'weeks') return t('work.weeks');
  return t('work.months');
}

function formatPickedDate(date: Date) {
  return formatGregorianLocalDay(date, getAppliedLocale());
}

/**
 * Cold "hire me" request — no listing, no service offering. Budget and deadline
 * are structured so the recipient negotiates against real values.
 */
export default function DirectRequestScreen({
  route,
  navigation,
}: ScreenProps<'DirectRequest'>) {
  const { createDirectRequest, refresh } = useUserJobs();
  const recipient = useVisitorUser(route.params.userId);
  // Provider (recipient) default currency is the commercial context for a direct hire.
  const requestCurrency: CurrencyCode = normalizeCurrencyCode(
    recipient.user?.defaultCurrency,
  );
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);

  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [amountText, setAmountText] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>('flexible');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfLocalMonth(new Date()));
  const [exactDate, setExactDate] = useState<Date | null>(null);
  const [durationValue, setDurationValue] = useState('2');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('weeks');

  const amount = parseMoneyInput(amountText);
  const amountInvalid = amountText.trim().length > 0 && amount === null;

  const buildDeadline = (): WorkRequestDeadlineInput | null => {
    if (deadlineMode === 'exact_date') {
      return exactDate
        ? { type: 'exact_date', startDate: toIsoDate(exactDate) }
        : null;
    }
    if (deadlineMode === 'duration') {
      const value = Number(durationValue);
      if (!Number.isInteger(value) || value < 1) return null;
      return { type: 'duration', durationValue: value, durationUnit };
    }
    return { type: 'flexible' };
  };

  const chooseDeadlineMode = (mode: DeadlineMode) => {
    if (mode === deadlineMode) return;
    setDeadlineMode(mode);
    setExactDate(null);
    setDurationValue('');
    setDurationUnit('days');
    setVisibleMonth(startOfLocalMonth(new Date()));
  };

  const deadline = buildDeadline();
  const canSubmit =
    !submitting && !!title.trim() && !amountInvalid && deadline !== null;

  const addFile = () => {
    if (submitting) return;
    if (attachments.length >= WORK_REQUEST_ATTACHMENT_MAX_COUNT) {
      Alert.alert(
        t('work.tooManyFiles'),
        t('work.fileLimit', { count: WORK_REQUEST_ATTACHMENT_MAX_COUNT }),
      );
      return;
    }
    void (async () => {
      const picked = await promptPickWorkRequestFile();
      if (!picked) return;
      if ('error' in picked) {
        Alert.alert(t('work.attachFailed'), picked.error);
        return;
      }
      setAttachments((prev) => [
        ...prev,
        { id: `file-${Date.now()}-${prev.length}`, file: picked.file },
      ]);
    })();
  };

  /**
   * The create API carries no files, so: create the request first, then upload
   * each file (purpose `work_request`) and register it on the new request.
   */
  const submit = () => {
    if (!deadline || submitting) return;
    void (async () => {
      setSubmitting(true);
      try {
        const requestId = await createDirectRequest({
          recipientUserId: route.params.userId,
          title: title.trim(),
          scope: scope.trim() || undefined,
          money:
            amount !== null
              ? { amount, currency: requestCurrency }
              : undefined,
          deadline,
          message: message.trim() || undefined,
        });
        const attach =
          attachments.length > 0
            ? await attachFilesToWorkRequest(
                requestId,
                attachments.map((a) => a.file),
              )
            : null;
        setSubmitting(false);
        if (attach && attach.failed.length > 0) {
          Alert.alert(
            t('work.someFilesFailed'),
            attachmentFailureMessage(attach.failed),
            [{ text: t('work.ok'), onPress: () => showSuccess('directRequestSent') }],
          );
          return;
        }
        showSuccess('directRequestSent');
      } catch (e) {
        Alert.alert(
          t('work.sendFailed'),
          e instanceof ApiError || e instanceof Error
            ? e.message
            : t('work.pleaseTry'),
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const queueSend = () => {
    if (!canSubmit || submitting) return;
    setConfirmSend(true);
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('work.requestWork')}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            {recipient.user
              ? t('work.directIntroNamed', { name: recipient.user.name })
              : t('work.directIntro')}
          </Text>

          <TextInput
            label={t('work.title')}
            placeholder={t('work.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            label={t('work.scope')}
            placeholder={t('work.scopePlaceholder')}
            value={scope}
            onChangeText={setScope}
            multiline
            numberOfLines={5}
            style={styles.multiline}
          />
          <MoneyAmountField
            label={t('work.budget')}
            placeholder="0"
            value={amountText}
            onChangeText={(text) =>
              setAmountText(normalizeMoneyInputEditing(text))
            }
            currency={requestCurrency}
            error={amountInvalid ? t('work.amountPositiveZero') : undefined}
          />

          <Text style={styles.fieldLabel}>{t('work.deadline')}</Text>
          <View style={styles.modeToggle}>
            {(['exact_date', 'duration', 'flexible'] as DeadlineMode[]).map((modeId) => {
              const active = deadlineMode === modeId;
              return (
                <TouchableOpacity
                  key={modeId}
                  style={[styles.modeBtn, active && styles.modeBtnActive]}
                  onPress={() => chooseDeadlineMode(modeId)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      active && styles.modeBtnTextActive,
                    ]}
                  >
                    {deadlineModeLabel(modeId)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {deadlineMode === 'exact_date' ? (
            <View style={styles.deadlineBlock}>
              <View style={[styles.dateField, styles.dateFieldActive]}>
                <Text style={styles.dateFieldValue}>
                  {exactDate ? formatPickedDate(exactDate) : t('work.selectDate')}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <CalendarPicker
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                onPickDay={setExactDate}
                selected={exactDate}
              />
            </View>
          ) : null}

          {deadlineMode === 'duration' ? (
            <View style={styles.durationRow}>
              <TextInput
                containerStyle={styles.durationValueField}
                placeholder="2"
                value={durationValue}
                onChangeText={(text) =>
                  setDurationValue(text.replace(/[^\d]/g, '').slice(0, 4))
                }
                keyboardType="number-pad"
                style={styles.durationValueInput}
              />
              <View style={styles.unitToggle}>
                {DURATION_UNITS.map((unit) => {
                  const active = durationUnit === unit;
                  return (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.modeBtn, active && styles.modeBtnActive]}
                      onPress={() => setDurationUnit(unit)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          active && styles.modeBtnTextActive,
                        ]}
                      >
                        {durationUnitLabel(unit)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {deadlineMode === 'flexible' ? (
            <Text style={styles.hintText}>
              {t('work.flexibleHint')}
            </Text>
          ) : null}

          <View style={styles.messageField}>
            <TextInput
              label={t('work.message')}
              placeholder={t('work.messagePlaceholder')}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={styles.multiline}
            />
          </View>

          <View style={styles.attachmentsHeader}>
            <Text style={styles.fieldLabelInline}>{t('work.attachments')}</Text>
            <TouchableOpacity onPress={addFile} hitSlop={8} accessibilityLabel={t('work.attachFile')}>
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {attachments.length === 0 ? (
            <Text style={styles.hintText}>{t('work.attachHint')}</Text>
          ) : (
            attachments.map((file) => (
              <View key={file.id} style={styles.fileRow}>
                <Ionicons name={attachmentIcon(file.file.mimeType)} size={22} color={colors.primary} />
                <View style={styles.fileMeta}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.file.fileName}</Text>
                  <Text style={styles.fileSize}>{formatBytes(file.file.byteSize)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setAttachments((prev) => prev.filter((f) => f.id !== file.id))
                  }
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('work.sendRequest')}
            loading={submitting}
            fullWidth
            disabled={!canSubmit}
            onPress={queueSend}
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmActionModal
        visible={confirmSend}
        title={t('work.sendRequestTitle')}
        message={t('work.sendRequestBody')}
        confirmLabel={t('work.sendRequest')}
        busy={submitting}
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          setConfirmSend(false);
          submit();
        }}
      />

      <ActionBusyOverlay visible={submitting} message={t('work.sendingRequest')} />
      <SuccessConfirmationModal
        visible={successVisible}
        title={successTitle}
        message={successMessage}
        onDone={() => void completeSuccess()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldLabelInline: {
    ...typography.label,
    color: colors.text,
    marginBottom: 0,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  fileMeta: { flex: 1 },
  fileName: { ...typography.label, color: colors.text },
  fileSize: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radius.button,
    padding: 2,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.button - 2,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeBtnTextActive: { color: colors.white },
  deadlineBlock: { gap: spacing.sm, marginTop: spacing.sm },
  dateField: {
    minHeight: 42,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
  },
  dateFieldActive: { borderColor: colors.primary },
  dateFieldValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  durationValueField: { width: 84, marginBottom: 0 },
  durationValueInput: { textAlign: 'center' },
  unitToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radius.button,
    padding: 2,
  },
  hintText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  messageField: { marginTop: spacing.lg },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
});
