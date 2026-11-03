import React, { useRef, useState } from 'react';
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
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { isPasswordValid } from '../../lib/passwordRules';
import { offersAnotherOtherDeviceRetry } from '../../lib/authSessionMutation';
import { PasswordFlowError } from '../../lib/recoveryState';

const PASSWORD_CHANGED_TITLE = 'Password changed';
const OTHER_DEVICES_SIGNED_OUT =
  'This device stays signed in. Other devices may keep access for up to an hour before they need to sign in again.';
const OTHER_DEVICES_UNCONFIRMED =
  'Your password was changed, but we could not confirm that your other devices were signed out.';

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
    Alert.alert(PASSWORD_CHANGED_TITLE, OTHER_DEVICES_UNCONFIRMED, [
      {
        text: 'Not now',
        style: 'cancel',
        onPress: () => navigation.goBack(),
      },
      {
        text: 'Try again',
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
        Alert.alert(PASSWORD_CHANGED_TITLE, OTHER_DEVICES_SIGNED_OUT, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      if (outcome === 'account-changed' || outcome === 'superseded') {
        Alert.alert(
          'Could not sign out other devices',
          'This sign-in changed, so other devices were not signed out.',
        );
        return;
      }
      if (outcome === 'unavailable') {
        Alert.alert(
          'Could not sign out other devices',
          'Password reset is in progress, so other devices were not signed out.',
        );
        return;
      }
      if (outcome === 'session-missing') {
        Alert.alert(
          'Could not sign out other devices',
          'This device is no longer signed in, so other devices could not be signed out from here.',
        );
        return;
      }
      if (offersAnotherOtherDeviceRetry('retry-finished')) {
        promptOtherDeviceRetry(operation);
        return;
      }
      Alert.alert(PASSWORD_CHANGED_TITLE, OTHER_DEVICES_UNCONFIRMED);
    } finally {
      retryRef.current = false;
    }
  };

  const submit = async () => {
    if (saveRef.current) return;
    if (!currentPassword) {
      Alert.alert('Current password required', 'Enter your current password.');
      return;
    }
    if (!passwordOk) {
      Alert.alert(
        'Weak password',
        'Meet all password requirements before continuing.',
      );
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Passwords do not match', 'Confirm password must match.');
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
      Alert.alert(PASSWORD_CHANGED_TITLE, OTHER_DEVICES_SIGNED_OUT, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const message =
        err instanceof PasswordFlowError
          ? err.message
          : 'Could not change your password. Please try again.';
      const title =
        err instanceof PasswordFlowError && err.code === 'current-password'
          ? 'Current password'
          : err instanceof PasswordFlowError && err.code === 'network'
            ? 'Password status unknown'
            : 'Could not change password';
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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.backButton} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Enter your current password, then choose a new one. This device stays signed in.
          </Text>
          <TextInput
            label="Current password"
            placeholder="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            enableVisibilityToggle
            textContentType="password"
            editable={!saving}
          />
          <TextInput
            label="New password"
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            enableVisibilityToggle
            visibilityToggleLabels={{
              show: 'Show new password',
              hide: 'Hide new password',
            }}
            textContentType="newPassword"
            editable={!saving}
          />
          <PasswordRequirements password={password} />
          <TextInput
            label="Confirm new password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            enableVisibilityToggle
            visibilityToggleLabels={{
              show: 'Show confirm password',
              hide: 'Hide confirm password',
            }}
            textContentType="newPassword"
            editable={!saving}
          />
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <Text style={styles.errorText}>Passwords do not match</Text>
          ) : null}
          <Button
            title="Change password"
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
