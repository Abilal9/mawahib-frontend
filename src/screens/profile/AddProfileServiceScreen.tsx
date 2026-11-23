import React, { useMemo, useRef, useState } from 'react';
import { chevronBackIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import CurrencyIcon from '../../components/ui/CurrencyIcon';
import ReorderableMediaGrid from '../../components/ui/ReorderableMediaGrid';
import { colors, spacing, radius, typography } from '../../theme';
import { useMyProfile } from '../../context/ProfileContext';
import { ServicePackage } from '../../data/types';
import { ScreenProps } from '../../navigation/types';
import { pickAndUploadImage } from '../../lib/uploadMedia';
import {
  buildServicePackages,
  requiredTitle,
} from '../../domain/truthfulFacts';
import {
  moneyAmountDraftFromLabel,
  normalizeMoneyInputEditing,
  parseMoneyInput,
} from '../../utils/money';
import { TaxonomyFields } from '../../components/taxonomy/TaxonomyFields';
import {
  customCategoryError,
  offeringTaxonomyPayload,
} from '../../domain/offeringTaxonomy';
import { ApiError } from '../../lib/apiClient';

/**
 * Multi-step wizard to create or edit a profile service.
 *
 * Steps: (1) name / description / media → (2) Basic/Standard/Premium packages →
 * (3) optional add-ons → (4) review & publish into Nest services API.
 * Pass `serviceId` in route params to edit an existing service instead of creating one.
 */
const TOTAL_STEPS = 4;
const MAX_MEDIA = 10;

type MediaItem = { uri: string; mediaAssetId: string };

type PackageName = ServicePackage['name'];
type PackageDraft = { price: string; delivery: string; features: string[] };

const EMPTY_PACKAGE: PackageDraft = { price: '', delivery: '', features: [] };

const PACKAGE_TABS: PackageName[] = ['Basic', 'Standard', 'Premium'];

function hasPositivePrice(value: string): boolean {
  const amount = parseMoneyInput(value);
  return amount !== null && amount > 0;
}

/** Empty input is missing. A typed 0 is a real free price, not a missing one. */
function hasEnteredPrice(value: string): boolean {
  return parseMoneyInput(value, { requirePositive: false }) !== null;
}

/** Digits-only price → locale-formatted display string (currency icon is rendered separately). */
function formatMoneyDigits(value: string) {
  const amount = parseMoneyInput(value, { requirePositive: false });
  if (amount === null) return '0';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Pull a numeric draft value out of a stored price label like "SAR 900.00". */
function amountDraftFromLabel(label: string) {
  return moneyAmountDraftFromLabel(label);
}

/** Keep TextInput state as a numeric string (preserves at most two decimals). */
function normalizePriceInput(text: string) {
  return normalizeMoneyInputEditing(text);
}

/** Hydrate the three package drafts when opening the wizard in edit mode. */
function packagesFromService(service: {
  packages: ServicePackage[];
}): Record<PackageName, PackageDraft> {
  const next: Record<PackageName, PackageDraft> = {
    Basic: { ...EMPTY_PACKAGE },
    Standard: { ...EMPTY_PACKAGE },
    Premium: { ...EMPTY_PACKAGE },
  };
  for (const pkg of service.packages) {
    next[pkg.name] = {
      price:
        typeof pkg.price === 'number' && Number.isFinite(pkg.price)
          ? Number.isInteger(pkg.price)
            ? String(pkg.price)
            : pkg.price.toFixed(2)
          : amountDraftFromLabel(pkg.priceLabel),
      delivery: pkg.delivery,
      features: [...pkg.includes],
    };
  }
  return next;
}

export default function AddProfileServiceScreen({
  navigation,
  route,
}: ScreenProps<'AddProfileService'>) {
  const insets = useSafeAreaInsets();
  const { addService, updateService, content, user } = useMyProfile();
  const editingId = route.params?.serviceId;
  const existing = editingId
    ? content.services.find((s) => s.id === editingId)
    : undefined;
  const isEditing = Boolean(existing);
  // Create → owner's current default. Edit → frozen offering snapshot.
  const serviceCurrency =
    (existing?.currency === 'AED' || existing?.currency === 'SAR'
      ? existing.currency
      : null) ??
    (user.defaultCurrency === 'AED' || user.defaultCurrency === 'SAR'
      ? user.defaultCurrency
      : null);

  const [step, setStep] = useState(1);
  const [mediaDragging, setMediaDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Step 1
  const [name, setName] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [categoryName, setCategoryName] = useState<string | null>(
    existing?.categoryName ?? null,
  );
  const [selectedSkills, setSelectedSkills] = useState(
    existing?.taxonomySkills ?? [],
  );
  const [customCategory, setCustomCategory] = useState(
    existing?.customCategory ?? '',
  );
  const [allowsCustom, setAllowsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [hydratedServiceId, setHydratedServiceId] = useState<string | null>(
    existing?.id ?? null,
  );
  if (existing && hydratedServiceId !== existing.id) {
    setHydratedServiceId(existing.id);
    setName(existing.title ?? '');
    setDescription(existing.description ?? '');
    setCategoryId(existing.categoryId ?? null);
    setCategoryName(existing.categoryName ?? null);
    setSelectedSkills(existing.taxonomySkills ?? []);
    setCustomCategory(existing.customCategory ?? '');
    setAllowsCustom(false);
  }
  const initialCategoryId = existing?.categoryId ?? null;
  const initialSkillIds = (existing?.taxonomySkills ?? []).map((skill) => skill.id);
  const initialCustomCategory = existing?.customCategory ?? null;
  const [media, setMedia] = useState<MediaItem[]>(() => {
    if (!existing) return [];
    const ids = existing.mediaAssetIds ?? [];
    return existing.images
      .map((uri, index) =>
        ids[index] ? { uri, mediaAssetId: ids[index] } : null,
      )
      .filter((item): item is MediaItem => Boolean(item));
  });

  // Step 2
  const [activePackage, setActivePackage] = useState<PackageName>('Basic');
  const [packages, setPackages] = useState<Record<PackageName, PackageDraft>>(
    existing ? packagesFromService(existing) : {
      Basic: { ...EMPTY_PACKAGE },
      Standard: { ...EMPTY_PACKAGE },
      Premium: { ...EMPTY_PACKAGE },
    }
  );
  const [featureDraft, setFeatureDraft] = useState('');

  // Step 3
  const [addonTitle, setAddonTitle] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addons, setAddons] = useState<
    { id: string; title: string; price: string }[]
  >(() =>
    (existing?.addons ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      price:
        typeof a.price === 'number' && Number.isFinite(a.price)
          ? Number.isInteger(a.price)
            ? String(a.price)
            : a.price.toFixed(2)
          : amountDraftFromLabel(a.priceLabel),
    })),
  );

  const currentPkg = packages[activePackage];
  const basicReady =
    hasEnteredPrice(packages.Basic.price) &&
    packages.Basic.delivery.trim().length > 0 &&
    packages.Basic.features.some((feature) => feature.trim().length > 0);

  const canNextStep1 = name.trim().length > 0;
  const canNextStep2 = basicReady;
  const canAddFeature = featureDraft.trim().length > 0;
  const canAddAddon =
    addonTitle.trim().length > 0 && hasPositivePrice(addonPrice);

  const updatePackage = (patch: Partial<PackageDraft>) => {
    setPackages((prev) => ({
      ...prev,
      [activePackage]: { ...prev[activePackage], ...patch },
    }));
  };

  const addMedia = async () => {
    if (media.length >= MAX_MEDIA || uploading) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const uploaded = await pickAndUploadImage('service', setUploadProgress);
      if (!uploaded) return;
      setMedia((prev) => [
        ...prev,
        { uri: uploaded.remoteUrl, mediaAssetId: uploaded.mediaAssetId },
      ]);
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload image',
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const addFeature = () => {
    if (!canAddFeature) return;
    updatePackage({ features: [...currentPkg.features, featureDraft.trim()] });
    setFeatureDraft('');
  };

  const removeFeature = (index: number) => {
    updatePackage({
      features: currentPkg.features.filter((_, i) => i !== index),
    });
  };

  const addAddon = () => {
    if (!canAddAddon) return;
    setAddons((prev) => [
      ...prev,
      {
        id: `ao-${Date.now()}`,
        title: addonTitle.trim(),
        price: addonPrice,
      },
    ]);
    setAddonTitle('');
    setAddonPrice('');
  };

  // Back within the wizard first; only leave the screen from step 1.
  const goBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    navigation.goBack();
  };

  const goNext = () => {
    if (savingRef.current) return;
    if (step === 1 && !isEditing && !categoryId) {
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
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    publish();
  };

  /**
   * Map wizard drafts → Nest service payload and persist.
   * Basic is always included; Standard/Premium only if the user filled any field.
   */
  const persistService = async () => {
    if (media.length === 0) {
      throw new Error('Upload at least one image for this service');
    }

    const builtPackages = buildServicePackages(
      PACKAGE_TABS.map((key) => ({
        name: key,
        price: packages[key].price,
        delivery: packages[key].delivery,
        features: packages[key].features,
        required: key === 'Basic',
      })),
      (value) => parseMoneyInput(value, { requirePositive: false }),
    );

    const problem = customCategoryError({
      allowsCustomCategory: allowsCustom,
      customCategory,
    });
    if (problem) {
      setCustomError(problem);
      throw new Error(problem);
    }
    const taxonomy = offeringTaxonomyPayload({
      creating: !isEditing,
      categoryId,
      initialCategoryId,
      skillIds: selectedSkills.map((skill) => skill.id),
      initialSkillIds,
      allowsCustomCategory: allowsCustom,
      customCategory,
      initialCustomCategory,
    });
    if (!isEditing && !taxonomy.categoryId) {
      throw new Error('Choose a category');
    }
    const payload = {
      title: requiredTitle(name, 'service name'),
      description: description.trim(),
      mediaAssetIds: media.map((m) => m.mediaAssetId),
      packages: builtPackages,
      ...taxonomy,
      addons: addons.map((a) => {
        const price = parseMoneyInput(a.price, { requirePositive: false });
        if (price === null || !a.title.trim()) {
          throw new Error('Enter a name and price for each add-on.');
        }
        return { title: a.title.trim(), price };
      }),
    };

    if (isEditing && existing) {
      await updateService(existing.id, payload);
      return;
    }
    if (!taxonomy.categoryId) throw new Error('Choose a category');
    await addService({ ...payload, categoryId: taxonomy.categoryId });
  };

  const publish = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    void (async () => {
      try {
        await persistService();
        navigation.goBack();
      } catch (err) {
        if (
          err instanceof ApiError &&
          err.code === 'CUSTOM_CATEGORY_MATCHES_CATEGORY' &&
          err.categoryId
        ) {
          Alert.alert('Choose a category', err.message, [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: err.nameEn ? `Use ${err.nameEn}` : 'Use that category',
              onPress: () => {
                setCategoryId(err.categoryId ?? null);
                setCategoryName(err.nameEn ?? null);
                setAllowsCustom(false);
                setCustomCategory('');
                setCustomError(null);
              },
            },
          ]);
          return;
        }
        Alert.alert(
          'Save failed',
          err instanceof Error ? err.message : 'Could not save service',
        );
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    })();
  };

  /** Save only when the offering has a real title and a complete Basic package. */
  const saveProgress = () => {
    if (!canSave) return;
    publish();
  };

  const canSave = name.trim().length > 0 && basicReady;

  const footerPrimaryDisabled =
    (step === 1 && !canNextStep1) || (step === 2 && !canNextStep2);

  const packageSummary = useMemo(() => {
    return PACKAGE_TABS.map((key) => {
      const p = packages[key];
      const hasContent =
        hasEnteredPrice(p.price) ||
        !!p.delivery.trim() ||
        p.features.length > 0;
      if (key !== 'Basic' && !hasContent) return null;
      return {
        key,
        price: hasEnteredPrice(p.price) ? formatMoneyDigits(p.price) : '',
        delivery: p.delivery.trim(),
        featureCount: p.features.length,
      };
    }).filter(Boolean) as {
      key: PackageName;
      price: string;
      delivery: string;
      featureCount: number;
    }[];
  }, [packages]);

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
          scrollEnabled={!mediaDragging}
        >
          {step === 1 ? (
            <>
              <Text style={styles.pageTitle}>Service Details</Text>

              <Text style={styles.label}>
                Service Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Professional Logo Design"
                placeholderTextColor={colors.textSecondary}
              />

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
                categoryRequired={!isEditing}
                customCategory={customCategory}
                onCustomCategoryChange={(value) => {
                  setCustomCategory(value);
                  setCustomError(null);
                }}
                customLabel="What type of service is this?"
                customError={customError}
                onAllowsCustomCategoryChange={setAllowsCustom}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your service"
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.mediaHeader}>
                <Text style={styles.labelInline}>Media Items</Text>
                <Text style={styles.mediaCount}>
                  {media.length}/{MAX_MEDIA}
                </Text>
              </View>
              <Text style={styles.mediaHint}>
                First image is the cover. Hold the grip to drag and reorder.
              </Text>
              <ReorderableMediaGrid
                uris={media.map((m) => m.uri)}
                onChange={(uris) => {
                  const byUri = new Map(media.map((m) => [m.uri, m]));
                  setMedia(
                    uris
                      .map((uri) => byUri.get(uri))
                      .filter((item): item is MediaItem => Boolean(item)),
                  );
                }}
                maxItems={MAX_MEDIA}
                onAdd={() => {
                  void addMedia();
                }}
                videoIndex={media.length > 4 ? 4 : undefined}
                onDraggingChange={setMediaDragging}
              />
              {(uploading || uploadProgress != null) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.mediaHint}>
                    Uploading
                    {uploadProgress != null
                      ? ` ${Math.round(uploadProgress * 100)}%`
                      : '…'}
                  </Text>
                </View>
              )}
              {saving ? (
                <Text style={styles.mediaHint}>Saving service…</Text>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.pageTitle}>Service Packages</Text>
              <Text style={styles.subtitle}>
                Basic is required. Standard & Premium are optional.
              </Text>

              <View style={styles.packageTabs}>
                {PACKAGE_TABS.map((tab) => {
                  const active = tab === activePackage;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.packageTab, active && styles.packageTabActive]}
                      onPress={() => setActivePackage(tab)}
                      activeOpacity={0.85}
                    >
                      {active ? (
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      ) : null}
                      <Text
                        style={[styles.packageTabText, active && styles.packageTabTextActive]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Price</Text>
              <View style={styles.priceRow}>
                <CurrencyIcon size={18} color={colors.primary} currency={serviceCurrency} location={serviceCurrency ? null : undefined} style={styles.currencyIcon} />
                <TextInput
                  style={styles.priceInput}
                  value={currentPkg.price}
                  onChangeText={(text) =>
                    updatePackage({ price: normalizePriceInput(text) })
                  }
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
              </View>

              <Text style={styles.label}>Delivery time</Text>
              <TextInput
                style={styles.input}
                value={currentPkg.delivery}
                onChangeText={(text) => updatePackage({ delivery: text })}
                placeholder="e.g. 10 days"
                placeholderTextColor={colors.textSecondary}
              />

              <View style={styles.featuresHeader}>
                <Text style={styles.labelInline}>Features</Text>
                {currentPkg.features.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{currentPkg.features.length}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.featureComposer}>
                <TextInput
                  style={[styles.input, styles.featureInput]}
                  value={featureDraft}
                  onChangeText={setFeatureDraft}
                  placeholder="What's included in this package?"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.addPill, !canAddFeature && styles.addPillDisabled]}
                  onPress={addFeature}
                  disabled={!canAddFeature}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addPillText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {currentPkg.features.map((feature, index) => (
                <View key={`${feature}-${index}`} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={styles.featureText}>{feature}</Text>
                  <TouchableOpacity onPress={() => removeFeature(index)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.pageTitle}>Add-Ons</Text>
              <Text style={styles.subtitle}>
                Add optional extras to increase your service value.
              </Text>

              <View style={styles.addonComposer}>
                {addons.length > 0 ? (
                  <View style={styles.addonComposerBadge}>
                    <Text style={styles.countBadgeText}>{addons.length}</Text>
                  </View>
                ) : null}
                <Text style={styles.label}>Add-on Title</Text>
                <TextInput
                  style={styles.input}
                  value={addonTitle}
                  onChangeText={setAddonTitle}
                  placeholder="e.g. 2 revisions included"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.label}>Add-On Price</Text>
                <View style={styles.priceRow}>
                  <CurrencyIcon size={18} color={colors.primary} currency={serviceCurrency} location={serviceCurrency ? null : undefined} style={styles.currencyIcon} />
                  <TextInput
                    style={styles.priceInput}
                    value={addonPrice}
                    onChangeText={(text) => setAddonPrice(normalizePriceInput(text))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.addPill, styles.addPillWide, !canAddAddon && styles.addPillDisabled]}
                  onPress={addAddon}
                  disabled={!canAddAddon}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addPillText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {addons.map((addon) => (
                <View key={addon.id} style={styles.addonCard}>
                  <View style={styles.flex}>
                    <Text style={styles.addonTitle}>{addon.title}</Text>
                    <View style={styles.priceInline}>
                      <CurrencyIcon size={14} color={colors.primary} currency={serviceCurrency} location={serviceCurrency ? null : undefined} />
                      <Text style={styles.addonPrice}>
                        {formatMoneyDigits(addon.price)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAddons((prev) => prev.filter((a) => a.id !== addon.id))}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.pageTitle}>Review & Send</Text>

              <View style={styles.reviewSection}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>Service Details</Text>
                  <TouchableOpacity onPress={() => setStep(1)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.reviewName}>{name.trim()}</Text>
                {description.trim() ? (
                  <Text style={styles.reviewDesc} numberOfLines={3}>
                    {description.trim()}
                  </Text>
                ) : null}
                {media.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reviewMediaRow}
                  >
                    {media.map((item, i) => (
                      <Image
                        key={`${item.mediaAssetId}-${i}`}
                        source={toImageSource(item.uri)}
                        style={styles.reviewThumb}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <View style={styles.reviewSection}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>Service Packages</Text>
                  <TouchableOpacity onPress={() => setStep(2)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                {packageSummary.map((line) => (
                  <View key={line.key} style={styles.reviewLineRow}>
                    <Text style={styles.reviewLine}>{line.key} : • </Text>
                    <CurrencyIcon size={13} color={colors.primary} currency={serviceCurrency} location={serviceCurrency ? null : undefined} />
                    <Text style={styles.reviewLine}>
                      {' '}
                      {line.price} • {line.delivery} • {line.featureCount} Feature
                      {line.featureCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.reviewSection}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>Add-Ons</Text>
                  <TouchableOpacity onPress={() => setStep(3)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                {addons.length === 0 ? (
                  <Text style={styles.reviewDesc}>No add-ons</Text>
                ) : (
                  addons.map((a) => (
                    <View key={a.id} style={styles.reviewLineRow}>
                      <Text style={styles.reviewLine}>• {a.title} </Text>
                      <CurrencyIcon size={13} color={colors.primary} currency={serviceCurrency} location={serviceCurrency ? null : undefined} />
                      <Text style={styles.reviewLine}>
                        {' '}
                        {formatMoneyDigits(a.price)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {step === 1 ? (
            <View style={styles.footerStack}>
              <Button
                title="Next"
                fullWidth
                disabled={footerPrimaryDisabled}
                onPress={goNext}
              />
              <Button
                title="Save"
                variant="outline"
                fullWidth
                disabled={!canSave || saving}
                onPress={saveProgress}
              />
            </View>
          ) : step === 4 ? (
            <Button
              title={isEditing ? 'Update Service' : 'Publish Service'}
              fullWidth
              disabled={!canSave || saving}
              onPress={publish}
            />
          ) : (
            <View style={styles.footerStack}>
              <View style={styles.footerRow}>
                <Button
                  title="Skip"
                  variant="outline"
                  style={styles.skipBtn}
                  textStyle={{ color: colors.textSecondary }}
                  disabled={footerPrimaryDisabled}
                  onPress={goNext}
                />
                <Button
                  title="Next"
                  style={styles.footerHalf}
                  disabled={footerPrimaryDisabled}
                  onPress={goNext}
                />
              </View>
              <Button
                title="Save"
                variant="ghost"
                fullWidth
                disabled={!canSave || saving}
                onPress={saveProgress}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  labelInline: {
    ...typography.label,
    color: colors.text,
  },
  required: { color: colors.error },
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
  multiline: { minHeight: 110 },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  mediaCount: { ...typography.caption, color: colors.textSecondary },
  mediaHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  packageTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  packageTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  packageTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  packageTabText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  packageTabTextActive: { color: colors.white },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  currencyIcon: {},
  priceInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  reviewLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  priceInput: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
    minWidth: 96,
    textAlign: 'center',
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 11 },
  featureComposer: { gap: spacing.sm },
  featureInput: { marginBottom: 0 },
  addPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addPillWide: { alignSelf: 'stretch', alignItems: 'center', marginTop: spacing.md },
  addPillDisabled: { backgroundColor: colors.primaryLight, opacity: 0.55 },
  addPillText: { ...typography.button, color: colors.white, fontSize: 14 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  featureText: { ...typography.body, color: colors.text, flex: 1 },
  addonComposer: {
    borderWidth: 1.5,
    borderColor: '#BFD7ED',
    borderStyle: 'dashed',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  addonComposerBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 1,
  },
  addonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  addonTitle: { ...typography.label, color: colors.text },
  addonPrice: { ...typography.caption, color: colors.textSecondary },
  reviewSection: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewTitle: { ...typography.label, color: colors.text },
  reviewName: { ...typography.bodyMedium, color: colors.text, fontWeight: '600' },
  reviewDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  reviewLine: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  reviewMediaRow: { gap: spacing.sm, marginTop: spacing.md },
  reviewThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerStack: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerHalf: { flex: 1 },
  skipBtn: {
    flex: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
});
