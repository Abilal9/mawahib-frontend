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
import { t } from '../../i18n/runtime';
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

function categoryProblemLabel(problem: string): string {
  if (problem === 'Invalid category description') return t('work.invalidCategory');
  if (problem === 'Describe this category') return t('work.describeCategory');
  if (problem === 'Use 60 characters or fewer') return t('work.categoryTooLong');
  return problem;
}

function pricingCopy(id: ApiJobPricingType): { label: string; hint: string } {
  if (id === 'fixed') return { label: t('work.fixed'), hint: t('work.fixedHint') };
  if (id === 'range') return { label: t('work.range'), hint: t('work.rangeHint') };
  return { label: t('work.negotiable'), hint: t('work.negotiableHint') };
}

const PRICING_OPTIONS: ApiJobPricingType[] = ['fixed', 'range', 'negotiable'];

function jobTypeLabel(id: (typeof JOB_TYPES)[number]): string {
  if (id === 'full-time') return t('work.typeFull');
  if (id === 'part-time') return t('work.typePart');
  if (id === 'contract') return t('work.typeContract');
  return t('work.typeFreelance');
}

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
      Alert.alert(t('work.addJobTitle'), t('work.enterJobTitle'));
      return;
    }
    if (!categoryId) {
      Alert.alert(t('work.chooseCategory'), t('work.selectCategoryPublish'));
      return;
    }
    const problem = customCategoryError({
      allowsCustomCategory: allowsCustom,
      customCategory,
    });
    if (problem) {
      setCustomError(categoryProblemLabel(problem));
      Alert.alert(t('work.describeCategoryTitle'), categoryProblemLabel(problem));
      return;
    }
    if (!trimmedLocation) {
      Alert.alert(t('work.addLocation'), t('work.enterLocation'));
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
          Alert.alert(t('work.chooseCategory'), e.message, [
            { text: t('work.keepEditing'), style: 'cancel' },
            {
              text: e.nameEn ? t('work.useCategory', { name: e.nameEn }) : t('work.useThatCategory'),
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
          t('work.publishFailed'),
          e instanceof ApiError ? e.message : t('work.pleaseTry'),
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
      Alert.alert(t('work.chooseCategory'), t('work.selectCategoryContinue'));
      return;
    }
    if (step === 1) {
      const problem = customCategoryError({
        allowsCustomCategory: allowsCustom,
        customCategory,
      });
      if (problem) {
        setCustomError(categoryProblemLabel(problem));
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
        <Text style={styles.headerTitle}>{t('work.postJob')}</Text>
        <Text style={styles.stepIndicator}>{step}/{TOTAL_STEPS}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.title}>{t('work.jobDetails')}</Text>
            <TextInput label={t('work.jobTitle')} placeholder={t('work.jobTitlePlaceholder')} value={title} onChangeText={setTitle} />
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
              customLabel={t('work.jobKind')}
              customError={customError}
              onAllowsCustomCategoryChange={setAllowsCustom}
            />
            <Text style={styles.label}>{t('work.jobType')}</Text>
            <View style={styles.typeRow}>
              {JOB_TYPES.map((jobType) => (
                <TouchableOpacity
                  key={jobType}
                  style={[styles.typeChip, type === jobType && styles.typeChipSelected]}
                  onPress={() => setType(jobType)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeText, type === jobType && styles.typeTextSelected]}>
                    {jobTypeLabel(jobType)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>{t('work.locationPay')}</Text>
            <TextInput label={t('work.location')} placeholder={t('work.locationPlaceholder')} value={location} onChangeText={setLocation} />
            <Text style={styles.label}>{t('work.compensation')}</Text>
            <View style={styles.typeRow}>
              {PRICING_OPTIONS.map((optionId) => {
                const option = pricingCopy(optionId);
                return (
                <TouchableOpacity
                  key={optionId}
                  style={[
                    styles.typeChip,
                    pricingType === optionId && styles.typeChipSelected,
                  ]}
                  onPress={() => setPricingType(optionId)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.typeText,
                      pricingType === optionId && styles.typeTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hint}>
              {pricingCopy(pricingType).hint}
              {currency ? t('work.amountsIn', { currency }) : ''}
            </Text>

            {pricingType === 'fixed' ? (
              <MoneyAmountField
                label={t('work.amount')}
                placeholder="0.00"
                currency={currency}
                value={fixedText}
                onChangeText={(t) => setFixedText(normalizeMoneyInputEditing(t))}
                error={
                  fixedText.trim() && fixedAmount === null
                    ? t('work.amountPositive')
                    : undefined
                }
              />
            ) : null}

            {pricingType === 'range' ? (
              <>
                <MoneyAmountField
                  label={t('work.minimum')}
                  placeholder="0.00"
                  currency={currency}
                  value={minText}
                  onChangeText={(t) => setMinText(normalizeMoneyInputEditing(t))}
                  error={
                    minText.trim() && minAmount === null
                      ? t('work.amountPositive')
                      : undefined
                  }
                />
                <MoneyAmountField
                  label={t('work.maximum')}
                  placeholder="0.00"
                  currency={currency}
                  value={maxText}
                  onChangeText={(t) => setMaxText(normalizeMoneyInputEditing(t))}
                  error={
                    maxText.trim() && maxAmount === null
                      ? t('work.amountPositive')
                      : rangeInvalidOrder
                        ? t('work.maxAtLeastMin')
                        : undefined
                  }
                />
              </>
            ) : null}

            <TextInput
              label={t('work.displayLabel')}
              placeholder={t('work.displayLabelPlaceholder')}
              value={salaryLabel}
              onChangeText={setSalaryLabel}
              maxLength={120}
            />
            <Text style={styles.hint}>
              {t('work.displayLabelHint')}
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>{t('work.description')}</Text>
            <TextInput
              label={t('work.jobDescription')}
              placeholder={t('work.jobDescriptionPlaceholder')}
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
          title={step === TOTAL_STEPS ? t('work.publish') : t('work.continue')}
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
        title={t('work.publishTitle')}
        message={t('work.publishBody')}
        confirmLabel={t('work.publish')}
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
