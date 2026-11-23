import React, { useMemo, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { t } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { appEnv } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { mapAuthError } from '../../lib/authErrors';

/**
 * Post-email verification: show email status + optional phone verify / skip.
 * Also used as a recovery hub when email is not yet verified.
 */
export default function VerifyAccountScreen({
  route,
  navigation,
}: ScreenProps<'VerifyAccount'>) {
  const { sendPhoneOtp, session, apiUser, clearAuthError } = useAuth();
  const email = route.params.email;
  const phoneE164 = route.params.phoneE164;
  const phoneEnabled = appEnv.phoneAuthEnabled;
  const [sending, setSending] = useState(false);

  const emailVerified = Boolean(
    apiUser?.emailVerified ||
      session?.user?.email_confirmed_at ||
      session?.user?.confirmed_at,
  );
  const phoneVerified = Boolean(apiUser?.phoneVerified);

  const phoneSubtitle = useMemo(() => {
    if (phoneVerified) return t('auth.verified');
    if (!phoneEnabled) return t('auth.phoneOptionalLater');
    if (!emailVerified || !session) return t('auth.verifyEmailThenPhone');
    return phoneE164;
  }, [phoneEnabled, session, phoneE164, phoneVerified, emailVerified]);

  const continueAfterPhoneChoice = () => {
    if (!emailVerified) {
      navigation.navigate('ConfirmCode', { email });
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'TurnOnNotifications' }],
    });
  };

  const onEmail = () => {
    navigation.navigate('ConfirmCode', { email });
  };

  const onPhone = async () => {
    if (!phoneEnabled) {
      Alert.alert(t('auth.smsUnavailableTitle'), t('auth.smsUnavailableBody'));
      return;
    }
    if (!emailVerified || !session) {
      Alert.alert(t('auth.verifyEmailFirst'), t('auth.verifyEmailFirstBody'));
      return;
    }
    clearAuthError();
    setSending(true);
    try {
      await sendPhoneOtp(phoneE164);
      navigation.navigate('ConfirmCode', { phone: phoneE164 });
    } catch (e) {
      Alert.alert(t('auth.couldNotSendSms'), mapAuthError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name={backIcon()} size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>
        {emailVerified ? t('auth.almostDone') : t('auth.verifyAccount')}
      </Text>
      <Text style={styles.subtitle}>
        {emailVerified ? t('auth.emailVerifiedOptional') : t('auth.emailRequiredContinue')}
      </Text>

      <View style={styles.option}>
        <View style={styles.optionIcon}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.optionBody}>
          <Text style={styles.optionTitle}>{t('auth.email')}</Text>
          <Text style={styles.optionMeta}>{email}</Text>
        </View>
        {emailVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
            <Text style={styles.verifiedText}>{t('auth.verified')}</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={onEmail} activeOpacity={0.85}>
            <Text style={styles.actionLink}>{t('auth.verify')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.option, !phoneEnabled && styles.optionDisabled]}>
        <View style={styles.optionIcon}>
          <Ionicons
            name="phone-portrait-outline"
            size={22}
            color={phoneEnabled ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.optionBody}>
          <Text
            style={[
              styles.optionTitle,
              !phoneEnabled && styles.optionTitleMuted,
            ]}
          >
            {t('auth.phone')}
          </Text>
          <Text style={styles.optionMeta}>{phoneSubtitle}</Text>
        </View>
        {phoneVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
            <Text style={styles.verifiedText}>{t('auth.verified')}</Text>
          </View>
        ) : phoneEnabled && emailVerified ? (
          sending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <TouchableOpacity
              onPress={() => {
                void onPhone();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionLink}>{t('auth.verify')}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textSecondary}
          />
        )}
      </View>

      {emailVerified ? (
        <View style={styles.footerActions}>
          <Button
            title={t('auth.skipForNow')}
            variant="ghost"
            fullWidth
            onPress={continueAfterPhoneChoice}
          />
          <Button
            title={t('common.continue')}
            fullWidth
            onPress={continueAfterPhoneChoice}
          />
        </View>
      ) : null}

      <Text style={styles.hint}>
        {t('auth.phoneOptionalHint')}
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  optionDisabled: {
    backgroundColor: colors.background,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: { flex: 1 },
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  optionTitleMuted: {
    color: colors.textSecondary,
  },
  optionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.white,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  footerActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
