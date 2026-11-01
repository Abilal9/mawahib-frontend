import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import GuestAppHeader from '../../components/layout/GuestAppHeader';
import Button from '../../components/ui/Button';
import { listPaddingAboveTabBar } from '../../components/layout/CustomTabBar';
import { colors, spacing, typography } from '../../theme';
import type { SignedOutStackParamList } from '../../navigation/types';

/** Kept for copy reference; Account is a header entry, not a tab. */
export default function GuestAccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<SignedOutStackParamList>>();

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <GuestAppHeader />
      <View
        style={[
          styles.body,
          { paddingBottom: listPaddingAboveTabBar(insets.bottom, spacing.xl) },
        ]}
      >
        <Text style={styles.title}>Account</Text>
        <Text style={styles.copy}>
          Sign in or create an account to message, save, and manage your Mawahib
          profile.
        </Text>
        <View style={styles.actions}>
          <Button
            title="Sign In"
            fullWidth
            onPress={() => navigation.navigate('SignIn')}
          />
          <Button
            title="Create Account"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('Welcome', { step: 1 })}
            style={styles.secondary}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  copy: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
