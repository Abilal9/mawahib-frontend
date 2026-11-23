import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import MoneyAmount from '../../components/ui/MoneyAmount';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { usePayableEngagement } from '../../hooks/usePayableEngagement';
import { addonLines } from '../../utils/chargeableTotal';
import { PAYMENTS_MOCK_MODE } from '../../config/payments';
import type { ApiPaymentMethod } from '../../services/paymentsApi';

const METHODS: {
  id: ApiPaymentMethod;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  {
    id: 'apple_pay',
    title: 'Apple Pay',
    subtitle: 'Confirm in one tap',
    icon: 'logo-apple',
  },
  {
    id: 'card',
    title: 'Credit / Debit Card',
    subtitle: 'Visa or Mastercard',
    icon: 'card-outline',
  },
];

/**
 * Payment Summary. The amount shown is the engagement's `chargeableTotal`
 * (package + add-ons) from the API — the app never computes or sends an amount.
 */
export default function ConfirmPaymentScreen({
  route,
  navigation,
}: ScreenProps<'ConfirmPayment'>) {
  const { engagementId, requestId } = route.params;
  const payable = usePayableEngagement(engagementId);
  const [method, setMethod] = useState<ApiPaymentMethod>('apple_pay');

  const { engagement } = payable;
  const detail = engagement?.detail ?? null;
  const addons = addonLines(detail?.addons);

  const onContinue = () => {
    if (!payable.canPay) return;
    navigation.navigate(method === 'apple_pay' ? 'ApplePay' : 'CardPayment', {
      engagementId,
      requestId,
    });
  };

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Summary</Text>
        <View style={styles.backButton} />
      </View>

      {payable.loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !engagement ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {payable.error ?? 'Payment not found'}
          </Text>
          <Button title="Retry" onPress={() => void payable.reload()} />
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Order Summary</Text>
              <Text style={styles.serviceName}>{engagement.title}</Text>
              <Text style={styles.serviceProvider}>
                by {engagement.provider.displayName}
              </Text>
              <View style={styles.divider} />

              {detail ? (
                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel} numberOfLines={1}>
                    {detail.packageName || 'Package price'}
                  </Text>
                  <MoneyAmount
                    amount={Number(detail.packagePrice)}
                    currency={detail.currency}
                    size={14}
                    color={colors.text}
                  />
                </View>
              ) : null}
              {addons.map((addon) => (
                <View key={addon.id} style={styles.lineRow}>
                  <Text style={styles.lineLabel} numberOfLines={1}>
                    + {addon.title}
                  </Text>
                  <MoneyAmount
                    amount={addon.amount}
                    currency={detail?.currency}
                    size={14}
                    color={colors.text}
                  />
                </View>
              ))}

              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                {payable.amount !== null ? (
                  <MoneyAmount
                    amount={payable.amount}
                    currency={payable.currency}
                    size={18}
                    textStyle={styles.totalAmount}
                  />
                ) : (
                  <Text style={styles.lineLabel}>—</Text>
                )}
              </View>
            </View>

            {payable.blockedReason ? (
              <View style={styles.notice}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={styles.noticeText}>{payable.blockedReason}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Payment Method</Text>
                {METHODS.map((item) => {
                  const selected = method === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.methodItem,
                        selected && styles.methodItemSelected,
                      ]}
                      onPress={() => setMethod(item.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={item.icon} size={24} color={colors.text} />
                      <View style={styles.methodInfo}>
                        <Text style={styles.methodTitle}>{item.title}</Text>
                        <Text style={styles.methodSubtitle}>
                          {item.subtitle}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={colors.primary}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {PAYMENTS_MOCK_MODE ? (
                  <Text style={styles.mockHint}>
                    Test payments only — no real money is charged.
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>

          {payable.blockedReason ? null : (
            <View style={styles.footer}>
              <Button
                title="Continue"
                onPress={onContinue}
                disabled={!payable.canPay}
                fullWidth
              />
            </View>
          )}
        </>
      )}
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorText: { ...typography.body, color: colors.text, textAlign: 'center' },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  serviceName: { ...typography.h3, color: colors.text },
  serviceProvider: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.lg,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  lineLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { ...typography.label, color: colors.text },
  totalAmount: { ...typography.h2, color: colors.primary },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  methodItemSelected: { borderColor: colors.primary },
  methodInfo: { flex: 1 },
  methodTitle: { ...typography.label, color: colors.text },
  methodSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mockHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  noticeText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  footer: {
    padding: spacing.screen,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
});
