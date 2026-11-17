import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../theme';
import { ApiError } from '../../lib/apiClient';
import { createClientId } from '../../lib/clientId';
import { markDeletionProcessing } from '../../lib/deletionProcessing';
import { useAuth } from '../../context/AuthContext';
import {
  cancelDeletionRequest,
  confirmDeletion,
  createDeletionRequest,
  loadDeletionRequest,
  type DeletionBlocker,
  type DeletionRequestView,
} from '../../services/deletionApi';

const SUPPORT = 'mailto:support@mawahib.io';
const CONFIRMATION = 'Delete this account';

type DeleteAccountNavigation = NativeStackNavigationProp<{
  Settings: undefined;
  AccountSuspended: undefined;
  DeleteAccount: undefined;
}>;

function resolutionHint(blocker: DeletionBlocker): string {
  if (blocker.code === 'payment_unresolved') {
    return 'Cancel this deletion request, resolve the payment with the existing payment flow, then request deletion again. A payment already in progress still finishes on its own and still blocks deletion.';
  }
  if (blocker.engagementStatus === 'pending_payment') {
    return 'Cancel the accepted work from that request. You can do that while this deletion request is pending.';
  }
  if (blocker.code === 'financial_follow_up_outstanding') {
    return 'Mawahib still has financial follow-up to record. Emailing support does not resolve it.';
  }
  return 'Use the existing actions on that work, or contact support if you cannot. Emailing support does not close the work.';
}

export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation<DeleteAccountNavigation>();
  const [view, setView] = useState<DeletionRequestView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const key = useRef(createClientId());
  const confirmKey = useRef(createClientId());
  const closureReady = view?.closureEnabled === true;
  const canConfirm = closureReady && view?.selfOrigin === true && view.eligibility.status === 'eligible';

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await loadDeletionRequest());
    } catch (err) {
      setView(null);
      setError(err instanceof ApiError ? err.message : 'Deletion status is unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  const requestDeletion = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setView(await createDeletionRequest(key.current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The request was not recorded. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setView(await cancelDeletionRequest());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The cancellation was not recorded. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPermanent = async () => {
    if (busy || confirming || confirmation !== CONFIRMATION) return;
    setBusy(true);
    setConfirming(true);
    setError(null);
    try {
      await confirmDeletion(confirmKey.current, confirmation);
      markDeletionProcessing();
      await signOut('logout');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deletion was not confirmed. Try again.');
      setConfirming(false);
      setBusy(false);
    }
  };

  const goBack = () => {
    if (confirming) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const names = navigation.getState()?.routeNames ?? [];
    if (names.includes('AccountSuspended')) {
      navigation.navigate('AccountSuspended');
      return;
    }
    if (names.includes('Settings')) {
      navigation.navigate('Settings');
    }
  };

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          disabled={confirming}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled: confirming }}
        >
          <Ionicons name="arrow-back" size={24} color={confirming ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete account</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          {closureReady
            ? 'Deleting this account is permanent. It removes your profile, posts, comments, and personal files, and it erases reviews you wrote or received. Shared messages and their images stay for the other person, but those conversations are archived and cannot accept new messages. Invoices, payment history, reports, and dispute records stay under their existing access. Those retained messages, images, invoices, and records can still contain historical personal information.'
            : 'Request account deletion starts a request. It does not delete the account immediately. Final deletion is not available until the server enables it, and this screen does not promise a completion date or an email.'}
        </Text>
        <Text style={styles.body}>
          While a request is pending, new work is restricted. Existing obligations must be resolved before deletion can proceed. You can cancel your own request before irreversible closure. A future deletion is permanent. Shared chats, invoices, payment history, reports, and dispute records can remain.
        </Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {view?.eligibility.status === 'unavailable' ? (
          <Text style={styles.body}>Deletion status is unavailable. Try again. This is not a list of blockers.</Text>
        ) : null}
        {view?.selfOrigin ? <Text style={styles.status}>Deletion requested</Text> : null}
        {view?.staffOrigin ? (
          <Text style={styles.body}>
            Mawahib also has a deletion request on this account. Cancelling your request does not remove that restriction.
          </Text>
        ) : null}
        {view?.eligibility.status === 'blocked' ? view.eligibility.blockers.map((blocker) => (
          <View key={`${blocker.engagementId}:${blocker.code}:${blocker.paymentId ?? ''}`} style={styles.blocker}>
            <Text style={styles.blockerTitle}>{blocker.engagementTitle}</Text>
            <Text style={styles.body}>{blocker.explanation}</Text>
            <Text style={styles.body}>{resolutionHint(blocker)}</Text>
          </View>
        )) : null}
        <Text
          style={styles.link}
          accessibilityRole="link"
          onPress={() => { void Linking.openURL(SUPPORT); }}
        >
          Contact support@mawahib.io
        </Text>
        <Text style={styles.note}>Emailing support does not itself resolve an obligation.</Text>
        {!view?.selfOrigin ? (
          <Button title="Request account deletion" onPress={() => { void requestDeletion(); }} disabled={busy || loading} />
        ) : (
          <Button title="Cancel deletion request" variant="secondary" onPress={() => { void cancelRequest(); }} disabled={busy || loading} />
        )}
        {canConfirm ? (
          <View style={styles.blocker}>
            <Text style={styles.body}>
              Type “Delete this account” to confirm. This cannot be undone, and cancelling the request later will not restore the account.
            </Text>
            <TextInput
              accessibilityLabel="Type Delete this account"
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmation}
              onChangeText={setConfirmation}
              style={styles.input}
            />
            <Button
              title="Delete account permanently"
              onPress={() => { void confirmPermanent(); }}
              disabled={busy || confirmation !== CONFIRMATION}
            />
          </View>
        ) : null}
        {error ? <Button title="Try again" variant="secondary" onPress={() => { setLoading(true); void load(); }} disabled={busy} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl, gap: spacing.md },
  status: { ...typography.h3, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  blocker: { gap: spacing.xs },
  blockerTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  error: { ...typography.body, color: colors.error },
  link: { ...typography.body, color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  note: { ...typography.caption, color: colors.textSecondary },
});
