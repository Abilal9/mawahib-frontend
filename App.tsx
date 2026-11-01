import React, { useEffect } from 'react';
import { Alert, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthGateProvider } from './src/context/AuthGateContext';
import AuthDeepLinkListener from './src/components/auth/AuthDeepLinkListener';
import AuthGateSheet from './src/components/auth/AuthGateSheet';
import AuthTransitionOverlay from './src/components/auth/AuthTransitionOverlay';
import { hasConsumedProcessStart } from './src/lib/processStart';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Media fetch gate (Phase B):
 * - AuthContext.mediaCacheReady is false until durable owner is established.
 * - After process start, RootNavigator unmounts product Image trees while
 *   !ready. Splash2 will not leave splash until ready.
 * - Overlay sits beside NavigationContainer and never unmounts it.
 * - Private providers mount only in the authenticated product tree.
 */

function LogoutFailureNotice() {
  const { logoutFailureNotice, clearLogoutFailureNotice } = useAuth();
  useEffect(() => {
    if (!logoutFailureNotice) return;
    Alert.alert('Still signed in', logoutFailureNotice, [
      { text: 'OK', onPress: clearLogoutFailureNotice },
    ]);
  }, [logoutFailureNotice, clearLogoutFailureNotice]);
  return null;
}

function AppProviders() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsReady = fontsLoaded || fontError != null;
  const { mediaCacheReady, mediaCacheBlocked, retryMediaCache } = useAuth();
  const showOverlay =
    mediaCacheBlocked || (hasConsumedProcessStart() && !mediaCacheReady);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LogoutFailureNotice />
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" />
        <AuthDeepLinkListener />
        <RootNavigator />
      </NavigationContainer>
      <AuthTransitionOverlay
        visible={showOverlay}
        failed={mediaCacheBlocked}
        onRetry={retryMediaCache}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGateProvider>
            <AppProviders />
            <AuthGateSheet />
          </AuthGateProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
