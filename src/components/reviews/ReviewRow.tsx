import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../ui/UserAvatar';
import { toImageSource } from '../../utils/image';
import { colors, spacing, typography } from '../../theme';
import type { ReviewItem } from '../../data/types';
import {
  reviewHasUnsupportedVideo,
  reviewImageUrls,
  type ReviewMediaItem,
} from '../../lib/reviewMedia';

function receivedRoleLabel(role: ReviewItem['receivedAs']): string | null {
  if (role === 'provider') return 'As Talent';
  if (role === 'client') return 'As Client';
  return null;
}

export default function ReviewRow({
  review,
  media,
  onAuthorPress,
}: {
  review: ReviewItem;
  media?: ReviewMediaItem[];
  onAuthorPress?: () => void;
}) {
  const photos = reviewImageUrls(media, review.images ?? (review.image ? [review.image] : []), 4);
  const videoOnly = photos.length === 0 && reviewHasUnsupportedVideo(media);
  const [preview, setPreview] = useState<string | null>(null);
  const roleLabel = receivedRoleLabel(review.receivedAs);
  const nameBlock = (
    <>
      <Text style={styles.author}>{review.authorName}</Text>
      <Text style={styles.time}>{review.timeAgo}</Text>
      {roleLabel ? <Text style={styles.roleTag}>{roleLabel}</Text> : null}
    </>
  );

  return (
    <View style={styles.reviewRow}>
      {onAuthorPress ? (
        <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.8} hitSlop={4}>
          <UserAvatar uri={review.authorAvatar} size={40} style={styles.avatar} />
        </TouchableOpacity>
      ) : (
        <UserAvatar uri={review.authorAvatar} size={40} style={styles.avatar} />
      )}
      <View style={styles.reviewBody}>
        <View style={styles.reviewTop}>
          <View style={{ flex: 1 }}>
            {onAuthorPress ? (
              <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.8}>
                {nameBlock}
              </TouchableOpacity>
            ) : (
              nameBlock
            )}
          </View>
          <View style={styles.ratingPill} accessibilityLabel={`Rating ${review.rating.toFixed(1)}`}>
            <Ionicons name="star" size={12} color="#F5A623" />
            <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
          </View>
        </View>
        {review.serviceName ? (
          <Text style={styles.serviceLine}>
            <Text style={styles.serviceLabel}>Service: </Text>
            <Text style={styles.serviceName}>{review.serviceName}</Text>
          </Text>
        ) : null}
        {review.body ? <Text style={styles.body}>{review.body}</Text> : null}
        {photos.length === 1 ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setPreview(photos[0])}>
            <Image source={toImageSource(photos[0])} style={styles.thumbLarge} contentFit="cover" />
          </TouchableOpacity>
        ) : photos.length > 1 ? (
          <View style={styles.photoGrid}>
            {photos.map((uri) => (
              <TouchableOpacity key={uri} activeOpacity={0.85} onPress={() => setPreview(uri)}>
                <Image source={toImageSource(uri)} style={styles.thumb} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </View>
        ) : videoOnly ? (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.videoLabel}>Video isn’t available here</Text>
          </View>
        ) : null}
        <Modal
          visible={preview !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreview(null)}
        >
          <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
            {preview ? (
              <Image source={toImageSource(preview)} style={styles.previewImage} contentFit="contain" />
            ) : null}
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  reviewBody: {
    flex: 1,
    gap: 4,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  author: {
    ...typography.label,
    color: colors.text,
    fontWeight: '600',
  },
  time: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  serviceLine: {
    marginTop: 2,
  },
  serviceLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '500',
  },
  serviceName: {
    ...typography.caption,
    color: '#486581',
  },
  body: {
    ...typography.caption,
    color: colors.textTertiary,
    lineHeight: 18,
    marginTop: 2,
  },
  thumb: {
    width: 72,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  thumbLarge: {
    width: 160,
    height: 120,
    borderRadius: 8,
    marginTop: spacing.sm,
    backgroundColor: colors.borderLight,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  videoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  videoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '80%' },
});
