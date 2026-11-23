import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import MoneyAmount from '../../components/ui/MoneyAmount';
import ServiceMediaMosaic from '../../components/explore/ServiceMediaMosaic';
import GuestScreenHeader from '../../components/guest/GuestScreenHeader';
import {
  GuestRating,
  GuestReviewCard,
  GuestStatusBlock,
} from '../../components/guest/GuestDiscoveryCards';
import UserAvatar from '../../components/ui/UserAvatar';
import { useGuestService } from '../../hooks/useGuestService';
import { useAuthGate } from '../../context/AuthGateContext';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { displayProfileTitle } from '../../constants/profile';
import { categoryCardLabel } from '../../i18n/catalogLabel';
import { colors, spacing, radius, typography } from '../../theme';
import type { SignedOutScreenProps } from '../../navigation/types';
import { TouchableOpacity } from 'react-native';

/**
 * Public service detail. Request/Save open the Auth Gate. No mutations.
 */
export default function GuestServiceDetailScreen({
  route,
  navigation,
}: SignedOutScreenProps<'ServiceDetail'>) {
  const {
    service,
    reviews,
    loading,
    reviewsLoading,
    error,
    reviewsError,
    notFound,
    refresh,
  } = useGuestService(route.params.serviceId);
  const { requireAuth } = useAuthGate();

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <GuestScreenHeader onBack={() => navigation.goBack()} title="Service" />
      {loading ? (
        <GuestStatusBlock loading />
      ) : notFound || !service ? (
        <GuestStatusBlock
          error={error || 'This service is unavailable.'}
          onRetry={notFound ? undefined : refresh}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <ServiceMediaMosaic images={service.images} height={200} />
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { flex: 1 }]}>{service.title}</Text>
              <BookmarkButton
                kind="service"
                saved={false}
                onPress={() =>
                  requireAuth({
                    action: 'save',
                    route: 'ServiceDetail',
                    params: { serviceId: service.id },
                  })
                }
              />
            </View>
            {categoryCardLabel(service) ? (
              <Text style={styles.meta}>{categoryCardLabel(service)}</Text>
            ) : null}
            <GuestRating summary={service.reviewSummary} />
            <TouchableOpacity
              style={styles.provider}
              onPress={() =>
                navigation.navigate('UserProfile', { userId: service.provider.id })
              }
              activeOpacity={0.85}
            >
              <UserAvatar uri={service.provider.avatarUrl} size={40} />
              <View>
                <Text style={styles.providerName}>{service.provider.displayName}</Text>
                <Text style={styles.meta}>
                  {displayProfileTitle(service.provider.title)}
                </Text>
              </View>
            </TouchableOpacity>
            {service.description ? (
              <Text style={styles.description}>{service.description}</Text>
            ) : null}
          </View>

          {service.packages.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.subhead}>Packages</Text>
              {service.packages.map((pkg) => (
                <View key={pkg.name} style={styles.packageCard}>
                  <View style={styles.packageTop}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    <MoneyAmount amount={pkg.price} currency={pkg.currency} size={16} />
                  </View>
                  {pkg.delivery ? (
                    <Text style={styles.meta}>{pkg.delivery}</Text>
                  ) : null}
                  {pkg.includes.map((item) => (
                    <Text key={item} style={styles.include}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {service.addons.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.subhead}>Add-ons</Text>
              {service.addons.map((addon) => (
                <View key={addon.id} style={styles.packageTop}>
                  <Text style={styles.include}>{addon.title}</Text>
                  <MoneyAmount amount={addon.price} currency={addon.currency} size={14} />
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.subhead}>Reviews</Text>
            {reviewsLoading ? <GuestStatusBlock loading /> : null}
            {reviewsError ? (
              <GuestStatusBlock error={reviewsError} onRetry={refresh} />
            ) : null}
            {!reviewsLoading && reviews.length === 0 && !reviewsError ? (
              <Text style={styles.meta}>No published reviews yet.</Text>
            ) : null}
            {reviews.map((review) => (
              <GuestReviewCard key={review.id} review={review} />
            ))}
            {reviews.length > 0 ? (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Reviews', { serviceId: service.id })
                }
              >
                <Text style={styles.link}>See all reviews</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.cta}>
            <Button
              title="Request Service"
              onPress={() =>
                requireAuth({
                  action: 'request',
                  route: 'ServiceDetail',
                  params: { serviceId: service.id },
                })
              }
              fullWidth
            />
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxxl },
  section: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, gap: 8 },
  title: { ...typography.h2, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  description: { ...typography.body, color: colors.text },
  provider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  providerName: { ...typography.label, color: colors.text },
  subhead: { ...typography.h3, color: colors.text },
  packageCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
    backgroundColor: colors.white,
    gap: 4,
  },
  packageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  packageName: { ...typography.label, color: colors.text },
  include: { ...typography.bodySmall, color: colors.text, flex: 1 },
  link: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl },
});
