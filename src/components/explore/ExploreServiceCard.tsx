import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../ui/UserAvatar';
import BookmarkButton from '../ui/BookmarkButton';
import ServiceMediaMosaic from './ServiceMediaMosaic';
import MoneyAmount from '../ui/MoneyAmount';
import { colors, spacing, radius, typography } from '../../theme';

export type ExploreServiceCardData = {
  id: string;
  title: string;
  description?: string;
  category?: string | null;
  images: string[];
  providerName: string;
  providerAvatar?: string | number | null;
  providerVerified?: boolean;
  providerLocation?: string | null;
  rating: number;
  reviewCount: number;
  price?: number | string | null;
  currency?: string | null;
  fromPrice?: boolean;
  duration?: string | null;
};

export default function ExploreServiceCard({
  service,
  onPress,
  onProviderPress,
  saved = false,
  onBookmark,
  compact = false,
}: {
  service: ExploreServiceCardData;
  onPress: () => void;
  onProviderPress?: () => void;
  saved?: boolean;
  onBookmark?: () => void;
  compact?: boolean;
}) {
  const serviceReviews = service.reviewCount ?? 0;
  return (
    <TouchableOpacity
      style={[styles.serviceCard, compact && styles.compactCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <ServiceMediaMosaic images={service.images} />
      <View style={styles.serviceBody}>
        <View style={styles.serviceTitleRow}>
          <Text style={styles.serviceTitle} numberOfLines={1}>
            {service.title}
          </Text>
          {onBookmark ? (
            <BookmarkButton kind="service" saved={saved} onPress={onBookmark} />
          ) : null}
        </View>
        {service.category ? <Text style={styles.categoryText}>{service.category}</Text> : null}
        {service.description ? (
          <Text style={styles.serviceDesc} numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
        <TouchableOpacity
          style={styles.providerRow}
          onPress={onProviderPress}
          disabled={!onProviderPress}
          activeOpacity={0.85}
        >
          <UserAvatar uri={service.providerAvatar} size={20} />
          <Text style={styles.providerName}>{service.providerName}</Text>
          {service.providerVerified ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          ) : null}
        </TouchableOpacity>
        {service.providerLocation ? (
          <Text style={styles.serviceMeta}>{service.providerLocation}</Text>
        ) : null}
        {serviceReviews > 0 ? (
          <Text style={styles.providerRating}>
            {service.rating.toFixed(1)} (
            {serviceReviews === 1 ? '1 review' : `${serviceReviews} reviews`})
          </Text>
        ) : (
          <Text style={styles.providerRating}>No reviews yet</Text>
        )}
        {service.duration ? <Text style={styles.serviceMeta}>{service.duration}</Text> : null}
        {service.price != null ? (
          <View style={styles.priceRow}>
            {service.fromPrice ? (
              <Text style={styles.fromLabel}>From</Text>
            ) : null}
            <MoneyAmount
              amount={service.price}
              currency={service.currency}
              size={14}
              color={colors.textTertiary}
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  compactCard: {
    width: 280,
    marginBottom: 0,
    marginRight: spacing.sm,
  },
  serviceBody: { padding: spacing.md, gap: 4 },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  serviceTitle: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  categoryText: { ...typography.caption, color: colors.primary },
  serviceDesc: { ...typography.bodySmall, color: colors.textSecondary },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  providerName: { ...typography.bodySmall, color: colors.text, flex: 1 },
  serviceMeta: { ...typography.caption, color: colors.textTertiary },
  providerRating: { ...typography.caption, color: colors.text, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  fromLabel: { ...typography.caption, color: colors.textSecondary },
});
