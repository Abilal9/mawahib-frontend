import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { ScreenProps } from '../../navigation/types';
import { colors, spacing, radius, typography } from '../../theme';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import type { AccountType } from '../../context/AuthContext';
import { useLocalSignOutPrompt } from '../../components/auth/LocalSignOutConfirm';
import type { ApiUser } from '../../services/authApi';
import {
  COUNTRY_CATALOG,
  currencyForCountry,
  isSupportedCurrency,
  normalizeCountryCode,
} from '../../data/location/geo';

type VerificationState = 'verified' | 'unverified' | 'unknown';

type SettingsRow = {
  label: string;
  value?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  status?: VerificationState;
};

function verificationState(value: boolean | undefined): VerificationState {
  if (value === true) return 'verified';
  if (value === false) return 'unverified';
  return 'unknown';
}

const CURRENCY_NOTE =
  'Used for new jobs and services based on your profile country. Existing work keeps its original currency.';

function accountTypeLabel(accountType: AccountType | undefined): string {
  if (accountType === 'talent') return 'Talent';
  if (accountType === 'business') return 'Business';
  return 'Not available';
}

function countryLabel(user: ApiUser): string {
  const code = normalizeCountryCode(user.countryCode ?? null);
  if (code) return COUNTRY_CATALOG[code].label;
  const saved = user.locationCountry?.trim();
  return saved || 'Not added';
}

function currencyContext(user: ApiUser): { value: string; note: string } {
  const country = normalizeCountryCode(user.countryCode ?? null);
  const stored = isSupportedCurrency(user.defaultCurrency)
    ? user.defaultCurrency.trim().toUpperCase()
    : null;
  const derived = country ? currencyForCountry(country) : null;
  const currency = stored ?? derived;
  if (!currency) {
    return {
      value: 'Not available',
      note: 'Add a country in Edit Profile. Until then, new jobs and services use SAR. Existing work keeps its original currency.',
    };
  }
  return { value: currency, note: CURRENCY_NOTE };
}

function usernameLabel(username: string | undefined): string {
  const trimmed = username?.trim();
  if (!trimmed) return 'Not available';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function appVersionLabel(): string {
  const version = Constants.expoConfig?.version?.trim();
  return version ? `Mawahib v${version}` : 'Mawahib';
}

export default function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { apiUser, refreshMe } = useAuth();
  const signOutPrompt = useLocalSignOutPrompt();

  useFocusEffect(
    useCallback(() => {
      void refreshMe().catch(() => undefined);
    }, [refreshMe]),
  );

  const email = apiUser?.email?.trim() || '';
  const phone = apiUser?.phoneE164?.trim() || '';
  const currency = apiUser ? currencyContext(apiUser) : null;

  const shortcutRows: SettingsRow[] = [
    {
      label: 'Edit Profile',
      icon: 'person-outline',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      label: 'Calendar',
      icon: 'calendar-outline',
      onPress: () => navigation.navigate('Calendar'),
    },
  ];

  const accountRows: SettingsRow[] = [
    {
      label: 'Change Password',
      icon: 'lock-closed-outline',
      onPress: () => navigation.navigate('ChangePassword'),
    },
    {
      label: 'Email',
      value: email || 'Not available',
      status: email ? verificationState(apiUser?.emailVerified) : undefined,
    },
    {
      label: 'Phone',
      value: phone || 'Not added',
      status: phone ? verificationState(apiUser?.phoneVerified) : undefined,
    },
    { label: 'Username', value: usernameLabel(apiUser?.username) },
    { label: 'Account type', value: accountTypeLabel(apiUser?.accountType) },
    {
      label: 'Delete account',
      icon: 'trash-outline',
      onPress: () => navigation.navigate('DeleteAccount'),
    },
    {
      label: 'Country',
      value: apiUser ? countryLabel(apiUser) : 'Not added',
    },
    {
      label: 'Currency',
      value: currency?.value ?? 'Not available',
    },
  ];

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Section title="Shortcuts" rows={shortcutRows} />
        <Section title="Account" rows={accountRows} note={currency?.note} />
        <Section title="About" rows={[{ label: 'Version', value: appVersionLabel() }]} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.8}
            disabled={signOutPrompt.busy}
            onPress={signOutPrompt.request}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {signOutPrompt.dialog}
    </ScreenContainer>
  );
}

function VerificationMark({ state }: { state: VerificationState }) {
  if (state === 'unknown') {
    return <Text style={styles.statusUnknown}>Not available</Text>;
  }
  const verified = state === 'verified';
  return (
    <View style={styles.statusRow}>
      <Ionicons
        name={verified ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        size={14}
        color={verified ? colors.success : colors.warning}
      />
      <Text style={verified ? styles.statusVerified : styles.statusUnverified}>
        {verified ? 'Verified' : 'Not verified'}
      </Text>
    </View>
  );
}

function Section({
  title,
  rows,
  note,
}: {
  title: string;
  rows: SettingsRow[];
  note?: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {rows.map((row, index) => {
          const content = (
            <>
              {row.icon ? (
                <Ionicons name={row.icon} size={22} color={colors.textSecondary} />
              ) : null}
              <Text style={[styles.rowLabel, row.value ? styles.rowLabelFixed : styles.rowLabelFill]}>
                {row.label}
              </Text>
              {row.value ? (
                <View style={styles.valueBlock}>
                  <Text style={styles.rowValue} numberOfLines={2}>
                    {row.value}
                  </Text>
                  {row.status ? <VerificationMark state={row.status} /> : null}
                </View>
              ) : null}
              {row.onPress ? (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              ) : null}
            </>
          );
          if (row.onPress) {
            return (
              <TouchableOpacity
                key={row.label}
                style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
                activeOpacity={0.7}
                onPress={row.onPress}
              >
                {content}
              </TouchableOpacity>
            );
          }
          return (
            <View
              key={row.label}
              style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
            >
              {content}
            </View>
          );
        })}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { ...typography.body, color: colors.text },
  rowLabelFill: { flex: 1 },
  rowLabelFixed: { flexShrink: 0 },
  valueBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusVerified: { ...typography.caption, color: colors.success },
  statusUnverified: { ...typography.caption, color: colors.warning },
  statusUnknown: { ...typography.caption, color: colors.textSecondary },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  logoutText: { ...typography.label, color: colors.error },
});
