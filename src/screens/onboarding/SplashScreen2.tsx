import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import SplashBranding from '../../components/onboarding/SplashBranding';
import SplashLoadingDots from '../../components/onboarding/SplashLoadingDots';
import { colors } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { resolveColdStartDestination } from '../../lib/coldStartRoute';
import { resolvePostAuthDestination } from '../../lib/postAuthGate';
import { applyPostAuthDestination } from '../../lib/postAuthNavigation';
import { loadRecoveryState } from '../../lib/recoveryState';
import {
  hasResumablePendingVerification,
  loadPendingSignup,
} from '../../lib/pendingSignup';
import { consumeProcessStart } from '../../lib/processStart';
import { enterSignedOutAt } from '../../lib/productTree';

/**
 * Splash + auth gate:
 * Wait for session restore + Nest /users/me (or bootstrap) before navigating,
 * so the user never briefly lands on Welcome/Main with the wrong identity.
 * Also waits for durable media-cache ownership so Welcome/Main cannot fetch
 * images until the Expo cache is safe. consumeProcessStart() latches splash
 * so warm remounts never replay Splash1/Splash2.
 */
export default function SplashScreen2({ navigation }: ScreenProps<'Splash2'>) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    authLoading,
    isSignedIn,
    apiUser,
    session,
    authError,
    signUpBasics,
    recoveryRestart,
    mediaCacheReady,
  } = useAuth();
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => setMinSplashDone(true), 1200);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  useEffect(() => {
    if (authLoading || !mediaCacheReady || !minSplashDone) return;

    const pending = loadPendingSignup();
    const destination = resolveColdStartDestination({
      recovery: Boolean(loadRecoveryState() || recoveryRestart),
      isSignedIn: Boolean(isSignedIn && apiUser),
      apiUser,
      session,
      authError,
      pendingEmail: pending?.email ?? null,
      pendingResumable: Boolean(
        pending?.email && hasResumablePendingVerification(pending.email),
      ),
    });

    consumeProcessStart();

    if (destination.kind === 'welcome') {
      enterSignedOutAt({ name: 'GuestTabs' });
      return;
    }

    if (destination.kind === 'hydrated' && apiUser) {
      const restored = resolvePostAuthDestination({
        flow: 'restore',
        apiUser,
        session,
        signUpBasics,
        pendingPhoneE164: pending?.phoneE164,
      });
      applyPostAuthDestination(navigation, restored);
      return;
    }

    if (destination.kind === 'confirm-code') {
      enterSignedOutAt({
        name: 'ConfirmCode',
        params: { email: destination.email },
      });
      return;
    }

    enterSignedOutAt({ name: 'SignIn' });
  }, [
    authLoading,
    mediaCacheReady,
    minSplashDone,
    isSignedIn,
    apiUser,
    session,
    authError,
    signUpBasics,
    navigation,
    recoveryRestart,
  ]);

  return (
    <ScreenContainer padded={false} backgroundColor={colors.background} safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <SplashBranding variant="full" />
          <SplashLoadingDots />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
