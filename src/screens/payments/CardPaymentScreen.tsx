import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import TextInput from '../../components/ui/TextInput';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import MoneyAmount from '../../components/ui/MoneyAmount';
import PaymentResult from '../../components/payments/PaymentResult';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps, RootStackParamList } from '../../navigation/types';
import { usePayableEngagement } from '../../hooks/usePayableEngagement';
import { useEngagementPayment } from '../../hooks/useEngagementPayment';
import { returnToRequestAfterPayment } from '../../utils/paymentNavigation';
import { PAYMENTS_MOCK_MODE } from '../../config/payments';
import {
  CardFormErrors,
  cardFormHasErrors,
  cvvDigits,
  detectCardBrand,
  formatCardNumber,
  formatExpiryInput,
  mapCardToMockToken,
  validateCardForm,
} from '../../utils/cardValidation';

const NO_ERRORS: CardFormErrors = {
  cardholder: null,
  number: null,
  expiry: null,
  cvv: null,
};

/**
 * Card entry. The cardholder / number / expiry / CVV are validated on-device,
 * mapped to a MOCK token, and discarded — they are never sent to the API,
 * logged or stored. See `utils/cardValidation.ts`.
 */
export default function CardPaymentScreen({
  route,
  navigation,
}: ScreenProps<'CardPayment'>) {
  const { engagementId, requestId } = route.params;
  const payable = usePayableEngagement(engagementId);
  const payment = useEngagementPayment(engagementId);

  const [cardholder, setCardholder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState<CardFormErrors>(NO_ERRORS);
  const [submitted, setSubmitted] = useState(false);

  const brand = detectCardBrand(number);

  const done = () =>
    returnToRequestAfterPayment(
      navigation as NativeStackNavigationProp<RootStackParamList>,
      requestId,
    );

  if (payment.succeeded && payment.payment) {
    return (
      <ScreenContainer>
        <StatusBar style="dark" />
        <PaymentResult payment={payment.payment} onDone={done} />
      </ScreenContainer>
    );
  }

  const revalidate = (next: {
    cardholder: string;
    number: string;
    expiry: string;
    cvv: string;
  }) => {
    if (submitted) setErrors(validateCardForm(next));
  };

  const onPay = () => {
    if (payment.paying || !payable.canPay) return;
    setSubmitted(true);
    const next = validateCardForm({ cardholder, number, expiry, cvv });
    setErrors(next);
    if (cardFormHasErrors(next)) return;
    const token = mapCardToMockToken(number);
    if (!token) {
      setErrors({ ...next, number: 'Only Visa and Mastercard are supported' });
      return;
    }
    void (async () => {
      const result = await payment.pay('card', token);
      // Never keep the CVV around after an attempt; drop everything on success.
      setCvv('');
      if (result?.status === 'succeeded') {
        setNumber('');
        setExpiry('');
        setCardholder('');
      }
    })();
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={payment.paying}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Payment</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {payable.amount !== null ? (
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Total to pay</Text>
              <MoneyAmount
                amount={payable.amount}
                currency={payable.currency}
                size={22}
                textStyle={styles.amountText}
              />
            </View>
          ) : null}

          {payable.blockedReason || payable.error ? (
            <Text style={styles.errorBanner}>
              {payable.blockedReason ?? payable.error}
            </Text>
          ) : null}
          {payment.error ? (
            <Text style={styles.errorBanner}>{payment.error}</Text>
          ) : null}

          <TextInput
            label="Cardholder name"
            placeholder="Name on card"
            value={cardholder}
            onChangeText={(t) => {
              setCardholder(t);
              revalidate({ cardholder: t, number, expiry, cvv });
            }}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="cc-name"
            error={errors.cardholder ?? undefined}
            editable={!payment.paying}
          />
          <TextInput
            label={`Card number${
              brand ? ` · ${brand === 'visa' ? 'Visa' : 'Mastercard'}` : ''
            }`}
            placeholder="1234 5678 9012 3456"
            value={number}
            onChangeText={(t) => {
              const formatted = formatCardNumber(t);
              setNumber(formatted);
              revalidate({ cardholder, number: formatted, expiry, cvv });
            }}
            keyboardType="number-pad"
            autoCorrect={false}
            autoComplete="cc-number"
            maxLength={19}
            error={errors.number ?? undefined}
            editable={!payment.paying}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextInput
                label="Expiry"
                placeholder="MM/YY"
                value={expiry}
                onChangeText={(t) => {
                  const formatted = formatExpiryInput(t);
                  setExpiry(formatted);
                  revalidate({ cardholder, number, expiry: formatted, cvv });
                }}
                keyboardType="number-pad"
                autoCorrect={false}
                autoComplete="cc-exp"
                maxLength={5}
                error={errors.expiry ?? undefined}
                editable={!payment.paying}
              />
            </View>
            <View style={styles.half}>
              <TextInput
                label="CVV"
                placeholder="123"
                value={cvv}
                onChangeText={(t) => {
                  const digits = cvvDigits(t);
                  setCvv(digits);
                  revalidate({ cardholder, number, expiry, cvv: digits });
                }}
                keyboardType="number-pad"
                secureTextEntry
                autoCorrect={false}
                autoComplete="cc-csc"
                maxLength={4}
                error={errors.cvv ?? undefined}
                editable={!payment.paying}
              />
            </View>
          </View>

          <View style={styles.privacyRow}>
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.privacyText}>
              Card details are checked on your device and are never sent to or
              stored by Mawahib.
              {PAYMENTS_MOCK_MODE
                ? ' Test payments only — no real money is charged.'
                : ''}
            </Text>
          </View>

          {PAYMENTS_MOCK_MODE && typeof __DEV__ !== 'undefined' && __DEV__ ? (
            <Text style={styles.devHint}>
              Dev test cards: 4242 4242 4242 4242 (Visa ✓) · 5555 5555 5555 4444
              (Mastercard ✓) · 4000 0000 0000 0002 (declined). Any future
              expiry, any 3-digit CVV.
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Pay"
            fullWidth
            loading={payment.paying}
            disabled={payment.paying || !payable.canPay}
            onPress={onPay}
          />
        </View>
      </KeyboardAvoidingView>

      <ActionBusyOverlay visible={payment.paying} message="Processing payment…" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  amountLabel: { ...typography.label, color: colors.text },
  amountText: { ...typography.h2, color: colors.primary },
  errorBanner: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  privacyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  devHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.screen,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
});
