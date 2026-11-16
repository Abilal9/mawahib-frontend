import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';
import Button from '../../components/ui/Button';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

const SUPPORT_MAILTO = 'mailto:support@mawahib.io';

async function openSupportEmail() {
  try {
    await Linking.openURL(SUPPORT_MAILTO);
  } catch {
    Alert.alert(
      'Unable to open your email app. You can contact us at support@mawahib.io.',
    );
  }
}

/**
 * Shown only while the backend reports ACCOUNT_SUSPENDED.
 * Check again re-runs hydration. Log out is local to this device.
 */
export default function AccountSuspendedScreen() {
  const { recheckAccountStatus, signOut, authError } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const checkAgain = async () => {
    if (checking || loggingOut) return;
    setChecking(true);
    try {
      await recheckAccountStatus();
    } finally {
      setChecking(false);
    }
  };

  const logOut = async () => {
    if (checking || loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut('suspensionLogout');
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Could not log out. You are still signed in on this device.',
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <AuthBrandHeader />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Account suspended</Text>
        <Text style={styles.body}>
          Your access to Mawahib has been suspended. If you believe this is an
          error,{' '}
          <Text
            style={styles.supportLink}
            accessibilityRole="link"
            accessibilityLabel="Reach out to support"
            onPress={() => {
              void openSupportEmail();
            }}
          >
            reach out to support
          </Text>
          .
        </Text>
        {authError ? (
          <Text style={styles.error}>
            Mawahib could not check your account just now. Try again.
          </Text>
        ) : null}
        {logoutError ? <Text style={styles.error}>{logoutError}</Text> : null}
        <Button
          title="Check again"
          onPress={() => {
            void checkAgain();
          }}
          loading={checking}
          disabled={checking || loggingOut}
        />
        <Button
          title="Request account deletion"
          variant="outline"
          onPress={() => navigation.navigate('DeleteAccount')}
          disabled={checking || loggingOut}
        />
        <Button
          title="Log out"
          variant="outline"
          onPress={() => {
            void logOut();
          }}
          loading={loggingOut}
          disabled={checking || loggingOut}
          style={styles.logout}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  supportLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  logout: {
    marginTop: spacing.md,
  },
});
