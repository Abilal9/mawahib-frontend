import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { CountryCode } from 'libphonenumber-js';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import TextInput from '../../components/ui/TextInput';
import Checkbox from '../../components/ui/Checkbox';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import PhoneInputField from '../../components/auth/PhoneInputField';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';
import LocationSelectors from '../../components/ui/LocationSelectors';
import { t } from '../../i18n/runtime';
import { colors, spacing, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { mapAuthError } from '../../lib/authErrors';
import { isAccountSuspendedFailure } from '../../lib/authFailure';
import { isPasswordValid } from '../../lib/passwordRules';
import { armAuthCallback } from '../../lib/authCallbackTransaction';
import {
  DIAL_COUNTRIES,
  getPhoneValidationMessage,
  toE164,
} from '../../lib/phone';
import { hasResumablePendingVerification } from '../../lib/pendingSignup';
import { resolvePostAuthDestination } from '../../lib/postAuthGate';
import { applyPostAuthDestination } from '../../lib/postAuthNavigation';
import {
  locationDisplayFields,
  type CountryCode as GeoCountryCode,
} from '../../data/location/geo';

function splitStoredPhone(phoneE164: string): {
  country: CountryCode;
  national: string;
} | null {
  const match = DIAL_COUNTRIES.find((c) => phoneE164.startsWith(c.dial));
  if (!match) return null;
  return {
    country: match.code,
    national: phoneE164.slice(match.dial.length),
  };
}

export default function SignUpScreen({
  route,
  navigation,
}: ScreenProps<'SignUp'>) {
  const {
    accountType,
    registerWithEmail,
    resumeEmailVerification,
    signUpBasics,
    clearAuthError,
    session,
  } = useAuth();
  const draft =
    route.params?.preserveDraft && signUpBasics ? signUpBasics : null;
  const draftPhone = draft?.phoneE164
    ? splitStoredPhone(draft.phoneE164)
    : null;

  const [firstName, setFirstName] = useState(draft?.firstName || '');
  const [lastName, setLastName] = useState(draft?.lastName || '');
  const [email, setEmail] = useState(draft?.email || '');
  const [country, setCountry] = useState<CountryCode>(
    draftPhone?.country || 'SA',
  );
  const [nationalNumber, setNationalNumber] = useState(
    draftPhone?.national || '',
  );
  const [countryCode, setCountryCode] = useState<GeoCountryCode>(
    (draft?.countryCode as GeoCountryCode) || 'SA',
  );
  const [locationCode, setLocationCode] = useState<string | null>(
    draft?.locationCode || null,
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) return;
    armAuthCallback({ flow: 'signup', email: normalized });
  }, [email]);
  const [submitted, setSubmitted] = useState(false);

  const accountKind = accountType === 'business' ? 'business' : 'talent';
  const passwordOk = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showMismatch =
    (submitted || confirmPassword.length > 0) &&
    password.length > 0 &&
    !passwordsMatch;

  const phoneE164 = useMemo(
    () => toE164(nationalNumber, country),
    [nationalNumber, country],
  );
  const phoneError = useMemo(() => {
    if (!nationalNumber.trim()) {
      return submitted ? 'Phone number is required' : null;
    }
    return getPhoneValidationMessage(nationalNumber, country);
  }, [nationalNumber, country, submitted]);

  const displayName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(' ');

  const locationFields =
    countryCode && locationCode
      ? locationDisplayFields(countryCode, locationCode)
      : null;

  const canSubmit = useMemo(
    () =>
      !loading &&
      agreed &&
      !!accountType &&
      firstName.trim().length > 0 &&
      email.trim().length > 0 &&
      !!phoneE164 &&
      !!locationFields &&
      passwordOk &&
      passwordsMatch,
    [
      agreed,
      accountType,
      email,
      firstName,
      loading,
      locationFields,
      passwordOk,
      passwordsMatch,
      phoneE164,
    ],
  );

  const showSignupRecovery = (
    mode: 'already_verified' | 'ambiguous',
    recoveryEmail: string,
  ) => {
    const message =
      mode === 'already_verified' ? t('auth.emailTakenLogin') : t('auth.emailTakenAmbiguous');

    const buttons: Array<{
      text: string;
      style?: 'cancel' | 'default' | 'destructive';
      onPress?: () => void;
    }> = [
      {
        text: t('auth.login'),
        onPress: () => navigation.navigate('SignIn'),
      },
    ];

    if (mode === 'ambiguous') {
      buttons.push({
        text: t('auth.continueVerification'),
        onPress: () => {
          void (async () => {
            try {
              await resumeEmailVerification(recoveryEmail);
              navigation.navigate('ConfirmCode', { email: recoveryEmail });
            } catch (e) {
              if (hasResumablePendingVerification(recoveryEmail)) {
                Alert.alert(t('auth.verifyPending'), t('auth.verifyPendingShort'), [
                    {
                      text: t('auth.enterCode'),
                      onPress: () =>
                        navigation.navigate('ConfirmCode', {
                          email: recoveryEmail,
                        }),
                    },
                    { text: t('auth.ok'), style: 'cancel' },
                  ],
                );
                return;
              }
              Alert.alert(
                t('auth.unableContinue'),
                `${mapAuthError(e)}\n\n${t('auth.noNewCode')}`,
                [
                  {
                    text: t('auth.login'),
                    onPress: () => navigation.navigate('SignIn'),
                  },
                  { text: t('auth.ok'), style: 'cancel' },
                ],
              );
            }
          })();
        },
      });
    }

    buttons.push({ text: t('auth.changeEmail'), style: 'cancel' });

    Alert.alert(t('auth.unableContinue'), message, buttons);
  };

  const handleSignUp = async () => {
    setSubmitted(true);
    if (!passwordOk) {
      Alert.alert(t('auth.weakPassword'), t('auth.meetPasswordRules'));
      return;
    }
    if (!passwordsMatch) {
      Alert.alert(t('auth.passwordsMismatch'), t('auth.confirmMustMatch'));
      return;
    }
    if (!phoneE164) {
      Alert.alert(
        t('auth.invalidPhone'),
        getPhoneValidationMessage(nationalNumber, country) ||
          t('auth.phoneInvalidInternational'),
      );
      return;
    }
    if (!canSubmit || !accountType || !locationFields) return;
    clearAuthError();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = await registerWithEmail({
        email: normalizedEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: displayName,
        city: locationFields.locationCity,
        countryCode: locationFields.countryCode,
        locationCode: locationFields.locationCode,
        phoneE164,
        accountType,
      });

      if (result.status === 'otp_sent') {
        navigation.navigate('ConfirmCode', { email: normalizedEmail });
        return;
      }
      if (result.status === 'session_ready') {
        const dest = resolvePostAuthDestination({
          flow: 'verify',
          apiUser: result.user,
          session,
          signUpBasics: {
            name: displayName,
            email: normalizedEmail,
            city: locationFields.locationCity,
            countryCode: locationFields.countryCode,
            locationCode: locationFields.locationCode,
            phoneE164,
          },
          pendingEmail: normalizedEmail,
          pendingPhoneE164: phoneE164,
        });
        applyPostAuthDestination(navigation, dest);
        return;
      }
      if (result.status === 'already_verified') {
        showSignupRecovery('already_verified', normalizedEmail);
        return;
      }
      if (result.status === 'ambiguous') {
        showSignupRecovery('ambiguous', normalizedEmail);
        return;
      }
    } catch (e) {
      if (isAccountSuspendedFailure(e)) return;
      Alert.alert(t('auth.signUpFailed'), mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.fixedHeader}>
          <AuthBrandHeader onBack={() => navigation.goBack()} />
        </View>
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <Text style={styles.title}>{t('auth.signUp')}</Text>
          <Text style={styles.subtitle}>
            {accountKind === 'business' ? t('auth.createBusiness') : t('auth.createTalent')}
          </Text>

          <TextInput
            label={t('auth.firstName')}
            placeholder={t('auth.firstNamePlaceholder')}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <TextInput
            label={t('auth.lastName')}
            placeholder={t('auth.lastNamePlaceholder')}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <TextInput
            label={t('auth.email')}
            placeholder={t('auth.enterEmail')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <PhoneInputField
            country={country}
            nationalNumber={nationalNumber}
            onCountryChange={setCountry}
            onNationalNumberChange={setNationalNumber}
            error={phoneError}
          />

          <LocationSelectors
            countryCode={countryCode}
            locationCode={locationCode}
            onCountryChange={(code) => {
              setCountryCode(code);
              if (code === 'SA' || code === 'AE') {
                setCountry(code);
              }
            }}
            onLocationChange={(code) => setLocationCode(code || null)}
          />

          <TextInput
            label={t('auth.password')}
            placeholder={t('auth.createPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            enableVisibilityToggle
            visibilityToggleLabels={{
              show: t('auth.showPassword'),
              hide: t('auth.hidePassword'),
            }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <PasswordRequirements password={password} />

          <TextInput
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmYourPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            enableVisibilityToggle
            visibilityToggleLabels={{
              show: t('auth.showConfirm'),
              hide: t('auth.hideConfirm'),
            }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          {showMismatch ? (
            <Text style={styles.errorText}>{t('auth.passwordsMismatch')}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
          >
            <Checkbox checked={agreed} onPress={() => setAgreed(!agreed)} />
            <Text style={styles.termsText}>
              {t('auth.agreeTerms')}
              <Text style={styles.termsLink}>{t('auth.terms')}</Text>
              {t('auth.and')}
              <Text style={styles.termsLink}>{t('auth.privacy')}</Text>
            </Text>
          </TouchableOpacity>

          <Button
            title={t('auth.signUp')}
            onPress={() => {
              void handleSignUp();
            }}
            fullWidth
            disabled={!canSubmit}
            style={styles.signUpButton}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>{t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fixedHeader: {
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.background,
    zIndex: 1,
  },
  scroll: {
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.screen,
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
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontFamily: typography.label.fontFamily,
  },
  signUpButton: {
    marginBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
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
