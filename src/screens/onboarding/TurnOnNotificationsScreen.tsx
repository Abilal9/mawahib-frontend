import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, typography, fontFamily } from '../../theme';
import { t } from '../../i18n/runtime';
import { ScreenProps } from '../../navigation/types';

export default function TurnOnNotificationsScreen({
  navigation,
}: ScreenProps<'TurnOnNotifications'>) {
  return (
    <ScreenContainer>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.illustration}>
          <View style={styles.bellCircle}>
            <Ionicons name="notifications" size={64} color={colors.primary} />
          </View>
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>3</Text>
          </View>
        </View>

        <Text style={styles.title}>{t('auth.stayInLoop')}</Text>
        <Text style={styles.subtitle}>{t('auth.notifyBody')}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.betaCaption}>
          <Text style={styles.betaMark}>{t('auth.beta')}</Text>
          {t('auth.betaBody')}
        </Text>
        <Button
          title={t('auth.enableNotifications')}
          onPress={() => navigation.navigate('SignupSuccess')}
          fullWidth
        />
        <Button
          title={t('auth.maybeLater')}
          variant="ghost"
          onPress={() => navigation.navigate('SignupSuccess')}
          style={styles.laterButton}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  illustration: {
    marginBottom: spacing.xxxl,
    position: 'relative',
  },
  bellCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  bellBadgeText: {
    ...typography.label,
    color: colors.white,
    fontSize: 14,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  betaCaption: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  betaMark: {
    fontFamily: fontFamily.semiBold,
    color: colors.text,
  },
  laterButton: {
    marginTop: spacing.sm,
  },
});
