import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Button from '../ui/Button';
import { colors, radius, spacing, typography } from '../../theme';
import { invalidateReturnIntents } from '../../lib/returnIntent';
import type { SignedOutStackParamList } from '../../navigation/types';

/**
 * Direct Sign In / Create Account entry. Does not stage a participation
 * or Messages/Jobs return intent.
 */
export default function GuestAccountEntry({
  size = 24,
}: {
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<SignedOutStackParamList>>();

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => {
          invalidateReturnIntents();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Account, sign in or create an account"
        hitSlop={8}
        style={styles.iconButton}
      >
        <Ionicons name="person-outline" size={size} color={colors.text} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.copy}>
              Sign in or create an account to message, save, and manage your
              Mawahib profile.
            </Text>
            <View style={styles.actions}>
              <Button
                title="Sign In"
                fullWidth
                onPress={() => {
                  close();
                  navigation.navigate('SignIn');
                }}
              />
              <Button
                title="Create Account"
                variant="ghost"
                fullWidth
                onPress={() => {
                  close();
                  navigation.navigate('Welcome', { step: 1 });
                }}
              />
              <Button
                title="Cancel"
                variant="secondary"
                fullWidth
                onPress={close}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  copy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
  },
});
