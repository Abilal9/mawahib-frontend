import React from 'react';
import { Modal, Pressable, Text, StyleSheet, View } from 'react-native';
import Button from '../ui/Button';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import { colors, spacing, typography } from '../../theme';
import { useAuthGate } from '../../context/AuthGateContext';
import type { ReturnIntentAction } from '../../lib/returnIntent';

const ACTION_COPY: Record<ReturnIntentAction, MessageKey> = {
  save: 'gate.save',
  like: 'gate.like',
  comment: 'gate.comment',
  connect: 'gate.connect',
  message: 'gate.message',
  apply: 'gate.apply',
  request: 'gate.request',
  create: 'gate.create',
  review: 'gate.review',
  private: 'gate.private',
  messages: 'gate.messages',
  jobs: 'gate.jobs',
};

export default function AuthGateSheet() {
  const { visible, intent, chooseSignIn, chooseCreateAccount, cancel } =
    useAuthGate();
  const subtitle = t(intent?.action ? ACTION_COPY[intent.action] : ACTION_COPY.private);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
    >
      <Pressable style={styles.backdrop} onPress={cancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('gate.title')}</Text>
          <Text style={styles.message}>{subtitle}</Text>
          <View style={styles.actions}>
            <Button title={t('auth.signIn')} fullWidth onPress={chooseSignIn} />
            <Button
              title={t('auth.createAccount')}
              variant="ghost"
              fullWidth
              onPress={chooseCreateAccount}
            />
            <Button
              title={t('common.cancel')}
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
