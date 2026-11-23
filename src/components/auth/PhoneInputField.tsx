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
import { t } from '../../i18n/runtime';
import { placeLabel } from '../../i18n/places';
import { colors, spacing, radius, typography } from '../../theme';
import {
  DIAL_COUNTRIES,
  type DialCountry,
  formatNationalHint,
  maxNationalDigits,
  sanitizeNationalInput,
} from '../../lib/phone';
import type { CountryCode } from 'libphonenumber-js';
import TextInput from '../ui/TextInput';

type Props = {
  country: CountryCode;
  nationalNumber: string;
  onCountryChange: (code: CountryCode) => void;
  onNationalNumberChange: (value: string) => void;
  error?: string | null;
};

export default function PhoneInputField({
  country,
  nationalNumber,
  onCountryChange,
  onNationalNumberChange,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => DIAL_COUNTRIES.find((c) => c.code === country) ?? DIAL_COUNTRIES[0],
    [country],
  );
  const maxLen = maxNationalDigits(country);

  const handleChange = (value: string) => {
    onNationalNumberChange(sanitizeNationalInput(value, country));
  };

  const handleCountryChange = (code: CountryCode) => {
    onCountryChange(code);
    // Re-sanitize against the new country's max (e.g. leaving SA).
    onNationalNumberChange(sanitizeNationalInput(nationalNumber, code));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('auth.phoneNumber')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.countryBtn}
          onPress={() => setOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.flag}>{selected.flag}</Text>
          <Text style={styles.dial}>{selected.dial}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.numberWrap}>
          <TextInput
            placeholder={formatNationalHint(country)}
            value={nationalNumber}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={maxLen}
            containerStyle={styles.inputContainer}
          />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t('place.selectCountry')}</Text>
            <FlatList
              data={DIAL_COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }: { item: DialCountry }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => handleCountryChange(item.code)}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{placeLabel(item.name)}</Text>
                  <Text style={styles.dial}>{item.dial}</Text>
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
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm,
    height: 48,
    backgroundColor: colors.white,
  },
  numberWrap: { flex: 1 },
  inputContainer: { marginBottom: 0 },
  flag: { fontSize: 18 },
  dial: { ...typography.bodyMedium, color: colors.text },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
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
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  countryName: { ...typography.body, color: colors.text, flex: 1 },
});
