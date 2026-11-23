import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import TextInput from '../../components/ui/TextInput';
import Button from '../../components/ui/Button';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';
import { colors, spacing, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { isPasswordValid } from '../../lib/passwordRules';
import {
  loadRecoveryState,
  PasswordFlowError,
} from '../../lib/recoveryState';

export default function ResetPasswordScreen({
  navigation,
}: ScreenProps<'ResetPassword'>) {
  const { completePasswordReset, discardInterruptedRecovery, recovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [needsSignOut, setNeedsSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const saveRef = useRef(false);
  const signOutRef = useRef(false);
  const passwordOk = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    const state = loadRecoveryState();
    if (state?.phase === 'recovery-session' && state.userId) return;
    void (async () => {
      await discardInterruptedRecovery();
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
    })();
  }, [discardInterruptedRecovery, navigation]);

  const finishSignOut = async () => {
    if (signOutRef.current) return;
    signOutRef.current = true;
    setSigningOut(true);
    try {
      const ok = await discardInterruptedRecovery();
      if (!ok) {
        Alert.alert(t('auth.passwordChanged'), t('auth.cleanupNotSignedOut'));
        return;
      }
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'SignIn',
            params: {
              email: recovery?.email,
            },
          },
        ],
      });
    } finally {
      signOutRef.current = false;
      setSigningOut(false);
    }
  };

  const cancel = async () => {
    if (saveRef.current || signOutRef.current) return;
    const ok = await discardInterruptedRecovery();
    if (!ok) {
      Alert.alert(t('auth.stillLocked'), t('auth.couldNotSignOutNotSignedIn'));
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  };

  const submit = async () => {
    if (saveRef.current || needsSignOut) return;
    if (!passwordOk) {
      Alert.alert(t('auth.weakPassword'), t('auth.meetPasswordRules'));
      return;
    }
    if (!passwordsMatch) {
      Alert.alert(t('auth.passwordsMismatch'), t('auth.confirmMustMatch'));
      return;
    }
    saveRef.current = true;
    setSaving(true);
    const emailForSignIn = loadRecoveryState()?.email ?? recovery?.email;
    try {
      const result = await completePasswordReset(password);
      if (result.status === 'local-signed-out') {
        Alert.alert(t('auth.passwordChanged'), t('auth.cleanupSignedOut'));
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'SignIn',
              params: {
                email: emailForSignIn,
              },
            },
          ],
        });
        return;
      }
      if (result.status === 'sign-out-failed') {
        setNeedsSignOut(true);
        Alert.alert(t('auth.passwordChanged'), t('auth.cleanupNotSignedOut'));
        return;
      }
      if (result.status === 'rejected') {
        Alert.alert(t('auth.couldNotReset'), t('auth.requestNewCode'));
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'SignIn',
            params: {
              email: emailForSignIn,
              notice: 'password-updated',
            },
          },
        ],
      });
    } catch (err) {
      const message =
        err instanceof PasswordFlowError
          ? err.message
          : t('auth.couldNotUpdatePassword');
      const title =
        err instanceof PasswordFlowError && err.code === 'network'
          ? t('auth.passwordStatusUnknown')
          : t('auth.couldNotUpdate');
      Alert.alert(title, message);
    } finally {
      saveRef.current = false;
      setSaving(false);
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
          <AuthBrandHeader />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.chooseNewPassword')}</Text>
          <Text style={styles.subtitle}>
            {needsSignOut ? t('auth.resetSignOutBody') : t('auth.resetDoesNotOpen')}
          </Text>

          {needsSignOut ? (
            <Button
              title={t('auth.signOutContinue')}
              onPress={() => {
                void finishSignOut();
              }}
              loading={signingOut}
              disabled={signingOut}
            />
          ) : (
            <>
              <TextInput
                label={t('auth.newPassword')}
                placeholder={t('auth.createPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                enableVisibilityToggle
                textContentType="newPassword"
                editable={!saving}
              />
              <PasswordRequirements password={password} />
              <TextInput
                label={t('auth.confirmPasswordLabel')}
                placeholder={t('auth.confirmYourPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                enableVisibilityToggle
                visibilityToggleLabels={{
                  show: t('auth.showConfirm'),
                  hide: t('auth.hideConfirm'),
                }}
                textContentType="newPassword"
                editable={!saving}
              />
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <Text style={styles.errorText}>{t('auth.passwordsMismatch')}</Text>
              ) : null}
              <Button
                title={t('auth.updatePassword')}
                onPress={() => {
                  void submit();
                }}
                loading={saving}
                disabled={saving || !passwordOk || !passwordsMatch}
              />
              <Button
                title={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  void cancel();
                }}
                disabled={saving}
                style={styles.cancel}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fixedHeader: {
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
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
  cancel: { marginTop: spacing.sm },
});
