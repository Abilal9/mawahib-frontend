import React from 'react';
import { Modal, Pressable, Text, StyleSheet, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, typography } from '../../theme';
import { useAuthGate } from '../../context/AuthGateContext';
import type { ReturnIntentAction } from '../../lib/returnIntent';

const ACTION_COPY: Record<ReturnIntentAction, string> = {
  save: 'Save this after you sign in.',
  like: 'Like this post after you sign in.',
  comment: 'Comment after you sign in.',
  connect: 'Connect after you sign in.',
  message: 'Send a message after you sign in.',
  apply: 'Apply after you sign in.',
  request: 'Request this service after you sign in.',
  create: 'Create a post, story, or job after you sign in.',
  review: 'Write a review after you sign in.',
  private: 'Continue after you sign in.',
  messages: 'Sign in to open your messages. Browsing public profiles stays available.',
  jobs: 'Sign in to manage your work and applications. Public job listings stay on Home and Explore.',
};

export default function AuthGateSheet() {
  const { visible, intent, chooseSignIn, chooseCreateAccount, cancel } =
    useAuthGate();
  const subtitle = intent?.action ? ACTION_COPY[intent.action] : ACTION_COPY.private;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
    >
      <Pressable style={styles.backdrop} onPress={cancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Sign in to continue</Text>
          <Text style={styles.message}>{subtitle}</Text>
          <View style={styles.actions}>
            <Button title="Sign In" fullWidth onPress={chooseSignIn} />
            <Button
              title="Create Account"
              variant="ghost"
              fullWidth
              onPress={chooseCreateAccount}
            />
            <Button
              title="Cancel"
              variant="secondary"
              fullWidth
              onPress={cancel}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.sm,
  },
});
