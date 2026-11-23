import React, { useCallback, useEffect, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import ProfileFeedPost from '../../components/profile/ProfileFeedPost';
import { JobCard, ServiceCard } from '../search/SearchScreen';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { useSaved, SavedCategory } from '../../context/SavedContext';
import { useMyProfile } from '../../context/ProfileContext';
import { catalogService } from '../../services';
import { serviceDetailRoute } from '../../domain/truthfulFacts';
import { openUserProfile } from '../../utils/openUserProfile';
import { Job, Post, Service } from '../../data/types';

const TABS: { id: SavedCategory; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'services', label: 'Services' },
];

const EMPTY: Record<SavedCategory, string> = {
  posts: 'No saved posts yet.',
  jobs: 'No saved jobs yet.',
  services: 'No saved services yet.',
};

export default function SavedScreen({ navigation }: ScreenProps<'Saved'>) {
  const { lists, loadCategory, unsaveFromList, isSaved } = useSaved();
  const { user: me } = useMyProfile();
  const [tab, setTab] = useState<SavedCategory>('posts');
  const bucket = lists[tab];

  useFocusEffect(
    useCallback(() => {
      void loadCategory(tab, 'first');
    }, [loadCategory, tab]),
  );

  useEffect(() => {
    if (!bucket.loaded && !bucket.loading) {
      void loadCategory(tab, 'first');
    }
  }, [bucket.loaded, bucket.loading, loadCategory, tab]);

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setTab(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList<Post | Job | (Service & { ownerUserId?: string })>
        data={bucket.items}
        key={tab}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (bucket.hasMore && !bucket.loading) void loadCategory(tab, 'more');
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          bucket.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.pad} />
          ) : bucket.error ? (
            <View style={styles.pad}>
              <Text style={styles.errorText}>{bucket.error}</Text>
              <TouchableOpacity onPress={() => void loadCategory(tab, 'first')}>
                <Text style={styles.retry}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : bucket.loaded ? (
            <Text style={styles.empty}>{EMPTY[tab]}</Text>
          ) : undefined
        }
        ListFooterComponent={
          bucket.loading && bucket.items.length > 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.pad} />
          ) : bucket.error && bucket.items.length > 0 ? (
            <TouchableOpacity
              onPress={() => void loadCategory(tab, 'more')}
              style={styles.pad}
            >
              <Text style={styles.retry}>{bucket.error} · Retry</Text>
            </TouchableOpacity>
          ) : undefined
        }
        renderItem={({ item }) => {
          if (tab === 'posts') {
            const post = item as Post;
            return (
              <ProfileFeedPost
                post={post}
                saved={isSaved('post', post.id, true)}
                onBookmark={() => void unsaveFromList('posts', post.id)}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                onAuthorPress={() => openUserProfile(navigation, post.author.id, me.id)}
              />
            );
          }
          if (tab === 'jobs') {
            const job = item as unknown as Job;
            return (
              <JobCard
                job={job}
                onPress={() => navigation.navigate('JobListingDetail', { listingId: job.id })}
                onBookmark={() => void unsaveFromList('jobs', job.id)}
              />
            );
          }
          const service = item as unknown as Service & { ownerUserId?: string };
          return (
            <ServiceCard
              service={service}
              onPress={() => {
                catalogService.rememberService(service);
                navigation.navigate(
                  'ServiceDetail',
                  serviceDetailRoute(service.id, service.ownerUserId || service.provider.id, me.id),
                );
              }}
              onProviderPress={() =>
                openUserProfile(navigation, service.ownerUserId || service.provider.id, me.id)
              }
              onBookmark={() => void unsaveFromList('services', service.id)}
            />
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  segmentWrap: { paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.white,
  },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl, flexGrow: 1 },
  pad: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retry: { ...typography.bodySmall, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
});
