import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import { Post } from '../../data/types';
import { HIDDEN_BY_MAWAHIB } from '../../lib/hiddenContent';
import BookmarkButton from '../ui/BookmarkButton';
import { displayProfileTitle } from '../../constants/profile';

type ProfileFeedPostProps = {
  post: Post;
  onPress: () => void;
  onAuthorPress: () => void;
  saved?: boolean;
  onBookmark?: () => void;
};

/** Full-width post preview used on own + visitor profile Posts tabs. */
export default function ProfileFeedPost({
  post,
  onPress,
  onAuthorPress,
  saved = false,
  onBookmark,
}: ProfileFeedPostProps) {
  const truncated =
    post.caption.length > 110 ? `${post.caption.slice(0, 110)}...` : post.caption;

  return (
    <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.95}>
      <TouchableOpacity
        style={styles.feedHeader}
        onPress={onAuthorPress}
        activeOpacity={0.85}
      >
        <UserAvatar uri={post.author.avatar} size={40} style={styles.feedAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.feedName}>{post.author.name}</Text>
          <Text style={styles.feedMeta}>
            {post.role ?? displayProfileTitle(post.author.title)} ·{' '}
            {post.timeAgo ?? '2h'}
          </Text>
        </View>
      </TouchableOpacity>
      {post.hiddenByMawahib ? <Text style={styles.hiddenNotice}>{HIDDEN_BY_MAWAHIB}</Text> : null}
      <Text style={styles.feedCaption}>
        {truncated}
        {post.caption.length > 110 ? (
          <Text style={styles.seeMore}> See more</Text>
        ) : null}
      </Text>
      {post.images[0] ? (
        <Image source={toImageSource(post.images[0])} style={styles.feedImage} contentFit="cover" />
      ) : null}
      <View style={styles.feedActions}>
        <View style={styles.feedAction}>
          <Ionicons name="thumbs-up-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.feedCount}>{post.likes}</Text>
        </View>
        <View style={styles.feedAction}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.feedCount}>{post.comments}</Text>
        </View>
        <Ionicons name="arrow-redo-outline" size={18} color={colors.textSecondary} />
        <View style={{ flex: 1 }} />
        {onBookmark && !post.hiddenByMawahib ? (
          <BookmarkButton kind="post" saved={saved} onPress={onBookmark} size={18} idleColor={colors.textSecondary} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  feedCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedAvatar: { width: 40, height: 40, borderRadius: 20 },
  feedName: { ...typography.label, color: colors.text },
  feedMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  hiddenNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  feedCaption: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  seeMore: { color: colors.primary },
  feedImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.card,
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  feedAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedCount: { ...typography.caption, color: colors.textSecondary },
});
