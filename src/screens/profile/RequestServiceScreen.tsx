import React, { useMemo, useState } from 'react';
import { chevronBackIcon, chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import MoneyAmount from '../../components/ui/MoneyAmount';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import { getAppliedLocale } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import {
  isCalendarDayBlocked,
  isBeforeCurrentMonth,
  isCurrentLocalMonth,
  isSameLocalDay,
  startOfLocalDay,
  startOfLocalMonth,
} from '../../utils/calendarDay';
import {
  formatGregorianMonthTitle,
  gregorianWeekdayHeading,
} from '../../utils/gregorianCivilDate';
import { acceptedGoogleMapsUrl } from '../../utils/googleMapsLink';
import { ProfileService, ServicePackage } from '../../data/types';
import {
  PACKAGE_TIER_BY_NAME,
  useUserJobs,
} from '../../context/UserJobsContext';
import { ApiError } from '../../lib/apiClient';
import {
  WorkRequestDeadlineInput,
  toIsoDate,
} from '../../services/workRequestApi';
import { ScreenProps } from '../../navigation/types';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { useVisitorProfessionalProfile } from '../../hooks/useVisitorProfessionalProfile';
import { useVisitorUser } from '../../hooks/useVisitorUser';
import type { LocalPickedFile } from '../../lib/uploadMedia';
import {
  attachFilesToWorkRequest,
  attachmentFailureMessage,
  promptPickWorkRequestFile,
} from '../../lib/workRequestAttachmentUpload';
import {
  attachmentIcon,
  WORK_REQUEST_ATTACHMENT_MAX_COUNT,
} from '../../utils/workRequestAttachments';
import { formatBytes } from '../../utils/formatBytes';

/**
 * Visitor multi-step flow to request a provider's service (no payment yet).
 *
 * Steps: service+package → add-ons → notes → attachments → schedule → location → review.
 * Optional steps (2–6) can be skipped; Apply creates a pending sent job via
 * `createServiceRequest`, then confirms and resets navigation into Jobs.
 */
const TOTAL_STEPS = 7;


type PackageName = ServicePackage['name'];
type ScheduleMode = 'deadline' | 'duration';
type PendingAttachment = { id: string; file: LocalPickedFile };

function packageAmount(pkg: ServicePackage | undefined): number {
  if (!pkg) return 0;
  if (typeof pkg.price === 'number' && Number.isFinite(pkg.price)) return pkg.price;
  return 0;
}

function addonAmount(addon: { price?: number }): number {
  if (typeof addon.price === 'number' && Number.isFinite(addon.price)) {
    return addon.price;
  }
  return 0;
}

function formatDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function RequestServiceScreen({
  navigation,
  route,
}: ScreenProps<'RequestService'>) {
  const insets = useSafeAreaInsets();
  const { createServiceRequest, refresh } = useUserJobs();
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);

  const providerUser = useVisitorUser(route.params.userId);
  const provider = providerUser.user;
  const visitor = useVisitorProfessionalProfile(route.params.userId);
  const services = visitor.services;
  const currencyLocation = provider?.location;

  const initialService = services.find((s) => s.id === route.params.serviceId);
  const initialPackage: PackageName | undefined =
    route.params.packageName ?? initialService?.packages[0]?.name;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  // Step 1
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialService?.id ?? route.params.serviceId ?? ''
  );
  const [selectedPackage, setSelectedPackage] = useState<PackageName | null>(
    initialPackage ?? null
  );
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');

  const selectedServiceForCurrency = services.find(
    (s) => s.id === (selectedServiceId || route.params.serviceId),
  );
  // Prefer the selected offering snapshot; fall back to provider default only
  // before services have loaded.
  const objectCurrency =
    selectedServiceForCurrency?.currency === 'AED' ||
    selectedServiceForCurrency?.currency === 'SAR'
      ? selectedServiceForCurrency.currency
      : provider?.defaultCurrency === 'AED' ||
          provider?.defaultCurrency === 'SAR'
        ? provider.defaultCurrency
        : null;

  // Step 2
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Step 3
  const [notes, setNotes] = useState('');

  // Step 4
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  // Step 5
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('deadline');
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo, setRangeTo] = useState<Date | null>(null);
  const [activeRangeField, setActiveRangeField] = useState<'from' | 'to'>('from');
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfLocalMonth(new Date()),
  );

  // Step 6
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [locationDetails, setLocationDetails] = useState('');

  const selectedService: ProfileService | undefined = services.find(
    (s) => s.id === selectedServiceId
  );

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [services, serviceQuery]);

  const packagePrice = selectedService
    ? packageAmount(
        selectedService.packages.find((p) => p.name === selectedPackage),
      )
    : 0;
  const selectedAddons = useMemo(() => {
    const addons = selectedService?.addons ?? [];
    return addons.filter((addon) => selectedAddonIds.includes(addon.id));
  }, [selectedAddonIds, selectedService]);
  const addonSubtotal = selectedAddons.reduce(
    (sum, addon) => sum + addonAmount(addon),
    0,
  );
  const requestTotal = packagePrice + addonSubtotal;

  const canNextStep1 = Boolean(selectedService && selectedPackage);
  const scheduleReady =
    scheduleMode === 'deadline'
      ? Boolean(deadlineDate)
      : Boolean(rangeFrom && rangeTo);

  const savedMapsUrl = acceptedGoogleMapsUrl(mapsLink);
  const mapsInvalid = mapsLink.trim().length > 0 && !savedMapsUrl;

  const footerPrimaryDisabled =
    (step === 1 && !canNextStep1) ||
    (step === 5 && !scheduleReady) ||
    (step === 6 && mapsInvalid);

  const showSkip = step >= 2 && step <= 6;

  const dateSummary = useMemo(() => {
    if (scheduleMode === 'deadline' && deadlineDate) return formatDate(deadlineDate);
    if (scheduleMode === 'duration' && rangeFrom && rangeTo) {
      return `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}`;
    }
    return '';
  }, [scheduleMode, deadlineDate, rangeFrom, rangeTo]);

  /** Undefined keeps whatever delivery time the package already carries. */
  const deadlineInput = useMemo((): WorkRequestDeadlineInput | undefined => {
    if (scheduleMode === 'deadline' && deadlineDate) {
      return { type: 'exact_date', startDate: toIsoDate(deadlineDate) };
    }
    if (scheduleMode === 'duration' && rangeFrom && rangeTo) {
      return {
        type: 'date_range',
        startDate: toIsoDate(rangeFrom),
        endDate: toIsoDate(rangeTo),
      };
    }
    return undefined;
  }, [scheduleMode, deadlineDate, rangeFrom, rangeTo]);

  const goBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    navigation.goBack();
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  // Clear this step's draft so a skipped optional field never leaks into the payload.
  const skipStep = () => {
    if (step === 2) setSelectedAddonIds([]);
    if (step === 3) setNotes('');
    if (step === 4) setAttachments([]);
    if (step === 5) {
      setDeadlineDate(null);
      setRangeFrom(null);
      setRangeTo(null);
    }
    if (step === 6) {
      setCountry('');
      setCity('');
      setMapsLink('');
      setLocationDetails('');
    }
    goNext();
  };

  /** Switching service resets package + add-ons so they stay valid for the new offering. */
  const selectService = (service: ProfileService) => {
    setSelectedServiceId(service.id);
    setSelectedPackage(service.packages[0]?.name ?? null);
    setSelectedAddonIds([]);
    setServiceSheetOpen(false);
    setServiceQuery('');
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addAttachment = () => {
    if (submitting) return;
    if (attachments.length >= WORK_REQUEST_ATTACHMENT_MAX_COUNT) {
      Alert.alert(
        'Too many files',
        `You can attach up to ${WORK_REQUEST_ATTACHMENT_MAX_COUNT} files.`,
      );
      return;
    }
    void (async () => {
      const picked = await promptPickWorkRequestFile();
      if (!picked) return;
      if ('error' in picked) {
        Alert.alert('Could not attach file', picked.error);
        return;
      }
      setAttachments((prev) => [
        ...prev,
        { id: `att-${Date.now()}-${prev.length}`, file: picked.file },
      ]);
    })();
  };

  /**
   * Deadline mode: single selected day.
   * Duration mode: first tap sets "from", second tap sets "to"; tapping an earlier
   * day restarts the range so from ≤ to always holds.
   */
  const chooseScheduleMode = (mode: ScheduleMode) => {
    if (mode === scheduleMode) return;
    setScheduleMode(mode);
    setDeadlineDate(null);
    setRangeFrom(null);
    setRangeTo(null);
    setActiveRangeField('from');
    setCalendarMonth(startOfLocalMonth(new Date()));
  };

  const onPickCalendarDay = (day: number) => {
    const picked = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const floor =
      scheduleMode === 'duration' && activeRangeField === 'to' ? rangeFrom : null;
    if (isCalendarDayBlocked(picked, new Date(), floor)) return;
    if (scheduleMode === 'deadline') {
      setDeadlineDate(picked);
      return;
    }
    if (activeRangeField === 'from' || !rangeFrom) {
      setRangeFrom(picked);
      setRangeTo(null);
      setActiveRangeField('to');
      return;
    }
    setRangeTo(picked);
  };

  /**
   * Creates a `service_request` work request, then uploads each attachment
   * (purpose `work_request`) and registers it on the new request — the create
   * API carries no files. The place (city, country, details) is saved on the
   * terms and also noted in plain text. A pasted maps URL is not opened.
   */
  const sendRequest = () => {
    if (!provider || !selectedService || !selectedPackage || submitting) return;
    if (mapsLink.trim() && !savedMapsUrl) return;

    const locationLine = [
      [city.trim(), country.trim()].filter(Boolean).join(', '),
      locationDetails.trim(),
    ]
      .filter(Boolean)
      .join(' · ');
    const notesLines = [
      notes.trim(),
      locationLine ? `Location: ${locationLine}` : '',
    ].filter(Boolean);

    void (async () => {
      setSubmitting(true);
      try {
        const requestId = await createServiceRequest({
          serviceOfferingId: selectedService.id,
          packageTier: PACKAGE_TIER_BY_NAME[selectedPackage],
          addonIds: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
          notes: notesLines.join('\n') || undefined,
          location: locationLine || undefined,
          mapsUrl: savedMapsUrl ?? undefined,
          deadline: deadlineInput,
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
            'Some files were not attached',
            attachmentFailureMessage(attach.failed),
            [{ text: 'OK', onPress: () => showSuccess('serviceRequestSent') }],
          );
          return;
        }
        showSuccess('serviceRequestSent');
      } catch (e) {
        Alert.alert(
          'Could not send request',
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  if (providerUser.loading || visitor.loading) {
    return (
      <ScreenContainer>
        <StatusBar style="dark" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Loading provider…
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!provider) {
    return (
      <ScreenContainer>
        <StatusBar style="dark" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.text, textAlign: 'center' }}>
            Provider not found
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.bodyMedium, color: colors.primary }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const monthLabel = formatGregorianMonthTitle(year, month + 1, getAppliedLocale());

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name={chevronBackIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressSeg, i < step && styles.progressSegActive]}
            />
          ))}
        </View>
        <Text style={styles.stepCount}>
          {step}/{TOTAL_STEPS}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <Text style={styles.pageTitle}>Request a Service</Text>

              <Text style={styles.label}>Service</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setServiceSheetOpen(true)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.selectValue,
                    !selectedService && styles.selectPlaceholder,
                  ]}
                >
                  {selectedService?.title ?? 'Select a Service'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {selectedService ? (
                <>
                  <Text style={[styles.pageTitle, styles.sectionTitleSpaced]}>
                    Choose a Package
                  </Text>
                  {selectedService.packages.map((pkg) => {
                    const active = selectedPackage === pkg.name;
                    return (
                      <TouchableOpacity
                        key={pkg.name}
                        style={[styles.packageCard, active && styles.packageCardActive]}
                        onPress={() => setSelectedPackage(pkg.name)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active ? (
                            <Ionicons name="checkmark" size={12} color={colors.white} />
                          ) : null}
                        </View>
                        <Text style={[styles.packageName, active && styles.packageNameActive]}>
                          {pkg.name}
                        </Text>
                        <View style={styles.priceInline}>
                          <MoneyAmount
                            amount={packageAmount(pkg)}
                            currency={pkg.currency ?? objectCurrency}
                            size={16}
                            color={active ? colors.primary : colors.text}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.pageTitle}>Add Optional Add-Ons</Text>
              {(selectedService?.addons ?? []).length === 0 ? (
                <Text style={styles.emptyHint}>No add-ons for this service.</Text>
              ) : (
                (selectedService?.addons ?? []).map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <TouchableOpacity
                      key={addon.id}
                      style={[styles.addonCard, checked && styles.addonCardActive]}
                      onPress={() => toggleAddon(addon.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
                        {checked ? (
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        ) : null}
                      </View>
                      <Text style={styles.addonTitle}>{addon.title}</Text>
                      <View style={styles.priceInline}>
                        <MoneyAmount
                          amount={addonAmount(addon)}
                          currency={addon.currency ?? objectCurrency}
                          size={14}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.pageTitle}>Your Project Details</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Describe your vision, goals, and any important context..."
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <View style={styles.attachmentsHeader}>
                <Text style={styles.pageTitleInline}>Attachments</Text>
                <TouchableOpacity onPress={addAttachment} hitSlop={8}>
                  <Ionicons name="add" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {attachments.length === 0 ? (
                <Text style={styles.emptyHint}>
                  Tap + to attach PDF, JPG or PNG files (up to 20 MB each).
                </Text>
              ) : (
                attachments.map((file) => (
                  <View key={file.id} style={styles.fileRow}>
                    <Ionicons name={attachmentIcon(file.file.mimeType)} size={22} color={colors.text} />
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
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Text style={styles.pageTitle}>Set a Deadline</Text>
              <View style={styles.segment}>
                {(['deadline', 'duration'] as ScheduleMode[]).map((mode) => {
                  const active = scheduleMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.segmentItem, active && styles.segmentItemActive]}
                      onPress={() => chooseScheduleMode(mode)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.segmentText, active && styles.segmentTextActive]}
                      >
                        {mode === 'deadline' ? 'Deadline' : 'Duration'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {scheduleMode === 'deadline' ? (
                <View style={styles.dateField}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text
                    style={[styles.dateFieldText, !deadlineDate && styles.selectPlaceholder]}
                  >
                    {deadlineDate ? formatDate(deadlineDate) : 'Select a date'}
                  </Text>
                </View>
              ) : (
                <View style={styles.rangeRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateField,
                      styles.rangeField,
                      activeRangeField === 'from' && styles.dateFieldFocused,
                    ]}
                    onPress={() => setActiveRangeField('from')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.dateFieldText, !rangeFrom && styles.selectPlaceholder]}
                    >
                      {rangeFrom ? formatDate(rangeFrom) : 'From'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateField,
                      styles.rangeField,
                      activeRangeField === 'to' && styles.dateFieldFocused,
                    ]}
                    onPress={() => setActiveRangeField('to')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.dateFieldText, !rangeTo && styles.selectPlaceholder]}
                    >
                      {rangeTo ? formatDate(rangeTo) : 'To'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.monthHeader}>
                <TouchableOpacity
                  disabled={
                    isCurrentLocalMonth(calendarMonth) ||
                    isBeforeCurrentMonth(calendarMonth)
                  }
                  onPress={() => {
                    const previous = new Date(year, month - 1, 1);
                    if (isBeforeCurrentMonth(previous)) return;
                    setCalendarMonth(previous);
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={chevronBackIcon()}
                    size={22}
                    color={
                      isCurrentLocalMonth(calendarMonth) ||
                      isBeforeCurrentMonth(calendarMonth)
                        ? colors.border
                        : colors.text
                    }
                  />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
                <TouchableOpacity
                  onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}
                  hitSlop={8}
                >
                  <Ionicons name={chevronForwardIcon()} size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekRow}>
                {Array.from({ length: 7 }, (_, index) => (
                  <Text key={index} style={styles.weekDay}>
                    {gregorianWeekdayHeading(index, getAppliedLocale())}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <View key={`e-${i}`} style={styles.dayCell} />
                ))}
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  const current = new Date(year, month, day);
                  const rangeFloor =
                    scheduleMode === 'duration' && activeRangeField === 'to'
                      ? rangeFrom
                      : null;
                  const blocked = isCalendarDayBlocked(current, new Date(), rangeFloor);
                  const isToday = isSameLocalDay(current, new Date());
                  const isDeadline =
                    scheduleMode === 'deadline' &&
                    deadlineDate &&
                    isSameLocalDay(current, deadlineDate);
                  const from =
                    scheduleMode === 'duration' && rangeFrom
                      ? startOfLocalDay(rangeFrom)
                      : null;
                  const to =
                    scheduleMode === 'duration' && rangeTo
                      ? startOfLocalDay(rangeTo)
                      : null;
                  const isStart = from && isSameLocalDay(current, from);
                  const isEnd = to && isSameLocalDay(current, to);
                  const inRange =
                    scheduleMode === 'duration' &&
                    from &&
                    to &&
                    current >= from &&
                    current <= to;
                  const selected = !blocked && (isDeadline || isStart || isEnd);
                  return (
                    <Pressable
                      key={day}
                      style={styles.dayCell}
                      disabled={blocked}
                      accessibilityState={{ disabled: blocked }}
                      onPress={blocked ? undefined : () => onPickCalendarDay(day)}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          isToday && !selected && styles.dayToday,
                          inRange && !blocked && styles.dayInRange,
                          selected && styles.daySelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            blocked && styles.dayTextDisabled,
                            selected && styles.dayTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <Text style={styles.pageTitle}>Set Location</Text>

              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="Country"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Google maps link</Text>
              <View style={styles.clearableField}>
                <TextInput
                  style={[styles.input, styles.clearableInput]}
                  value={mapsLink}
                  onChangeText={setMapsLink}
                  placeholder="https://maps.google.com/..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {mapsLink.length > 0 ? (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => setMapsLink('')}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {mapsInvalid ? (
                <Text style={styles.fieldError}>
                  Please enter a valid Google Maps link.
                </Text>
              ) : null}

              <Text style={styles.label}>Location Details</Text>
              <TextInput
                style={[styles.input, styles.locationDetails]}
                value={locationDetails}
                onChangeText={setLocationDetails}
                placeholder="Landmarks, floor, access notes..."
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </>
          ) : null}

          {step === 7 ? (
            <>
              <Text style={styles.pageTitle}>Review & Send</Text>

              <ReviewRow
                label="Service"
                onEdit={() => setStep(1)}
                value={selectedService?.title ?? '—'}
              />
              <ReviewRow label="Package selected" onEdit={() => setStep(1)}>
                <View style={styles.reviewPackageRow}>
                  <Text style={styles.reviewValue}>{selectedPackage ?? '—'}</Text>
                  <View style={styles.priceInline}>
                    <MoneyAmount
                      amount={packagePrice}
                      currency={objectCurrency}
                      size={14}
                    />
                  </View>
                </View>
              </ReviewRow>
              {selectedAddons.length > 0 ? (
                <ReviewRow label="Add-ons" onEdit={() => setStep(2)}>
                  {selectedAddons.map((addon) => (
                    <View key={addon.id} style={styles.reviewPackageRow}>
                      <Text style={styles.reviewValue}>{addon.title}</Text>
                      <View style={styles.priceInline}>
                        <MoneyAmount
                          amount={addonAmount(addon)}
                          currency={addon.currency ?? objectCurrency}
                          size={14}
                        />
                      </View>
                    </View>
                  ))}
                </ReviewRow>
              ) : null}
              <ReviewRow label="Base price">
                <MoneyAmount
                  amount={packagePrice}
                  currency={objectCurrency}
                  size={14}
                />
              </ReviewRow>
              <ReviewRow label="Add-ons">
                <MoneyAmount
                  amount={addonSubtotal}
                  currency={objectCurrency}
                  size={14}
                />
              </ReviewRow>
              <ReviewRow label="Total">
                <MoneyAmount
                  amount={requestTotal}
                  currency={objectCurrency}
                  size={16}
                />
              </ReviewRow>
              <ReviewRow
                label={scheduleMode === 'deadline' ? 'Deadline' : 'Duration'}
                onEdit={() => setStep(5)}
                value={dateSummary || 'Not set'}
              />
              <ReviewRow
                label="Your Request Notes"
                onEdit={() => setStep(3)}
                value={notes.trim() || 'No notes'}
              />
              <ReviewRow label="Attachments" onEdit={() => setStep(4)}>
                {attachments.length === 0 ? (
                  <Text style={styles.reviewMuted}>None</Text>
                ) : (
                  attachments.map((f) => (
                    <View key={f.id} style={styles.reviewFile}>
                      <Ionicons name="document-outline" size={16} color={colors.text} />
                      <Text style={styles.reviewValue}>{f.file.fileName}</Text>
                    </View>
                  ))
                )}
              </ReviewRow>
              <ReviewRow
                label="Location"
                onEdit={() => setStep(6)}
                value={
                  [
                    [city, country].filter(Boolean).join(', '),
                    locationDetails.trim(),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Not set'
                }
              />
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {step === 7 ? (
            <Button
              title={submitting ? 'Sending…' : 'Send Request'}
              fullWidth
              disabled={submitting}
              onPress={() => setConfirmSend(true)}
            />
          ) : showSkip ? (
            <View style={styles.footerRow}>
              <Button
                title="Skip"
                variant="outline"
                style={styles.skipBtn}
                onPress={skipStep}
              />
              <Button
                title="Next"
                style={styles.footerHalf}
                disabled={footerPrimaryDisabled}
                onPress={goNext}
              />
            </View>
          ) : (
            <Button
              title="Next"
              fullWidth
              disabled={footerPrimaryDisabled}
              onPress={goNext}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={serviceSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setServiceSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setServiceSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select a Service</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={serviceQuery}
                onChangeText={setServiceQuery}
                placeholder="Search"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <ScrollView
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredServices.map((service) => {
                const active = service.id === selectedServiceId;
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceRow, active && styles.serviceRowActive]}
                    onPress={() => selectService(service)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.serviceTextCol}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={styles.serviceDesc} numberOfLines={2}>
                        {service.description}
                      </Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmActionModal
        visible={confirmSend}
        title="Send Request?"
        message="Your service request will be sent to this provider."
        confirmLabel="Send Request"
        busy={submitting}
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          setConfirmSend(false);
          sendRequest();
        }}
      />

      <ActionBusyOverlay visible={submitting} message="Sending request…" />
      <SuccessConfirmationModal
        visible={successVisible}
        title={successTitle}
        message={successMessage}
        onDone={() => void completeSuccess()}
      />
    </ScreenContainer>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  children,
}: {
  label: string;
  value?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewLabel}>{label}</Text>
        {onEdit ? (
          <TouchableOpacity onPress={onEdit} hitSlop={8}>
            <Ionicons name="create-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      {children ?? (
        <Text style={value === 'Not set' || value === 'No notes' || value === 'None' ? styles.reviewMuted : styles.reviewValue}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6E4F0',
  },
  progressSegActive: {
    backgroundColor: colors.primary,
  },
  stepCount: {
    ...typography.label,
    color: colors.text,
    minWidth: 36,
    textAlign: 'right',
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  pageTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  pageTitleInline: {
    ...typography.h2,
    color: colors.text,
  },
  sectionTitleSpaced: {
    marginTop: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  fieldError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  selectValue: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  selectPlaceholder: {
    color: colors.textSecondary,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  packageCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF5FA',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  packageName: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  packageNameActive: {
    color: colors.primary,
  },
  packagePrice: {
    ...typography.label,
    color: colors.text,
  },
  packagePriceActive: {
    color: colors.primary,
  },
  priceInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  addonCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF5FA',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  addonTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  addonPrice: {
    ...typography.label,
    color: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  notesInput: {
    minHeight: 220,
  },
  locationDetails: {
    minHeight: 100,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.white,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  dateFieldFocused: {
    borderColor: colors.primary,
  },
  dateFieldText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  rangeField: {
    flex: 1,
    marginBottom: 0,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthLabel: {
    ...typography.label,
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekDay: {
    width: `${100 / 7}%` as unknown as number,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%` as unknown as number,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInRange: {
    backgroundColor: '#FCE7F3',
    borderRadius: 8,
    width: '100%',
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    width: 36,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 18,
    width: 36,
  },
  dayText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  dayTextDisabled: {
    color: colors.textSecondary,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  clearableField: {
    position: 'relative',
  },
  clearableInput: {
    paddingEnd: 40,
  },
  clearBtn: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  reviewSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reviewLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  reviewValue: {
    ...typography.body,
    color: colors.text,
  },
  reviewMuted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  reviewPackageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipBtn: {
    flex: 1,
  },
  footerHalf: {
    flex: 1.4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  sheetList: {
    maxHeight: 420,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
  },
  serviceRowActive: {
    backgroundColor: '#FCE7F3',
  },
  serviceTextCol: { flex: 1 },
  serviceTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: 2,
  },
  serviceDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
