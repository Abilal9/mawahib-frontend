import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Button from '../../components/ui/Button';
import { clearDeletionProcessing } from '../../lib/deletionProcessing';
import { enterSignedOutAt } from '../../lib/productTree';
import type { SignedOutStackParamList } from '../../navigation/types';
import { t } from '../../i18n/runtime';
import { colors, spacing, typography } from '../../theme';

type LeaveTarget = {
  name: keyof Pick<SignedOutStackParamList, 'GuestTabs' | 'SignIn' | 'Welcome'>;
  params?: SignedOutStackParamList['Welcome'];
};

function leaveDeletionProcessing(target: LeaveTarget) {
  enterSignedOutAt(target);
  clearDeletionProcessing();
}

/** Shown after closure. It has no profile data and no path back into the account. */
export default function DeletionProcessingScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Text style={styles.title}>{t('auth.deletionTitle')}</Text>
      <Text style={styles.body}>{t('auth.deletionBody')}</Text>
      <Text style={styles.body}>{t('auth.deletionRetained')}</Text>
      <View style={styles.actions}>
        <Button
          title={t('tab.home')}
          fullWidth
          onPress={() => leaveDeletionProcessing({ name: 'GuestTabs' })}
        />
        <Button
          title={t('auth.signIn')}
          variant="outline"
          fullWidth
          onPress={() => leaveDeletionProcessing({ name: 'SignIn' })}
        />
        <Button
          title={t('auth.createAccount')}
          variant="outline"
          fullWidth
          onPress={() => leaveDeletionProcessing({ name: 'Welcome', params: { step: 1 } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F9FB',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
