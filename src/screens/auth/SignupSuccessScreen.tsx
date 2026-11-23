import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { isAccountSuspendedFailure } from '../../lib/authFailure';
import { enterAuthenticatedProduct } from '../../lib/productTree';
import { locationDisplayFields } from '../../data/location/geo';

export default function SignupSuccessScreen({ navigation }: ScreenProps<'SignupSuccess'>) {
  const insets = useSafeAreaInsets();
  const { signUpBasics, accountType, bootstrapSession, completeSignUp } = useAuth();
  const [loading, setLoading] = useState(false);

  const finish = async (goToProfile: boolean) => {
    setLoading(true);
    try {
      const fields =
        signUpBasics?.countryCode && signUpBasics?.locationCode
          ? locationDisplayFields(
              signUpBasics.countryCode,
              signUpBasics.locationCode,
            )
          : null;
      const apiUser = await bootstrapSession({
        accountType: accountType || 'talent',
        displayName: signUpBasics?.name?.trim() || undefined,
        locationCity:
          fields?.locationCity || signUpBasics?.city?.trim() || undefined,
        locationCountry: fields?.locationCountry,
        countryCode: fields?.countryCode ?? signUpBasics?.countryCode,
        locationCode: fields?.locationCode ?? signUpBasics?.locationCode,
        phoneE164: signUpBasics?.phoneE164,
      });
      if (!apiUser.emailVerified) {
        Alert.alert(t('auth.verifyEmailTitle'), t('auth.verifyEmailBody'));
        navigation.navigate('ConfirmCode', {
          email: apiUser.email || signUpBasics?.email || '',
        });
        return;
      }
      completeSignUp();

      if (goToProfile) {
        enterAuthenticatedProduct([
          { name: 'MainTabs' },
          { name: 'Profile' },
        ]);
        return;
      }

      enterAuthenticatedProduct([{ name: 'MainTabs' }]);
    } catch (e) {
      if (isAccountSuspendedFailure(e)) return;
      Alert.alert(t('auth.couldNotFinishSignup'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        <View style={styles.graphic}>
          <View style={styles.circle}>
            <Ionicons name="person-outline" size={72} color={colors.text} />
          </View>
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={28} color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>{t('auth.allSet')}</Text>
        <Text style={styles.subtitle}>{t('auth.allSetBody')}</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          title={t('welcome.start')}
          fullWidth
          onPress={() => finish(false)}
          disabled={loading}
        />
        <Button
          title={t('auth.goToProfile')}
          variant="ghost"
          fullWidth
          onPress={() => finish(true)}
          style={styles.secondary}
          disabled={loading}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  graphic: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
