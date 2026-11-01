import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../ui/UserAvatar';
import { colors, spacing, typography } from '../../theme';
import type { User } from '../../data/types';
import { PROFILE_COVER_HEIGHT, displayProfileTitle } from '../../constants/profile';
import { formatRatingValue, hasRealReviews } from '../../utils/profileRating';
import {
  overallAggregate,
  reviewCountLabel,
} from '../../utils/reviewSummary';
export const PROFILE_COLLAPSE_DISTANCE = 100;
/** Cover / pink strip under nav — matches Edit cover crop frame. */
export const PROFILE_WAVE_MAX = PROFILE_COVER_HEIGHT;

/** Presentation-only identity. Optional fields stay omitted, never faked. */
export type ProfileHeaderIdentity = {
  name: string;
  title?: string | null;
  avatar?: string | number | null;
  location?: string | null;
  isVerified?: boolean;
  rating?: number;
  reviewCount?: number;
  reviewSummary?: User['reviewSummary'];
};

interface ProfileCollapsingHeaderProps {
  user: ProfileHeaderIdentity;
  scrollY: Animated.Value;
  children?: React.ReactNode;
  onReviewsPress?: () => void;
  onConnectionsPress?: () => void;
  connectionsLabel?: string;
}

export default function ProfileCollapsingHeader({
  user,
  scrollY,
  children,
  onReviewsPress,
  onConnectionsPress,
  connectionsLabel,
}: ProfileCollapsingHeaderProps) {
  const overall = overallAggregate(user);
  const showRating = hasRealReviews(user);
  const rating = overall.average ?? 0;
  const reviews = overall.count;
  const connections = connectionsLabel ?? 'Connections';

  const avatarSize = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [112, 64],
    extrapolate: 'clamp',
  });

  const avatarRadius = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [56, 32],
    extrapolate: 'clamp',
  });

  const avatarBorder = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [3, 2],
    extrapolate: 'clamp',
  });

  // Keep avatar fully below the fixed nav so the circle isn't clipped
  const avatarOverlap = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [-(PROFILE_WAVE_MAX - 4), -24],
    extrapolate: 'clamp',
  });

  const infoPullUp = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [-56, -28],
    extrapolate: 'clamp',
  });

  const infoPaddingTop = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [64, 40],
    extrapolate: 'clamp',
  });

  const infoPaddingBottom = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [spacing.md, spacing.sm],
    extrapolate: 'clamp',
  });

  const nameScale = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const metaOpacity = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE * 0.45, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });

  const metaMaxHeight = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [96, 0],
    extrapolate: 'clamp',
  });

  const metaTranslateY = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [0, -12],
    extrapolate: 'clamp',
  });

  const childrenOpacity = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE * 0.55, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  // Visitor CTAs: Connect/Message row + Request Work (~130px). Keep headroom so
  // the pink filled button isn't clipped mid-height by overflow:hidden.
  const childrenMaxHeight = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [160, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <View style={styles.waveSpacer} />

      {/* Avatar sits on the pink, not inside a card */}
      <Animated.View
        style={[
          styles.avatarWrap,
          {
            marginTop: avatarOverlap,
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarRadius,
            borderWidth: avatarBorder,
          },
        ]}
      >
        <UserAvatar uri={user.avatar} fill style={styles.avatarImage} />
      </Animated.View>

      <Animated.View
        style={[
          styles.infoBlock,
          {
            marginTop: infoPullUp,
            paddingTop: infoPaddingTop,
            paddingBottom: infoPaddingBottom,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: nameScale }] }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {user.isVerified ? (
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={10} color={colors.white} />
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: metaOpacity,
            maxHeight: metaMaxHeight,
            transform: [{ translateY: metaTranslateY }],
            overflow: 'hidden',
            alignItems: 'center',
          }}
        >
          <Text style={styles.role}>{displayProfileTitle(user.title)}</Text>
          {user.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.location}>{user.location}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.ratingRow}
            onPress={onReviewsPress}
            disabled={!onReviewsPress}
            activeOpacity={0.8}
          >
            {showRating ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < Math.round(rating) ? 'star' : 'star-outline'}
                    size={14}
                    color="#F5A623"
                  />
                ))}
                <Text style={styles.ratingValue}>{formatRatingValue(rating)}</Text>
                <Text style={styles.reviewsLink}>{reviewCountLabel(reviews)}</Text>
              </>
            ) : (
              <Text style={styles.reviewsLink}>No reviews yet</Text>
            )}
          </TouchableOpacity>
          {connectionsLabel ? (
            onConnectionsPress ? (
              <TouchableOpacity onPress={onConnectionsPress} activeOpacity={0.8}>
                <Text style={styles.connections}>{connections}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.connections}>{connections}</Text>
            )
          ) : null}
        </Animated.View>
      </Animated.View>

      {children ? (
        <Animated.View
          style={{
            opacity: childrenOpacity,
            maxHeight: childrenMaxHeight,
            overflow: 'hidden',
            backgroundColor: colors.white,
          }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  waveSpacer: {
    height: PROFILE_WAVE_MAX,
    backgroundColor: 'transparent',
  },
  avatarWrap: {
    alignSelf: 'center',
    borderColor: colors.white,
    overflow: 'hidden',
    zIndex: 3,
    backgroundColor: colors.borderLight,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  infoBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  verified: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  role: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.md,
  },
  ratingValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  reviewsLink: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    marginLeft: 2,
  },
  connections: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
