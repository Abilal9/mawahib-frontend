import React, { useRef, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import TextInput from '../../components/ui/TextInput';
import Button from '../../components/ui/Button';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import { colors, spacing, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { isPasswordValid } from '../../lib/passwordRules';
import { offersAnotherOtherDeviceRetry } from '../../lib/authSessionMutation';
import { PasswordFlowError } from '../../lib/recoveryState';

export default function ChangePasswordScreen({
  navigation,
}: ScreenProps<'ChangePassword'>) {
  const { changePassword, retryOtherDeviceSignOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const saveRef = useRef(false);
  const retryRef = useRef(false);
  const passwordOk = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const promptOtherDeviceRetry = (operation: {
    userId: string;
    sessionId: string;
    generation: number;
  }) => {
    if (!offersAnotherOtherDeviceRetry('initial-failure')) return;
    Alert.alert(t('auth.passwordChanged'), t('auth.otherDevicesUnconfirmed'), [
      {
        text: t('auth.notNow'),
        style: 'cancel',
        onPress: () => navigation.goBack(),
      },
      {
        text: t('common.tryAgain'),
        onPress: () => {
          void retryOtherDevices(operation);
        },
      },
    ]);
  };

  const retryOtherDevices = async (operation: {
    userId: string;
    sessionId: string;
    generation: number;
  }) => {
    if (retryRef.current) return;
    retryRef.current = true;
    try {
      const outcome = await retryOtherDeviceSignOut(operation);
      if (outcome === 'in-flight') return;
      if (outcome === 'revoked') {
        Alert.alert(t('auth.passwordChanged'), t('auth.passwordChangedKept'), [
          { text: t('auth.ok'), onPress: () => navigation.goBack() },
        ]);
        return;
      }
      if (outcome === 'account-changed' || outcome === 'superseded') {
        Alert.alert(t('auth.couldNotSignOutOthers'), t('auth.signInChangedOthers'));
        return;
      }
      if (outcome === 'unavailable') {
        Alert.alert(t('auth.couldNotSignOutOthers'), t('auth.resetInProgressOthers'));
        return;
      }
      if (outcome === 'session-missing') {
        Alert.alert(t('auth.couldNotSignOutOthers'), t('auth.deviceSignedOutOthers'));
        return;
      }
      if (offersAnotherOtherDeviceRetry('retry-finished')) {
        promptOtherDeviceRetry(operation);
        return;
      }
      Alert.alert(t('auth.passwordChanged'), t('auth.otherDevicesUnconfirmed'));
    } finally {
      retryRef.current = false;
    }
  };

  const submit = async () => {
    if (saveRef.current) return;
    if (!currentPassword) {
      Alert.alert(t('auth.currentPasswordRequiredTitle'), t('auth.enterCurrentPassword'));
      return;
    }
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
    try {
      const result = await changePassword(currentPassword, password);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      if (!result.otherSessionsRevoked) {
        promptOtherDeviceRetry({
          userId: result.userId,
          sessionId: result.sessionId,
          generation: result.generation,
        });
        return;
      }
      Alert.alert(t('auth.passwordChanged'), t('auth.passwordChangedKept'), [
        { text: t('auth.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const message =
        err instanceof PasswordFlowError
          ? err.message
          : t('auth.couldNotChangePassword');
      const title =
        err instanceof PasswordFlowError && err.code === 'current-password'
          ? t('auth.currentPassword')
          : err instanceof PasswordFlowError && err.code === 'network'
            ? t('auth.passwordStatusUnknown')
            : t('auth.couldNotChange');
      Alert.alert(title, message);
      // A mismatched reauthentication is removed only when it is still the
      // session this attempt stored. A newer session is left in place.
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={saving}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('auth.changePasswordTitle')}</Text>
        <View style={styles.backButton} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {t('auth.changePasswordIntro')}
          </Text>
          <TextInput
            label={t('auth.currentPassword')}
            placeholder={t('auth.currentPassword')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            enableVisibilityToggle
            textContentType="password"
            editable={!saving}
          />
          <TextInput
            label={t('auth.newPassword')}
            placeholder={t('auth.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            enableVisibilityToggle
            visibilityToggleLabels={{
              show: t('auth.showNewPassword'),
              hide: t('auth.hideNewPassword'),
            }}
            textContentType="newPassword"
            editable={!saving}
          />
          <PasswordRequirements password={password} />
          <TextInput
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPassword')}
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
            title={t('auth.changePassword')}
            onPress={() => {
              void submit();
            }}
            loading={saving}
            disabled={
              saving || !currentPassword || !passwordOk || !passwordsMatch
            }
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
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
});
