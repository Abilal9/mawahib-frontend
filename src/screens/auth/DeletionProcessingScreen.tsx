import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography } from '../../theme';

/** Shown after closure. It has no profile data and no path back into the account. */
export default function DeletionProcessingScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Deletion processing</Text>
      <Text style={styles.body}>
        This account is closed. Profile details are removed, and this device is signed out. Cleanup of the original sign-in and personal files continues separately.
      </Text>
      <Text style={styles.body}>
        Retained messages, images, invoices, and records can still contain historical personal information. This screen does not mean a completion email was sent or read.
      </Text>
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
});
