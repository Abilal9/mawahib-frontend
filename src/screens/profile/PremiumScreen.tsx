import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import MoneyAmount from '../../components/ui/MoneyAmount';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: null as string | null,
    period: '',
    features: ['Profile & Portfolio', '5 job applications/mo', 'Basic search'],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '49',
    period: '/month',
    features: ['Unlimited applications', 'Priority in search', 'Analytics dashboard'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '149',
    period: '/month',
    features: ['Everything in Pro', 'Team accounts', 'Job posting', 'Dedicated support', 'API access'],
    popular: false,
  },
];

export default function PremiumScreen({ navigation }: ScreenProps<'Premium'>) {
  const [selected, setSelected] = useState('pro');

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mawahib Premium</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="diamond" size={48} color={colors.primary} />
          <Text style={styles.heroTitle}>Unlock Your Full Potential</Text>
          <Text style={styles.heroSubtitle}>
            Get discovered faster, access premium features, and grow your creative career.
          </Text>
        </View>

        {PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[styles.planCard, selected === plan.id && styles.planCardSelected, plan.popular && styles.planPopular]}
            onPress={() => setSelected(plan.id)}
            activeOpacity={0.8}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                {plan.price ? (
                  <MoneyAmount
                    amount={plan.price}
                    size={22}
                    textStyle={styles.planPrice}
                  />
                ) : (
                  <Text style={styles.planPrice}>Free</Text>
                )}
                {plan.period ? (
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                ) : null}
              </View>
            </View>
            {plan.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            {selected === plan.id && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Subscribe Now" onPress={() => navigation.goBack()} fullWidth />
        <Text style={styles.terms}>Cancel anytime. Terms apply.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screen, paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', paddingVertical: spacing.xxl },
  heroTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  heroSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  planCard: {
    backgroundColor: colors.white, borderRadius: radius.card,
    padding: spacing.xl, marginBottom: spacing.md,
    borderWidth: 2, borderColor: colors.borderLight, position: 'relative',
  },
  planCardSelected: { borderColor: colors.primary },
  planPopular: { borderColor: colors.primary + '40' },
  popularBadge: {
    position: 'absolute', top: -10, right: spacing.lg,
    backgroundColor: colors.primary, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: radius.full,
  },
  popularText: { ...typography.caption, color: colors.white, fontFamily: typography.label.fontFamily },
  planHeader: { marginBottom: spacing.lg },
  planName: { ...typography.h3, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  planPrice: { ...typography.h1, color: colors.primary, fontSize: 28 },
  planPeriod: { ...typography.body, color: colors.textSecondary, marginStart: spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { ...typography.bodySmall, color: colors.text },
  selectedIndicator: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  footer: { padding: spacing.screen, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.white },
  terms: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
});
