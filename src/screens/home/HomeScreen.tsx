import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import UserAvatar from '../../components/ui/UserAvatar';
import { Ionicons } from '@expo/vector-icons';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import AppHeader from '../../components/ui/AppHeader';
import HomeSplashLoader from '../../components/ui/HomeSplashLoader';
import HomePendingPlaceholder from '../../components/ui/HomePendingPlaceholder';
import {
  resolveHomeInitialLoader,
  resolveHomePaginationIndicator,
  resolveHomePageEmpty,
  resolveHomeSectionAppearance,
  sectionHasVisibleError,
} from '../../lib/homeLoadingPresentation';
import { feedInitialPending } from '../../lib/feedLifecycle';
import { colors, spacing, radius, typography } from '../../theme';
import { useSidebar } from '../../context/SidebarContext';
import { useMyProfile } from '../../context/ProfileContext';
import { usePosts } from '../../context/PostsContext';
import { useSaved } from '../../context/SavedContext';
import { useConnections } from '../../context/ConnectionsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { catalogService, jobService } from '../../services';
import MoneyAmount from '../../components/ui/MoneyAmount';
import { serviceDetailRoute } from '../../domain/truthfulFacts';
import PostLikesModal from '../../components/ui/PostLikesModal';
import PostMediaPreview from '../../components/ui/PostMediaPreview';
import { stripCurrencyCodeTokens } from '../../utils/money';
import { openUserProfile } from '../../utils/openUserProfile';
import { TabScreenProps } from '../../navigation/types';
import { Post, Job, Service, Talent } from '../../data/types';
import { toImageSource } from '../../utils/image';
import { displayProfileTitle } from '../../constants/profile';

const REFRESH_DELAY_MS = 450;

function imageSource(src: string | number) {
  return toImageSource(src);
}

function FeedPostCard({
  post,
  onPress,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onAuthorPress,
  onConnect,
  onAccept,
  onPressLikes,
}: {
  post: Post;
  onPress: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onAuthorPress: () => void;
  onConnect?: () => void;
  onAccept?: () => void;
  onPressLikes?: () => void;
}) {
  const truncated =
    post.caption.length > 120 ? `${post.caption.slice(0, 120)}...` : post.caption;
  const isDiscovery = post.feedSource === 'discovery';
  const rel = post.relationship?.status;
  const showConnect = isDiscovery && rel === 'none';
  const showRequested = isDiscovery && rel === 'outgoing';
  const showAccept = isDiscovery && rel === 'incoming';

  return (
    <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.95}>
      <View style={styles.feedHeader}>
        <TouchableOpacity
          style={styles.feedHeaderMain}
          onPress={onAuthorPress}
          activeOpacity={0.85}
        >
          <UserAvatar
            uri={post.author.avatar}
            size={40}
            style={styles.feedAvatar}
          />
          <View style={styles.feedAuthor}>
            <View style={styles.feedAuthorRow}>
              <Text style={styles.feedAuthorName}>{post.author.name}</Text>
              {post.author.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              )}
            </View>
            {post.role ? <Text style={styles.feedRole}>{post.role}</Text> : null}
            {isDiscovery ? (
              <Text style={styles.discoveryLabel}>Discovery</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {showConnect ? (
          <TouchableOpacity style={styles.connectBtn} onPress={onConnect} hitSlop={8}>
            <Text style={styles.connectBtnText}>Connect</Text>
          </TouchableOpacity>
        ) : showRequested ? (
          <View style={styles.connectBtnMuted}>
            <Text style={styles.connectBtnMutedText}>Requested</Text>
          </View>
        ) : showAccept ? (
          <TouchableOpacity style={styles.connectBtn} onPress={onAccept} hitSlop={8}>
            <Text style={styles.connectBtnText}>Accept</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.feedTime}>{post.timeAgo ?? ''}</Text>
        )}
      </View>

      {post.caption ? (
        <Text style={styles.feedCaption}>
          {truncated}
          {post.caption.length > 120 && (
            <Text style={styles.seeMore}> See more</Text>
          )}
        </Text>
      ) : null}

      <PostMediaPreview images={post.images} onPress={onPress} />

      <View style={styles.feedActions}>
        <View style={styles.feedAction}>
          <TouchableOpacity onPress={onLike} hitSlop={8}>
            <Ionicons
              name={post.isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={20}
              color={post.isLiked ? colors.primary : colors.textTertiary}
            />
          </TouchableOpacity>
          {post.likes > 0 && onPressLikes ? (
            <TouchableOpacity onPress={onPressLikes} hitSlop={8}>
              <Text style={styles.feedActionCount}>{post.likes}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.feedActionCount}>{post.likes}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.feedAction}
          onPress={onComment}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.textTertiary} />
          <Text style={styles.feedActionCount}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.feedAction} onPress={onShare} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.feedActionSpacer} />
        <BookmarkButton
          kind="post"
          saved={post.isSaved}
          onPress={onBookmark}
        />
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} hitSlop={8}>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function JobMatchCard({
  job,
  onPress,
  onDismiss,
}: {
  job: Job;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const typeLabel =
    job.type === 'part-time'
      ? 'Part-time'
      : job.type === 'full-time'
        ? 'Full-time'
        : job.type === 'contract'
          ? 'Contract'
          : job.type === 'gig'
            ? 'Gig'
            : 'Freelance';

  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress} activeOpacity={0.9}>
      <TouchableOpacity style={styles.cardDismiss} onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.jobTop}>
        {job.logo ? (
          <Image source={imageSource(job.logo)} style={styles.jobLogo} contentFit="cover" />
        ) : (
          <View style={styles.jobLogoPlaceholder}>
            <Text style={styles.jobLogoText}>{job.company.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.jobInfo}>
          <View style={styles.jobTitleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <View style={styles.jobTypeBadge}>
              <Text style={styles.jobTypeText}>{typeLabel}</Text>
            </View>
          </View>
          <Text style={styles.jobCompany} numberOfLines={1}>
            {job.company}
          </Text>
        </View>
      </View>

      <View style={styles.jobMetaRow}>
        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.jobMetaText} numberOfLines={1}>
          {job.location}
        </Text>
      </View>
      <View style={styles.jobMetaRow}>
        <MoneyAmount
          amount={stripCurrencyCodeTokens(job.salary) || 'Negotiable'}
          currency={job.currency}
          size={14}
          color={colors.textSecondary}
          rawLabel
        />
      </View>
    </TouchableOpacity>
  );
}

function ServiceMatchCard({
  service,
  onPress,
  onDismiss,
}: {
  service: Service;
  onPress: () => void;
  onDismiss: () => void;
}) {
  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress} activeOpacity={0.9}>
      <TouchableOpacity style={styles.cardDismiss} onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.jobTop}>
        <Image
          source={service.images[0] ? toImageSource(service.images[0]) : undefined}
          style={styles.jobLogo}
          contentFit="cover"
        />
        <View style={styles.jobInfo}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {service.title}
          </Text>
          {(service.reviewCount ?? 0) > 0 ? (
            <View style={styles.ratingInline}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.ratingInlineText}>
                {service.rating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCountText}>
                ({service.reviewCount === 1 ? '1 review' : `${service.reviewCount} reviews`})
              </Text>
            </View>
          ) : (
            <Text style={styles.ratingCountText}>No reviews yet</Text>
          )}
          <Text style={styles.jobCompany} numberOfLines={1}>
            {service.provider.name}
          </Text>
        </View>
      </View>

      {service.duration.trim() ? (
        <View style={styles.jobMetaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.jobMetaText} numberOfLines={1}>
            {service.duration}
          </Text>
        </View>
      ) : null}
      {service.price != null ? (
        <View style={styles.jobMetaRow}>
          <MoneyAmount
            amount={service.price}
            currency={service.currency}
            size={14}
            color={colors.textSecondary}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function TalentMatchCard({
  talent,
  onPress,
  onDismiss,
}: {
  talent: Talent;
  onPress: () => void;
  onDismiss: () => void;
}) {
  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress} activeOpacity={0.9}>
      <TouchableOpacity style={styles.cardDismiss} onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.jobTop}>
        <UserAvatar uri={talent.user.avatar} size={48} style={styles.talentAvatar} />
        <View style={styles.jobInfo}>
          <View style={styles.jobTitleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {talent.user.name}
            </Text>
            {talent.user.isVerified ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            ) : null}
          </View>
          <Text style={styles.jobCompany} numberOfLines={1}>
            {displayProfileTitle(talent.user.title)}
          </Text>
          {(talent.reviewCount ?? 0) > 0 ? (
            <View style={styles.ratingInline}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.ratingInlineText}>{talent.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCountText}>({talent.reviewCount ?? 0})</Text>
            </View>
          ) : null}
        </View>
      </View>

      {talent.user.location ? (
        <View style={styles.jobMetaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.jobMetaText} numberOfLines={1}>
            {talent.user.location}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: TabScreenProps<'HomeTab'>) {
  const { open: openSidebar } = useSidebar();
  const { user: me } = useMyProfile();
  const {
    posts: feedPosts,
    feedPhase,
    error: feedError,
    hasMore,
    loadingMore,
    refresh: refreshFeed,
    loadMore,
    toggleLike,
    patchLocalPost,
  } = usePosts();
  const saved = useSaved();
  const { requestConnect, acceptRequest, refresh: refreshConnections } =
    useConnections();
  const { unreadCount } = useNotifications();
  const [jobList, setJobList] = useState<Job[]>([]);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [serviceList, setServiceList] = useState(() => catalogService.listServices());
  const [talentList, setTalentList] = useState(() => catalogService.listTalents());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const jobsResult = await jobService.refresh().then(
        (jobs) => ({ ok: true as const, jobs }),
        (e) => ({
          ok: false as const,
          message: e instanceof Error ? e.message : 'Failed to load jobs',
        }),
      );
      const catalogResult = await catalogService.refresh().then(
        (catalog) => ({ ok: true as const, catalog }),
        (e) => ({
          ok: false as const,
          message:
            e instanceof Error ? e.message : 'Failed to load explore catalog',
        }),
      );

      if (jobsResult.ok) {
        setJobList(jobsResult.jobs);
        setJobsError(null);
        setJobsLoading(false);
      } else {
        setJobsError(jobsResult.message);
        setJobList([]);
        setJobsLoading(false);
      }

      if (catalogResult.ok) {
        setServiceList(catalogResult.catalog.services);
        setTalentList(catalogResult.catalog.talents);
        setCatalogError(null);
      } else {
        setCatalogError(catalogResult.message);
      }
      setCatalogLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_DELAY_MS));
    await Promise.all([
      refreshFeed(),
      refreshConnections().catch(() => undefined),
      (async () => {
        const jobsResult = await jobService.refresh().then(
          (jobs) => ({ ok: true as const, jobs }),
          (e) => ({
            ok: false as const,
            message: e instanceof Error ? e.message : 'Failed to load jobs',
          }),
        );
        const catalogResult = await catalogService.refresh().then(
          (catalog) => ({ ok: true as const, catalog }),
          () => ({ ok: false as const }),
        );
        if (jobsResult.ok) {
          setJobList(jobsResult.jobs);
          setJobsError(null);
        } else {
          setJobsError(jobsResult.message);
        }
        if (catalogResult.ok) {
          setServiceList(catalogResult.catalog.services);
          setTalentList(catalogResult.catalog.talents);
          setCatalogError(null);
        } else {
          setCatalogError('Failed to load explore catalog');
        }
        setCatalogLoading(false);
      })(),
    ]);
    setRefreshing(false);
  };

  const retryCatalog = () => {
    void (async () => {
      setCatalogLoading(serviceList.length === 0 && talentList.length === 0);
      setCatalogError(null);
      try {
        const catalog = await catalogService.refresh();
        setServiceList(catalog.services);
        setTalentList(catalog.talents);
        setCatalogError(null);
      } catch (e) {
        setCatalogError(
          e instanceof Error ? e.message : 'Failed to load explore catalog',
        );
      } finally {
        setCatalogLoading(false);
      }
    })();
  };

  const sharePost = async (post: Post) => {
    const url = `https://mawahib.app/p/${post.id}`;
    const message = `Check out this post on Mawahib`;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url }
          : { message: `${message}\n${url}`, title: 'Mawahib' },
      );
    } catch {
      Alert.alert('Share unavailable', `${message}\n${url}`);
    }
  };

  const openPostDetail = (postId: string, focusComments = false) => {
    navigation.navigate('PostDetail', { postId, focusComments });
  };

  const openExplore = (contentType: 'jobs' | 'services' | 'talents') => {
    navigation.navigate('SearchTab', { contentType });
  };

  const renderFeedPost = (post: Post) => {
    const shownSaved = saved.isSaved('post', post.id, post.isSaved);
    return (
    <FeedPostCard
      key={post.id}
      post={{ ...post, isSaved: shownSaved }}
      onPress={() => openPostDetail(post.id)}
      onLike={() => {
        void toggleLike(post.id);
      }}
      onComment={() => openPostDetail(post.id, true)}
      onShare={() => sharePost(post)}
      onBookmark={() => {
        void saved.setDesired('post', post.id, !shownSaved, post.isSaved);
      }}
      onAuthorPress={() => openUserProfile(navigation, post.author.id, me.id)}
      onConnect={() => {
        const previous = post.relationship;
        patchLocalPost(post.id, {
          relationship: {
            status: 'outgoing',
            connectionRequestId: previous?.connectionRequestId ?? null,
          },
        });
        void requestConnect(post.author.id).then((requestId) => {
          if (requestId) {
            patchLocalPost(post.id, {
              relationship: {
                status: 'outgoing',
                connectionRequestId: requestId,
              },
            });
            return;
          }
          patchLocalPost(post.id, { relationship: previous });
        });
      }}
      onAccept={() => {
        acceptRequest(
          post.author.id,
          post.relationship?.connectionRequestId ?? undefined,
        );
        patchLocalPost(post.id, {
          feedSource: 'connection',
          relationship: {
            status: 'connected',
            connectionRequestId: null,
          },
        });
      }}
      onPressLikes={() => setLikesPostId(post.id)}
    />
    );
  };

  const feedPending = feedInitialPending(feedPhase);
  const catalogItemCount = serviceList.length + talentList.length;
  const hasContent =
    feedPosts.length > 0 ||
    jobList.length > 0 ||
    serviceList.length > 0 ||
    talentList.length > 0;
  const anyPending = feedPending || jobsLoading || catalogLoading;
  const hasVisibleError =
    sectionHasVisibleError({ error: feedError, itemCount: feedPosts.length }) ||
    sectionHasVisibleError({ error: jobsError, itemCount: jobList.length }) ||
    sectionHasVisibleError({ error: catalogError, itemCount: catalogItemCount });
  const showInitialLoader = resolveHomeInitialLoader({
    hasContent,
    anyPending,
    refreshing,
    hasVisibleError,
  });
  const pageEmpty = resolveHomePageEmpty({
    hasContent,
    anyPending,
    allFailed:
      !hasContent &&
      !anyPending &&
      Boolean(feedError && jobsError && catalogError),
  });
  const feedAppearance = resolveHomeSectionAppearance({
    itemCount: feedPosts.length,
    loading: feedPending,
    error: feedError,
    showInitialLoader,
    showSettledEmpty: true,
  });
  const jobsAppearance = resolveHomeSectionAppearance({
    itemCount: jobList.length,
    loading: jobsLoading,
    error: jobsError,
    showInitialLoader,
    showSettledEmpty: true,
  });
  const catalogAppearance = resolveHomeSectionAppearance({
    itemCount: catalogItemCount,
    loading: catalogLoading,
    error: catalogError,
    showInitialLoader,
  });
  const showPagination = resolveHomePaginationIndicator({
    showInitialLoader,
    loadingMore,
  });

  return (
    <ScreenContainer padded={false} safeBottom={false} safeTop={false}>
      <StatusBar style="dark" />
      <AppHeader
        onAvatarPress={openSidebar}
        onNotificationPress={() => navigation.navigate('Notifications')}
        notificationCount={unreadCount}
      />

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          showInitialLoader ? styles.scrollFill : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 240;
          if (nearBottom && hasMore && !loadingMore) {
            void loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {showInitialLoader ? <HomeSplashLoader fill /> : null}

        {feedAppearance === 'placeholder' ? <HomePendingPlaceholder /> : null}
        {feedAppearance === 'error' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.error }}>{feedError}</Text>
            <TouchableOpacity onPress={() => void refreshFeed()}>
              <Text
                style={{
                  ...typography.bodySmall,
                  color: colors.primary,
                  fontWeight: '600',
                  marginTop: spacing.xs,
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {feedAppearance === 'empty' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>
              No posts yet. Follow people and share your work to fill Home.
            </Text>
          </View>
        ) : null}

        {feedPosts[0] ? renderFeedPost(feedPosts[0]) : null}

        {jobsAppearance !== 'omit' ? (
          <SectionHeader
            title="Jobs matches for you"
            onPress={() => openExplore('jobs')}
          />
        ) : null}
        {jobsAppearance === 'placeholder' ? <HomePendingPlaceholder /> : null}
        {jobsAppearance === 'error' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.error }}>{jobsError}</Text>
            <TouchableOpacity
              onPress={() => {
                void (async () => {
                  setJobsLoading(jobList.length === 0);
                  setJobsError(null);
                  try {
                    const jobs = await jobService.refresh();
                    setJobList(jobs);
                    setJobsError(null);
                    setJobsLoading(false);
                  } catch (e) {
                    setJobsError(
                      e instanceof Error ? e.message : 'Failed to load jobs',
                    );
                    setJobsLoading(false);
                  }
                })();
              }}
            >
              <Text
                style={{
                  ...typography.bodySmall,
                  color: colors.primary,
                  fontWeight: '600',
                  marginTop: spacing.xs,
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {jobsAppearance === 'empty' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>
              No open job listings yet.
            </Text>
          </View>
        ) : null}
        {jobsAppearance === 'content' ? (
          <FlatList
            data={jobList}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => (
              <JobMatchCard
                job={item}
                onPress={() =>
                  navigation.navigate('JobListingDetail', { listingId: item.id })
                }
                onDismiss={() =>
                  setJobList((prev) => prev.filter((j) => j.id !== item.id))
                }
              />
            )}
          />
        ) : null}

        {feedPosts[1] ? renderFeedPost(feedPosts[1]) : null}

        {catalogAppearance === 'placeholder' ? <HomePendingPlaceholder /> : null}
        {catalogAppearance === 'error' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.error }}>
              {catalogError}
            </Text>
            <TouchableOpacity onPress={retryCatalog}>
              <Text
                style={{
                  ...typography.bodySmall,
                  color: colors.primary,
                  fontWeight: '600',
                  marginTop: spacing.xs,
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {serviceList.length > 0 ? (
          <>
            <SectionHeader
              title="Services for you"
              onPress={() => openExplore('services')}
            />
            <FlatList
              data={serviceList}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <ServiceMatchCard
                  service={item}
                  onPress={() =>
                    navigation.navigate(
                      'ServiceDetail',
                      serviceDetailRoute(item.id, item.provider.id, me.id),
                    )
                  }
                  onDismiss={() =>
                    setServiceList((prev) => prev.filter((s) => s.id !== item.id))
                  }
                />
              )}
            />
          </>
        ) : null}

        {feedPosts[2] ? renderFeedPost(feedPosts[2]) : null}

        {talentList.length > 0 ? (
          <>
            <SectionHeader
              title="Talents for you"
              onPress={() => openExplore('talents')}
            />
            <FlatList
              data={talentList}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.carousel, styles.carouselLast]}
              renderItem={({ item }) => (
                <TalentMatchCard
                  talent={item}
                  onPress={() => openUserProfile(navigation, item.user.id, me.id)}
                  onDismiss={() =>
                    setTalentList((prev) => prev.filter((t) => t.id !== item.id))
                  }
                />
              )}
            />
          </>
        ) : null}

        {feedPosts.slice(3).map((post) => renderFeedPost(post))}
        {showPagination ? <HomeSplashLoader compact /> : null}
        {pageEmpty === 'empty' && feedAppearance !== 'empty' ? (
          <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>
              Nothing to show on Home yet.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <PostLikesModal
        visible={Boolean(likesPostId)}
        postId={likesPostId}
        onClose={() => setLikesPostId(null)}
        onOpenProfile={(userId) => openUserProfile(navigation, userId, me.id)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 120 },
  scrollFill: { flexGrow: 1 },
  storiesList: {
    paddingHorizontal: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  storyItem: { alignItems: 'center', width: 72 },
  storyCard: {
    width: 68,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.border,
  },
  storyCardActive: { borderColor: colors.primary },
  storyImage: { width: '100%', height: '100%', borderRadius: 8 },
  storyAddButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  storyName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: 72,
  },
  feedCard: {
    backgroundColor: colors.white,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
  feedHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedAvatar: { width: 40, height: 40, borderRadius: radius.avatar },
  feedAuthor: { flex: 1 },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedAuthorName: { ...typography.label, color: colors.text },
  feedRole: { ...typography.caption, color: colors.textSecondary },
  discoveryLabel: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  connectBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  connectBtnText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  connectBtnMuted: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
  },
  connectBtnMutedText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  feedTime: { ...typography.caption, color: colors.textSecondary },
  feedCaption: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
    paddingHorizontal: spacing.screen,
  },
  seeMore: { color: colors.primary },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
  },
  feedAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedActionCount: { ...typography.bodySmall, color: colors.textTertiary },
  feedActionSpacer: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  carousel: {
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  carouselLast: {
    paddingBottom: spacing.xxxl,
  },
  matchCard: {
    width: 280,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardDismiss: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  jobTop: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingRight: 20,
  },
  jobLogo: { width: 48, height: 48, borderRadius: 8 },
  talentAvatar: { width: 48, height: 48, borderRadius: 24 },
  jobLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobLogoText: { ...typography.label, color: colors.textSecondary },
  jobInfo: { flex: 1 },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  jobTitle: { ...typography.label, color: colors.text, flexShrink: 1 },
  jobTypeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jobTypeText: { ...typography.caption, color: '#193CB8', fontSize: 11 },
  jobCompany: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingInlineText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  ratingCountText: { ...typography.caption, color: colors.textSecondary },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  jobMetaText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
