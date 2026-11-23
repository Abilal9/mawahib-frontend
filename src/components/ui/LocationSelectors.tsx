import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { placeLabel } from '../../i18n/places';
import { t } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import {
  COUNTRY_CATALOG,
  type CountryCode,
  isValidLocationPair,
  locationsForCountry,
  SUPPORTED_COUNTRY_CODES,
} from '../../data/location/geo';

type Props = {
  countryCode: CountryCode | null;
  locationCode: string | null;
  onCountryChange: (code: CountryCode) => void;
  onLocationChange: (code: string) => void;
  disabled?: boolean;
  countryLabel?: string;
  locationLabel?: string;
  /** Tighter vertical gaps for dense forms (e.g. Edit Profile). */
  compact?: boolean;
};

export default function LocationSelectors({
  countryCode,
  locationCode,
  onCountryChange,
  onLocationChange,
  disabled,
  countryLabel = t('place.country'),
  locationLabel = t('place.city'),
  compact = false,
}: Props) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const country = countryCode ? COUNTRY_CATALOG[countryCode] : null;
  const locations = useMemo(
    () => (countryCode ? locationsForCountry(countryCode) : []),
    [countryCode],
  );
  const selectedLocation = useMemo(
    () => locations.find((l) => l.code === locationCode) ?? null,
    [locations, locationCode],
  );

  const handleCountryChange = (code: CountryCode) => {
    onCountryChange(code);
    if (locationCode && !isValidLocationPair(code, locationCode)) {
      onLocationChange('');
    }
    setCountryOpen(false);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{countryLabel}</Text>
      <TouchableOpacity
        style={[
          styles.selector,
          compact && styles.selectorCompact,
          disabled && styles.selectorDisabled,
        ]}
        onPress={() => !disabled && setCountryOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Text
          style={[
            styles.selectorValue,
            !country && styles.placeholder,
          ]}
        >
          {country ? placeLabel(country.label) : t('place.selectCountry')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text
        style={[
          styles.label,
          styles.locationLabel,
          compact && styles.labelCompact,
          compact && styles.locationLabelCompact,
        ]}
      >
        {locationLabel}
      </Text>
      <TouchableOpacity
        style={[
          styles.selector,
          compact && styles.selectorCompact,
          (disabled || !countryCode) && styles.selectorDisabled,
        ]}
        onPress={() => !disabled && countryCode && setLocationOpen(true)}
        activeOpacity={0.8}
        disabled={disabled || !countryCode}
      >
        <Text
          style={[
            styles.selectorValue,
            !selectedLocation && styles.placeholder,
          ]}
        >
          {selectedLocation
            ? placeLabel(selectedLocation.label)
            : countryCode
              ? t('place.selectCity')
              : t('place.selectCountryFirst')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={countryOpen} animationType="slide" transparent>
        <Pressable style={styles.backdrop} onPress={() => setCountryOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t('place.selectCountry')}</Text>
            <FlatList
              data={SUPPORTED_COUNTRY_CODES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const entry = COUNTRY_CATALOG[item];
                return (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleCountryChange(item)}
                  >
                    <Text style={styles.optionName}>{placeLabel(entry.label)}</Text>
                    {countryCode === item ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={locationOpen} animationType="slide" transparent>
        <Pressable
          style={styles.backdrop}
          onPress={() => setLocationOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t('place.selectCity')}</Text>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onLocationChange(item.code);
                    setLocationOpen(false);
                  }}
                >
                  <Text style={styles.optionName}>{placeLabel(item.label)}</Text>
                  {locationCode === item.code ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  wrapCompact: { marginBottom: spacing.sm },
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  labelCompact: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  locationLabel: {
    marginTop: spacing.md,
  },
  locationLabelCompact: {
    marginTop: spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.white,
  },
  selectorCompact: {
    height: 42,
  },
  selectorDisabled: {
    opacity: 0.55,
  },
  selectorValue: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginEnd: spacing.sm,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionName: { ...typography.body, color: colors.text, flex: 1 },
});
