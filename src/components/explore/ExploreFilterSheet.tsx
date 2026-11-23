import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';
import { placeLabel } from '../../i18n/places';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import LocationSelectors from '../ui/LocationSelectors';
import { ExploreTab } from '../../data/mock/explore';
import {
  COUNTRY_CATALOG,
  CountryCode,
  locationsForCountry,
  SUPPORTED_COUNTRY_CODES,
} from '../../data/location/geo';
import type { ApiEmploymentType } from '../../services/marketplaceApi';

export type TalentExploreSort = 'recommended' | 'top-rated';

export interface ExploreSheetValue {
  locationCode: string | null;
  talentSort: TalentExploreSort;
  employmentType: ApiEmploymentType | null;
}

const JOB_TYPES: { id: ApiEmploymentType; labelKey: MessageKey }[] = [
  { id: 'full_time', labelKey: 'discover.fullTime' },
  { id: 'part_time', labelKey: 'discover.partTime' },
  { id: 'contract', labelKey: 'discover.contract' },
  { id: 'freelance', labelKey: 'discover.freelance' },
  { id: 'gig', labelKey: 'discover.gig' },
];

export function countryForLocationCode(code: string | null): CountryCode | null {
  if (!code) return null;
  for (const country of SUPPORTED_COUNTRY_CODES) {
    if (locationsForCountry(country).some((location) => location.code === code)) {
      return country;
    }
  }
  return null;
}

export function locationLabel(code: string | null): string {
  const country = countryForLocationCode(code);
  if (!country || !code) return t('discover.allCities');
  const city = locationsForCountry(country).find((location) => location.code === code);
  return city
    ? `${placeLabel(city.label)}, ${placeLabel(COUNTRY_CATALOG[country].label)}`
    : t('discover.allCities');
}

interface ExploreFilterSheetProps {
  visible: boolean;
  tab: ExploreTab;
  value: ExploreSheetValue;
  onClose: () => void;
  onApply: (value: ExploreSheetValue) => void;
}

export default function ExploreFilterSheet({
  visible,
  tab,
  value,
  onClose,
  onApply,
}: ExploreFilterSheetProps) {
  const [draft, setDraft] = React.useState(value);
  const [countryCode, setCountryCode] = React.useState<CountryCode | null>(
    countryForLocationCode(value.locationCode),
  );

  React.useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setCountryCode(countryForLocationCode(value.locationCode));
  }, [visible, value]);

  const showCity = tab === 'talents' || tab === 'services';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{t('discover.filters')}</Text>
          <TouchableOpacity
            onPress={() => {
              setDraft({
                locationCode: null,
                talentSort: 'recommended',
                employmentType: null,
              });
              setCountryCode(null);
            }}
          >
            <Text style={styles.reset}>{t('discover.reset')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {tab === 'talents' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('discover.sortBy')}</Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    ['recommended', 'discover.recommended'],
                    ['top-rated', 'discover.topRated'],
                  ] as const
                ).map(([id, label]) => {
                  const selected = draft.talentSort === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setDraft((prev) => ({ ...prev, talentSort: id }))}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('discover.sortBy')}</Text>
              <View style={styles.chipWrap}>
                <View style={[styles.chip, styles.chipSelected]}>
                  <Text style={[styles.chipText, styles.chipTextSelected]}>{t('discover.newest')}</Text>
                </View>
              </View>
            </View>
          )}

          {showCity ? (
            <View style={styles.section}>
              <View style={styles.cityHeader}>
                <Text style={styles.sectionLabel}>
                  {tab === 'services' ? t('discover.providerCity') : t('discover.city')}
                </Text>
                <TouchableOpacity onPress={() => setDraft((prev) => ({ ...prev, locationCode: null }))}>
                  <Text style={styles.reset}>{t('discover.allCities')}</Text>
                </TouchableOpacity>
              </View>
              <LocationSelectors
                countryCode={countryCode}
                locationCode={draft.locationCode}
                onCountryChange={(code) => {
                  setCountryCode(code);
                  setDraft((prev) => ({ ...prev, locationCode: null }));
                }}
                onLocationChange={(code) =>
                  setDraft((prev) => ({ ...prev, locationCode: code }))
                }
                compact
              />
            </View>
          ) : null}

          {tab === 'jobs' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('discover.jobType')}</Text>
              <View style={styles.chipWrap}>
                <TouchableOpacity
                  style={[styles.chip, draft.employmentType == null && styles.chipSelected]}
                  onPress={() => setDraft((prev) => ({ ...prev, employmentType: null }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.employmentType == null && styles.chipTextSelected,
                    ]}
                  >
                    {t('discover.allTypes')}
                  </Text>
                </TouchableOpacity>
                {JOB_TYPES.map((option) => {
                  const selected = draft.employmentType === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() =>
                        setDraft((prev) => ({ ...prev, employmentType: option.id }))
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(option.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
        <TouchableOpacity style={styles.apply} onPress={() => onApply(draft)} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
          <Text style={styles.applyText}>{t('discover.applyFilters')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text },
  reset: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  cityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  apply: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  applyText: { ...typography.body, color: colors.white, fontWeight: '600' },
});
