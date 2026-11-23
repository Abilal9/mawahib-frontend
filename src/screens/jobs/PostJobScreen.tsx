import React, { useRef, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import TextInput from '../../components/ui/TextInput';
import MoneyAmountField from '../../components/ui/MoneyAmountField';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { ApiError } from '../../lib/apiClient';
import { useMyProfile } from '../../context/ProfileContext';
import type { ApiJobPricingType } from '../../services/marketplaceApi';
import {
  normalizeMoneyInputEditing,
  parseMoneyInput,
  toCurrencyCode,
} from '../../utils/money';
import { TaxonomyFields } from '../../components/taxonomy/TaxonomyFields';
import {
  customCategoryError,
  displayCustomCategory,
} from '../../domain/offeringTaxonomy';
import type { OfferingSkillChip } from '../../domain/offeringTaxonomy';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'freelance'] as const;
const TOTAL_STEPS = 3;

const PRICING_OPTIONS: { id: ApiJobPricingType; label: string; hint: string }[] = [
  { id: 'fixed', label: 'Fixed', hint: 'A single agreed amount.' },
  { id: 'range', label: 'Range', hint: 'Applicants negotiate within a range.' },
  {
    id: 'negotiable',
    label: 'Negotiable',
    hint: 'No amount yet — agree on one before work starts.',
  },
];

export default function PostJobScreen({ route, navigation }: ScreenProps<'PostJob'>) {
  const { createPostedJob, refresh } = useUserJobs();
  const { user: me } = useMyProfile();
  /** Listing currency is snapshotted server-side from the poster's profile. */
  const currency = toCurrencyCode(me.defaultCurrency);
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);
  const step = route.params?.step ?? 1;
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [allowsCustom, setAllowsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<OfferingSkillChip[]>([]);
  const [type, setType] = useState<typeof JOB_TYPES[number]>('full-time');
  const [location, setLocation] = useState('');
  const [pricingType, setPricingType] = useState<ApiJobPricingType>('negotiable');
  const [fixedText, setFixedText] = useState('');
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [salaryLabel, setSalaryLabel] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const fixedAmount = parseMoneyInput(fixedText);
  const minAmount = parseMoneyInput(minText);
  const maxAmount = parseMoneyInput(maxText);
  const rangeInvalidOrder =
    minAmount !== null && maxAmount !== null && maxAmount < minAmount;
  const pricingValid =
    pricingType === 'negotiable' ||
    (pricingType === 'fixed' && fixedAmount !== null) ||
    (pricingType === 'range' &&
      minAmount !== null &&
      maxAmount !== null &&
      !rangeInvalidOrder);

  const publish = () => {
    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();
    if (!trimmedTitle) {
      Alert.alert('Add a job title', 'Enter a job title before publishing.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Choose a category', 'Select a category before publishing.');
      return;
    }
    const problem = customCategoryError({
      allowsCustomCategory: allowsCustom,
      customCategory,
    });
    if (problem) {
      setCustomError(problem);
      Alert.alert('Describe this category', problem);
      return;
    }
    if (!trimmedLocation) {
      Alert.alert('Add a location', 'Enter a job location before publishing.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    void (async () => {
      try {
        await createPostedJob({
          title: trimmedTitle,
          description,
          location: trimmedLocation,
          pricingType,
          fixedAmount:
            pricingType === 'fixed' ? (fixedAmount ?? undefined) : undefined,
          minAmount:
            pricingType === 'range' ? (minAmount ?? undefined) : undefined,
          maxAmount:
            pricingType === 'range' ? (maxAmount ?? undefined) : undefined,
          salaryLabel,
          jobType: type,
          categoryId,
          customCategory: allowsCustom
            ? displayCustomCategory(customCategory)
            : undefined,
          skillIds: selectedSkills.map((skill) => skill.id),
        });
        showSuccess('jobPosted');
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.code === 'CUSTOM_CATEGORY_MATCHES_CATEGORY' &&
          e.categoryId
        ) {
          Alert.alert('Choose a category', e.message, [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: e.nameEn ? `Use ${e.nameEn}` : 'Use that category',
              onPress: () => {
                setCategoryId(e.categoryId ?? null);
                setCategoryName(e.nameEn ?? null);
                setAllowsCustom(false);
                setCustomCategory('');
                setCustomError(null);
              },
            },
          ]);
          return;
        }
        Alert.alert(
          'Could not publish job',
          e instanceof ApiError ? e.message : 'Please try again.',
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    })();
  };

  const goNext = () => {
    if (submitting) return;
    if (step === 1 && !categoryId) {
      Alert.alert('Choose a category', 'Select a category before continuing.');
      return;
    }
    if (step === 1) {
      const problem = customCategoryError({
        allowsCustomCategory: allowsCustom,
        customCategory,
      });
      if (problem) {
        setCustomError(problem);
        return;
      }
    }
    if (step === 2 && (!location.trim() || !pricingValid)) return;
    if (step < TOTAL_STEPS) {
      navigation.navigate('PostJob', { step: step + 1 });
      return;
    }
    setConfirmPublish(true);
  };

  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step > 1 ? navigation.navigate('PostJob', { step: step - 1 }) : navigation.goBack())}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <Text style={styles.stepIndicator}>{step}/{TOTAL_STEPS}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.title}>Job Details</Text>
            <TextInput label="Job Title" placeholder="e.g. Senior UI Designer" value={title} onChangeText={setTitle} />
            <TaxonomyFields
              categoryId={categoryId}
              categoryName={categoryName}
              onCategoryChange={(category) => {
                setCategoryId(category.id);
                setCategoryName(category.name);
                setAllowsCustom(category.allowsCustomCategory);
                if (!category.allowsCustomCategory) {
                  setCustomCategory('');
                  setCustomError(null);
                }
              }}
              skills={selectedSkills}
              onSkillsChange={setSelectedSkills}
              categoryRequired
              customCategory={customCategory}
              onCustomCategoryChange={(value) => {
                setCustomCategory(value);
                setCustomError(null);
              }}
              customLabel="What type of job is this?"
              customError={customError}
              onAllowsCustomCategoryChange={setAllowsCustom}
            />
            <Text style={styles.label}>Job Type</Text>
            <View style={styles.typeRow}>
              {JOB_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipSelected]}
                  onPress={() => setType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeText, type === t && styles.typeTextSelected]}>
                    {t.replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Location & Compensation</Text>
            <TextInput label="Location" placeholder="City, Country or Remote" value={location} onChangeText={setLocation} />
            <Text style={styles.label}>Compensation</Text>
            <View style={styles.typeRow}>
              {PRICING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.typeChip,
                    pricingType === option.id && styles.typeChipSelected,
                  ]}
                  onPress={() => setPricingType(option.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.typeText,
                      pricingType === option.id && styles.typeTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {PRICING_OPTIONS.find((o) => o.id === pricingType)?.hint}
              {currency ? ` Amounts are in ${currency}.` : ''}
            </Text>

            {pricingType === 'fixed' ? (
              <MoneyAmountField
                label="Amount"
                placeholder="0.00"
                currency={currency}
                value={fixedText}
                onChangeText={(t) => setFixedText(normalizeMoneyInputEditing(t))}
                error={
                  fixedText.trim() && fixedAmount === null
                    ? 'Enter an amount greater than 0'
                    : undefined
                }
              />
            ) : null}

            {pricingType === 'range' ? (
              <>
                <MoneyAmountField
                  label="Minimum"
                  placeholder="0.00"
                  currency={currency}
                  value={minText}
                  onChangeText={(t) => setMinText(normalizeMoneyInputEditing(t))}
                  error={
                    minText.trim() && minAmount === null
                      ? 'Enter an amount greater than 0'
                      : undefined
                  }
                />
                <MoneyAmountField
                  label="Maximum"
                  placeholder="0.00"
                  currency={currency}
                  value={maxText}
                  onChangeText={(t) => setMaxText(normalizeMoneyInputEditing(t))}
                  error={
                    maxText.trim() && maxAmount === null
                      ? 'Enter an amount greater than 0'
                      : rangeInvalidOrder
                        ? 'Maximum must be at least the minimum'
                        : undefined
                  }
                />
              </>
            ) : null}

            <TextInput
              label="Display label (optional)"
              placeholder="e.g. Paid per project"
              value={salaryLabel}
              onChangeText={setSalaryLabel}
              maxLength={120}
            />
            <Text style={styles.hint}>
              Shown on the listing only. The amounts above are what gets
              charged — never this label.
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Description</Text>
            <TextInput
              label="Job Description"
              placeholder="Describe the role, responsibilities, and requirements..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={8}
              style={styles.descriptionInput}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === TOTAL_STEPS ? 'Publish' : 'Continue'}
          onPress={goNext}
          fullWidth
          loading={submitting}
          disabled={
            submitting ||
            (step === 1 && !title.trim()) ||
            (step === 2 && (!location.trim() || !pricingValid))
          }
        />
      </View>

      <ConfirmActionModal
        visible={confirmPublish}
        title="Publish?"
        message="Your job listing will go live for applicants."
        confirmLabel="Publish"
        busy={submitting}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => {
          setConfirmPublish(false);
          publish();
        }}
      />

      <ActionBusyOverlay visible={submitting} message="Publishing job…" />
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  stepIndicator: { ...typography.bodySmall, color: colors.textSecondary },
  progressBar: { height: 4, backgroundColor: colors.borderLight, borderRadius: 2, marginBottom: spacing.xl, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  content: { paddingBottom: spacing.xl },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xl },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  typeChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
  },
  typeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { ...typography.bodySmall, color: colors.text, textTransform: 'capitalize' },
  typeTextSelected: { color: colors.white },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  descriptionInput: { minHeight: 160, textAlignVertical: 'top' },
  footer: { paddingBottom: spacing.lg },
});
