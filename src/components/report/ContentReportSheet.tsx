import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '../ui/Button';
import SuccessConfirmationModal from '../ui/SuccessConfirmationModal';
import {
  REPORT_REASONS,
  reportCanSend,
  reportResultMessage,
  submitContentReport,
  type ContentReportTarget,
  type ReportReasonId,
} from '../../lib/contentReports';
import { colors, spacing, typography } from '../../theme';

export default function ContentReportSheet({
  visible,
  title,
  targetType,
  targetId,
  onClose,
}: {
  visible: boolean;
  title: string;
  targetType: ContentReportTarget;
  targetId: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReasonId | null>(null);
  const [details, setDetails] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState('Report sent');
  const [successMessage, setSuccessMessage] = useState('');

  const close = () => {
    if (busy) return;
    setReason(null);
    setDetails('');
    setNotice(null);
    onClose();
  };

  const send = async () => {
    if (busy || !targetId || !reportCanSend(reason, details) || !reason) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await submitContentReport({
        targetType,
        targetId,
        reason,
        details,
      });
      const message = reportResultMessage(result, targetType);
      if (message.confirmed || result.outcome === 'unavailable' || result.outcome === 'own') {
        setReason(null);
        setDetails('');
        setSuccessTitle(message.title);
        setSuccessMessage(message.message);
        onClose();
        setSuccessOpen(true);
      } else {
        setNotice(message.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>Choose a reason. Add details if you want.</Text>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  disabled={busy}
                  onPress={() => setReason(item.id)}
                  style={[styles.reason, reason === item.id && styles.reasonOn]}
                >
                  <Text style={styles.reasonText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              multiline
              value={details}
              onChangeText={setDetails}
              editable={!busy}
              maxLength={1000}
            />
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <View style={styles.actions}>
              <Button title="Cancel" variant="secondary" style={styles.half} disabled={busy} onPress={close} />
              <Button title="Send Report" style={styles.half} disabled={busy || !reportCanSend(reason, details)} onPress={() => void send()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <SuccessConfirmationModal
        visible={successOpen}
        title={successTitle}
        message={successMessage}
        onDone={() => setSuccessOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14, 36, 58, 0.4)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.screen },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  description: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  reason: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  reasonOn: { borderColor: colors.primary, backgroundColor: '#FDE7F2' },
  reasonText: { ...typography.caption, color: colors.text },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, padding: 12, color: colors.text, textAlignVertical: 'top' },
  notice: { ...typography.caption, color: colors.error, marginTop: 8 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  half: { flex: 1 },
});
