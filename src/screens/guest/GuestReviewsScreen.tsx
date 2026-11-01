import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import GuestScreenHeader from '../../components/guest/GuestScreenHeader';
import { GuestStatusBlock } from '../../components/guest/GuestDiscoveryCards';
import ReviewRow from '../../components/reviews/ReviewRow';
import ReviewSummaryCard from '../../components/reviews/ReviewSummaryCard';
import { useGuestReviews } from '../../hooks/useGuestReviews';
import { guestReviewToItem } from '../../lib/guestReviewPresentation';
import { distributionFromStars } from '../../lib/reviewDistribution';
import { isStaleIdentityError } from '../../lib/identityFences';
import {
  fetchPublicService,
  fetchPublicUser,
  type GuestReviewAggregate,
  type GuestReviewSummaryPair,
} from '../../services/publicApi';
import type { PublicReviewRole } from '../../services/publicQuery';
import { reviewCountLabel } from '../../utils/reviewSummary';
import { colors, spacing, radius, typography } from '../../theme';
import type { SignedOutScreenProps } from '../../navigation/types';

type RoleFilter = 'all' | PublicReviewRole;

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'provider', label: 'As Talent' },
  { value: 'client', label: 'As Client' },
];

function aggregateFor(
  filter: RoleFilter,
  pair: GuestReviewSummaryPair | null,
): GuestReviewAggregate | null {
  if (!pair) return null;
  if (filter === 'provider') return pair.asProvider;
  if (filter === 'client') return pair.asClient;
  return pair.overall;
}

/** Public published reviews only. No authenticated review viewer APIs. */
export default function GuestReviewsScreen({
  route,
  navigation,
}: SignedOutScreenProps<'Reviews'>) {
  const userId = route.params?.userId;
  const serviceId = route.params?.serviceId;
  const isUserList = Boolean(userId) && !serviceId;
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const role = roleFilter === 'all' ? undefined : roleFilter;
  const reviews = useGuestReviews({
    userId,
    serviceId,
    role: isUserList ? role : undefined,
  });
  const [userSummary, setUserSummary] = useState<GuestReviewSummaryPair | null>(
    null,
  );
  const [serviceSummary, setServiceSummary] =
    useState<GuestReviewAggregate | null>(null);
  const summaryGen = useRef(0);

  useEffect(() => {
    const requestGen = ++summaryGen.current;
    let cancelled = false;
    if (serviceId) {
      void fetchPublicService(serviceId)
        .then((service) => {
          if (cancelled || requestGen !== summaryGen.current) return;
          setServiceSummary(service.reviewSummary);
          setUserSummary(null);
        })
        .catch((error) => {
          if (cancelled || isStaleIdentityError(error)) return;
          if (requestGen !== summaryGen.current) return;
          setServiceSummary(null);
        });
    } else if (userId) {
      void fetchPublicUser(userId)
        .then((profile) => {
          if (cancelled || requestGen !== summaryGen.current) return;
          setUserSummary(profile.reviewSummary);
          setServiceSummary(null);
        })
        .catch((error) => {
          if (cancelled || isStaleIdentityError(error)) return;
          if (requestGen !== summaryGen.current) return;
          setUserSummary(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [serviceId, userId]);

  const active = isUserList
    ? aggregateFor(roleFilter, userSummary)
    : serviceSummary;
  const total = active?.count ?? 0;
  const average = total > 0 ? (active?.average ?? 0) : 0;
  const distribution = distributionFromStars(active?.stars, total);
  const rated = total > 0;

  const mapped = useMemo(
    () => reviews.items.map((item) => guestReviewToItem(item)),
    [reviews.items],
  );

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <GuestScreenHeader
        onBack={() => navigation.goBack()}
        title={total === 0 ? 'Reviews' : reviewCountLabel(total)}
      />
      {isUserList ? (
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((option) => {
            const selected = roleFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.roleChip, selected && styles.roleChipOn]}
                onPress={() => setRoleFilter(option.value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.roleChipText, selected && styles.roleChipTextOn]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      {reviews.notFound ? (
        <GuestStatusBlock error="Reviews are unavailable." />
      ) : (
        <FlatList
          data={reviews.loading ? [] : mapped}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (reviews.hasMore && !reviews.loadingMore) void reviews.loadMore();
          }}
          ListHeaderComponent={
            <ReviewSummaryCard
              average={average}
              total={total}
              distribution={distribution}
              rated={rated}
            />
          }
          ListEmptyComponent={
            reviews.loading ? (
              <GuestStatusBlock loading />
            ) : (
              <GuestStatusBlock
                error={reviews.error}
                emptyLabel={
                  reviews.error ? undefined : 'No published reviews yet.'
                }
                onRetry={reviews.error ? reviews.refresh : undefined}
              />
            )
          }
          ListFooterComponent={
            reviews.loadingMore ? <GuestStatusBlock loading /> : undefined
          }
          renderItem={({ item, index }) => {
            const source = reviews.items[index];
            const authorId = item.authorId;
            return (
              <ReviewRow
                review={item}
                media={source?.media}
                onAuthorPress={
                  authorId
                    ? () => navigation.navigate('UserProfile', { userId: authorId })
                    : undefined
                }
              />
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  roleChipOn: {
    backgroundColor: colors.primary,
  },
  roleChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  roleChipTextOn: {
    color: colors.white,
  },
});
