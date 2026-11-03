import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import TextInput from '../../components/ui/TextInput';
import Button from '../../components/ui/Button';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';
import { colors, spacing, typography } from '../../theme';
import { RootStackScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { mapAuthError } from '../../lib/authErrors';
import { showsProfileRetry } from '../../lib/coldStartRoute';
import { hasResumablePendingVerification } from '../../lib/pendingSignup';
import { resolvePostAuthDestination } from '../../lib/postAuthGate';
import { applyPostAuthDestination } from '../../lib/postAuthNavigation';
import { isAccountSuspendedFailure, isAuthFailure } from '../../lib/authFailure';
import { getSignedOutReason } from '../../lib/signedOutReason';
import { invalidateReturnIntents } from '../../lib/returnIntent';
import { shouldInvalidateIntentOnAuthRemove } from '../../lib/authIntentCancellation';
import {
  canDismissOptionalAuth,
  shouldPreventOptionalAuthRemove,
} from '../../lib/signedOutBranchEntry';
import { loadRecoveryState } from '../../lib/recoveryState';

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = message.toLowerCase();
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code.toLowerCase()
      : '';
  return (
    code === 'over_email_send_rate_limit' ||
    code === 'over_sms_send_rate_limit' ||
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('over_sms_send_rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  );
}

export default function SignInScreen({ navigation, route }: RootStackScreenProps<'SignIn'>) {
  const {
    signInWithEmail,
    resumeEmailVerification,
    bootstrapSession,
    authError,
    clearAuthError,
    session,
    apiUser,
    recovery,
    discardInterruptedRecovery,
    signedOutReason,
    continueAsGuest,
  } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !loading && !recovery;
  const backendUnavailable = showsProfileRetry({
    session,
    apiUser,
    authError,
    recovery: Boolean(recovery),
  });

  const sessionExpired =
    signedOutReason === 'expired' || route.params?.notice === 'session-expired';
  const navState = navigation.getState();
  const canDismiss =
    !loading &&
    canDismissOptionalAuth({
      recoveryLocked: Boolean(recovery || loadRecoveryState()),
      reason: signedOutReason,
      routes: navState?.routes ?? [],
      index: navState?.index ?? 0,
      hasLiveUnappliedSession: Boolean(session) && !apiUser,
    });

  useEffect(() => {
    if (route.params?.notice !== 'password-updated') return;
    Alert.alert(
      'Password changed',
      'Sign in with your new password. Other devices may keep access for up to an hour.',
    );
    navigation.setParams({ notice: undefined });
  }, [navigation, route.params?.notice]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: canDismiss });
  }, [navigation, canDismiss]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const action = event.data.action as {
        type: string;
        payload?: { count?: number };
      };
      if (
        action.type !== 'GO_BACK' &&
        action.type !== 'POP' &&
        action.type !== 'POP_TO_TOP'
      ) {
        return;
      }
      if (
        shouldPreventOptionalAuthRemove({
          loading,
          recoveryLocked: Boolean(recovery || loadRecoveryState()),
          reason: getSignedOutReason(),
          hasLiveUnappliedSession: Boolean(session) && !apiUser,
        })
      ) {
        event.preventDefault();
        return;
      }
      const state = navigation.getState();
      if (
        shouldInvalidateIntentOnAuthRemove({
          actionType: action.type,
          routes: state?.routes ?? [],
          index: state?.index ?? 0,
          count: action.payload?.count,
        })
      ) {
        invalidateReturnIntents();
      }
    });
    return unsubscribe;
  }, [navigation, loading, recovery, session, apiUser]);

  const handleDiscardRecovery = async () => {
    setDiscarding(true);
    try {
      const ok = await discardInterruptedRecovery();
      if (!ok) {
        Alert.alert(
          'Still signed in',
          'Could not sign this device out. Try again.',
        );
      }
    } finally {
      setDiscarding(false);
    }
  };

  const handleRetryBackend = async () => {
    clearAuthError();
    setRetrying(true);
    try {
      const user = await bootstrapSession();
      const dest = resolvePostAuthDestination({
        flow: 'signin',
        apiUser: user,
        session,
      });
      applyPostAuthDestination(navigation, dest);
    } catch (e) {
      if (isAccountSuspendedFailure(e)) return;
      Alert.alert(
        'Profile still unavailable',
        isAuthFailure(e)
          ? e.message
          : mapAuthError(e, authError || undefined),
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleLogIn = async () => {
    if (!canSubmit || recovery) return;
    clearAuthError();
    setLoading(true);
    try {
      const apiUser = await signInWithEmail(email, password);
      const dest = resolvePostAuthDestination({
        flow: 'signin',
        apiUser,
        session: null,
      });
      applyPostAuthDestination(navigation, dest);
    } catch (e) {
      if (isAccountSuspendedFailure(e)) return;
      const needsVerify =
        e instanceof Error &&
        ((e as Error & { needsEmailConfirmation?: boolean }).needsEmailConfirmation ||
          (e as Error & { code?: string }).code === 'email_not_confirmed' ||
          /email not confirmed|email_not_confirmed/i.test(e.message));

      if (needsVerify) {
        Alert.alert(
          'Email verification required',
          'Your account exists but email is not verified yet. Resend a code to continue.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resend code',
              onPress: () => {
                void (async () => {
                  const normalized = email.trim().toLowerCase();
                  try {
                    await resumeEmailVerification(normalized);
                    navigation.navigate('ConfirmCode', { email: normalized });
                  } catch (resendErr) {
                    const resumable = hasResumablePendingVerification(normalized);
                    if (resumable) {
                      // Legitimate prior OTP send — restore ConfirmCode without claiming a new send.
                      Alert.alert(
                        'Verification still pending',
                        isRateLimitError(resendErr)
                          ? 'A new code could not be sent yet (too many requests). If you still have a recent code, you can enter it now. Otherwise wait a minute and resend from the next screen.'
                          : `${mapAuthError(resendErr)}\n\nIf you still have a recent code, you can enter it now.`,
                        [
                          {
                            text: 'Enter code',
                            onPress: () =>
                              navigation.navigate('ConfirmCode', {
                                email: normalized,
                              }),
                          },
                          { text: 'Cancel', style: 'cancel' },
                        ],
                      );
                      return;
                    }

                    Alert.alert(
                      isRateLimitError(resendErr)
                        ? 'Please wait before resending'
                        : 'Unable to send code',
                      isRateLimitError(resendErr)
                        ? 'Too many requests. Wait a minute, then try Resend code again. We did not send a new verification code.'
                        : mapAuthError(resendErr),
                      [{ text: 'OK', style: 'cancel' }],
                    );
                  }
                })();
              },
            },
          ],
        );
        return;
      }
      Alert.alert('Sign in failed', mapAuthError(e, authError || undefined));
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
          <AuthBrandHeader
            onBack={canDismiss ? () => navigation.goBack() : undefined}
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Log In</Text>
          <Text style={styles.subtitle}>
            {sessionExpired
              ? 'Your session ended. Sign in again to continue.'
              : 'Welcome back! Please enter your details.'}
          </Text>

          {recovery ? (
            <View style={styles.backendBanner}>
              <Text style={styles.backendBannerTitle}>Password reset interrupted</Text>
              <Text style={styles.backendBannerBody}>
                This device still needs to sign out before you can continue. You
                are not signed in to Mawahib.
              </Text>
              <Button
                title={discarding ? 'Signing out…' : 'Sign out and continue'}
                onPress={() => {
                  void handleDiscardRecovery();
                }}
                loading={discarding}
                disabled={discarding}
              />
            </View>
          ) : null}

          {backendUnavailable ? (
            <View style={styles.backendBanner}>
              <Text style={styles.backendBannerTitle}>Signed in, profile unavailable</Text>
              <Text style={styles.backendBannerBody}>
                Your Supabase session is active, but Mawahib could not load your
                profile. This is not an OTP failure. Retry when the backend is
                reachable.
              </Text>
              <Button
                title={retrying ? 'Retrying…' : 'Retry profile load'}
                onPress={() => {
                  void handleRetryBackend();
                }}
                disabled={retrying}
              />
            </View>
          ) : null}

          <TextInput
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotWrap}
            accessibilityRole="button"
          >
            <Text style={styles.footerLink}>Forgot password?</Text>
          </TouchableOpacity>

          <Button title="Log In" onPress={handleLogIn} disabled={!canSubmit || Boolean(recovery)} />
          {sessionExpired && !recovery ? (
            <Button
              title="Continue as Guest"
              variant="outline"
              onPress={() => {
                void continueAsGuest();
              }}
              style={styles.guestContinue}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Mawahib? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('AccountType')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 0,
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
  backendBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: spacing.sm,
  },
  backendBannerTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  backendBannerBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.bodyMedium, color: colors.primary },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  guestContinue: {
    marginTop: spacing.md,
  },
});
