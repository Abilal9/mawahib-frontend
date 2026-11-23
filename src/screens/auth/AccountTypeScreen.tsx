import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';
import { t } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import { RootStackScreenProps } from '../../navigation/types';
import { useAuth, AccountType } from '../../context/AuthContext';

/** Selected-state accent (border / icon / check) — visual only. */
const SELECTED_PINK = '#F6339A';

const OPTIONS: {
  type: AccountType;
  title: 'auth.talent' | 'auth.business';
  description: 'auth.talentBody' | 'auth.businessBody';
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    type: 'talent',
    title: 'auth.talent',
    description: 'auth.talentBody',
    icon: 'person-outline',
  },
  {
    type: 'business',
    title: 'auth.business',
    description: 'auth.businessBody',
    icon: 'business-outline',
  },
];

export default function AccountTypeScreen({
  navigation,
}: RootStackScreenProps<'AccountType'>) {
  const { accountType, setAccountType } = useAuth();

  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <AuthBrandHeader onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{t('auth.join')}</Text>
        <Text style={styles.subtitle}>{t('auth.chooseUse')}</Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = accountType === option.type;
            return (
              <TouchableOpacity
                key={option.type}
                style={[styles.optionCard, selected && styles.optionCardSelected]}
                onPress={() => setAccountType(option.type)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons
                    name={option.icon}
                    size={28}
                    color={selected ? colors.white : colors.primary}
                  />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t(option.title)}</Text>
                  <Text style={styles.optionDescription}>{t(option.description)}</Text>
                </View>
                {/* Fixed slot so selection never changes card width/height */}
                <View style={styles.checkSlot}>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={SELECTED_PINK}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title={t('common.continue')}
          onPress={() => navigation.navigate('SignUp')}
          disabled={!accountType}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.footerLink}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionCardSelected: {
    borderColor: SELECTED_PINK,
    backgroundColor: '#FFF5FA',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: '#FFF0F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: SELECTED_PINK,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  checkSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
