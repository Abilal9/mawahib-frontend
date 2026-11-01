import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { reviewCountLabel } from '../../utils/reviewSummary';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import MoneyAmount from '../../components/ui/MoneyAmount';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ProfileTabs from '../../components/profile/ProfileTabs';
import ProfileCollapsingHeader from '../../components/profile/ProfileCollapsingHeader';
import ProfileHeaderChrome, {
  PROFILE_FIXED_BAR_BODY,
} from '../../components/profile/ProfileHeaderChrome';
import AboutTab from '../../components/profile/AboutTab';
import ProfileVisitorActions from '../../components/profile/ProfileVisitorActions';
import ProfileFeedPost from '../../components/profile/ProfileFeedPost';
import ServiceMediaMosaic from '../../components/explore/ServiceMediaMosaic';
import { shareProfile } from '../../utils/shareProfile';
import { openUserProfile } from '../../utils/openUserProfile';
import { colors, spacing, radius, typography } from '../../theme';
import { ProfileTab, Post } from '../../data/types';
import { useConnections } from '../../context/ConnectionsContext';
import { useMyProfile } from '../../context/ProfileContext';
import { useSaved } from '../../context/SavedContext';
import { useVisitorProfessionalProfile } from '../../hooks/useVisitorProfessionalProfile';
import { useVisitorUser } from '../../hooks/useVisitorUser';
import { postService } from '../../services/postService';
import { displayProfileTitle } from '../../constants/profile';
import { ScreenProps } from '../../navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEDIA = (SCREEN_WIDTH - spacing.screen * 2 - spacing.sm * 2) / 3;
const TABS_FALLBACK = 56;
/** Extra touch padding so compact ~43px CTAs stay easy to tap. */
const ACTION_HIT_SLOP = { top: 6, bottom: 6, left: 2, right: 2 } as const;

export default function UserProfileScreen({ route, navigation }: ScreenProps<'UserProfile'>) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('About');
  const [unconnectOpen, setUnconnectOpen] = useState(false);
  const [messageOpening, setMessageOpening] = useState(false);
  const [tabsHeight, setTabsHeight] = useState(TABS_FALLBACK);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const {
    getRelation,
    requestConnect,
    cancelOutgoing,
    acceptRequest,
    denyRequest,
    disconnect,
    openOrCreateConversation,
    mutationBusy,
    refreshIfStale,
  } = useConnections();
  const { user: me } = useMyProfile();
  const saved = useSaved();
  const visitorProfessional = useVisitorProfessionalProfile(route.params.userId);
  const visitorUser = useVisitorUser(route.params.userId);
  const user = visitorUser.user;
  const [userPosts, setUserPosts] = useState<Post[]>([]);

  useFocusEffect(
    useCallback(() => {
      visitorUser.refresh();
      void refreshIfStale(15_000);
    }, [visitorUser.refresh, refreshIfStale]),
  );

  const liveRelation = user?.id ? getRelation(user.id) : 'none';
  const previousRelation = useRef(liveRelation);
  useEffect(() => {
    if (
      previousRelation.current !== 'connected' &&
      liveRelation === 'connected' &&
      user?.id
    ) {
      visitorUser.refresh();
    }
    previousRelation.current = liveRelation;
  }, [liveRelation, user?.id, visitorUser.refresh]);

  useEffect(() => {
    if (!user?.id || user.id === me.id) {
      setUserPosts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const page = await postService.listUserPosts(user.id);
        if (!cancelled) setUserPosts(page.items);
      } catch {
        if (!cancelled) setUserPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, me.id]);

  const fixedBarHeight = insets.top + PROFILE_FIXED_BAR_BODY;
  const scrollViewport = SCREEN_HEIGHT - fixedBarHeight;
  const tabContentMinHeight = Math.max(scrollViewport - tabsHeight, 240);

  useEffect(() => {
    if (user?.id && user.id === me.id) {
      navigation.replace('Profile');
    }
  }, [user?.id, me.id, navigation]);

  if (visitorUser.loading) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Loading profile…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>
            {visitorUser.error || 'User not found'}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.missingBack}>
            <Text style={styles.missingBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (user.id === me.id) {
    return (
      <ScreenContainer>
        <Text>Opening your profile…</Text>
      </ScreenContainer>
    );
  }

  const relation = getRelation(user.id);
  const profileUser = {
    ...user,
    title: displayProfileTitle(user.title),
    rating: user.rating ?? 0,
    reviewCount: user.reviewCount ?? 0,
  };

  const onConnectPress = () => {
    if (relation === 'none') {
      requestConnect(user.id);
      return;
    }
    if (relation === 'outgoing') {
      cancelOutgoing(user.id);
      return;
    }
    if (relation === 'connected') {
      setUnconnectOpen(true);
    }
  };

  const onMessagePress = () => {
    if (relation !== 'connected') {
      Alert.alert(
        'Connect to message',
        'You can only message people you’re connected with. Send a connection request first.',
      );
      return;
    }
    if (messageOpening) return;
    setMessageOpening(true);
    void (async () => {
      try {
        const conversationId = await openOrCreateConversation(user.id);
        navigation.navigate('Chat', { conversationId });
      } catch (e) {
        Alert.alert(
          'Could not open chat',
          e instanceof Error ? e.message : 'Please try again.',
        );
      } finally {
        setMessageOpening(false);
      }
    })();
  };

  const connectLabel =
    relation === 'connected'
      ? 'Connected'
      : relation === 'outgoing'
        ? 'Requested'
        : relation === 'incoming'
          ? 'Respond'
          : 'Connect';

  const connectIcon: keyof typeof Ionicons.glyphMap =
    relation === 'connected'
      ? 'checkmark'
      : relation === 'outgoing'
        ? 'time-outline'
        : 'person-add-outline';

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="light" />

      <ProfileHeaderChrome
        topInset={insets.top}
        scrollY={scrollY}
        onBack={() => navigation.goBack()}
        rightIcon="share-outline"
        onRightPress={() =>
          shareProfile({ userId: user.id, userName: user.name })
        }
        coverUrl={user.coverImage}
      />

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <ProfileCollapsingHeader
          user={profileUser}
          scrollY={scrollY}
          onReviewsPress={() => navigation.navigate('Reviews', { userId: user.id })}
          onConnectionsPress={() =>
            navigation.navigate('Connections', { userId: user.id })
          }
          connectionsLabel={
            typeof user.connectionsCount === 'number'
              ? `${user.connectionsCount} connection${
                  user.connectionsCount === 1 ? '' : 's'
                }`
              : 'Connections'
          }
        >
          {relation === 'incoming' ? (
            <>
            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={() => acceptRequest(user.id)}
                disabled={mutationBusy}
                activeOpacity={0.85}
                hitSlop={ACTION_HIT_SLOP}
              >
                <Ionicons name="checkmark" size={19} color={colors.white} />
                <Text style={styles.connectText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageBtn}
                onPress={() => denyRequest(user.id)}
                disabled={mutationBusy}
                activeOpacity={0.85}
                hitSlop={ACTION_HIT_SLOP}
              >
                <Ionicons name="close" size={19} color={colors.primary} />
                <Text style={styles.messageText}>Deny</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.hireRow}>
              <TouchableOpacity
                style={styles.hireBtn}
                onPress={() =>
                  navigation.navigate('DirectRequest', { userId: user.id })
                }
                activeOpacity={0.85}
                hitSlop={ACTION_HIT_SLOP}
              >
                <Ionicons name="briefcase-outline" size={17} color={colors.primary} />
                <Text style={styles.hireText}>Request Work</Text>
              </TouchableOpacity>
            </View>
            </>
          ) : (
            <ProfileVisitorActions
              connectLabel={connectLabel}
              connectIcon={connectIcon}
              connectTone={
                relation === 'connected'
                  ? 'done'
                  : relation === 'outgoing'
                    ? 'pending'
                    : 'default'
              }
              messageEnabled={relation === 'connected'}
              busy={mutationBusy}
              onConnect={onConnectPress}
              onMessage={onMessagePress}
              onRequest={() =>
                navigation.navigate('DirectRequest', { userId: user.id })
              }
            />
          )}
        </ProfileCollapsingHeader>

        <View onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
          <ProfileTabs active={activeTab} onChange={setActiveTab} />
        </View>

        {visitorProfessional.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              {visitorProfessional.error}
            </Text>
          </View>
        ) : null}

        <View style={{ minHeight: tabContentMinHeight }}>
          {activeTab === 'About' && (
            <AboutTab
              content={{
                ...visitorUser.about,
                portfolio: visitorProfessional.portfolio,
                services: visitorProfessional.services,
              }}
              isOwn={false}
            />
          )}

          {activeTab === 'Portfolio' &&
            (visitorProfessional.loading ? (
              <View style={styles.tabPad}>
                <Text style={styles.emptyCopy}>Loading portfolio…</Text>
              </View>
            ) : visitorProfessional.portfolio.length === 0 ? (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Portfolio</Text>
                </View>
                <Text style={styles.emptyCopy}>No portfolio projects yet.</Text>
              </View>
            ) : (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Portfolio</Text>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() =>
                      shareProfile({ userId: user.id, userName: user.name })
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="share-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {visitorProfessional.portfolio.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.projectCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate('PortfolioProjectDetail', {
                        projectId: project.id,
                        userId: user.id,
                      })
                    }
                  >
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <Text style={styles.projectDesc} numberOfLines={2}>
                      {project.description}
                    </Text>
                    <View style={styles.mediaGrid}>
                      {project.images.slice(0, 3).map((uri, index) => {
                        const videoIdx =
                          project.videoIndex ?? project.images.length - 1;
                        return (
                          <View
                            key={`${project.id}-${index}`}
                            style={styles.mediaImageWrap}
                          >
                            <Image
                              source={{ uri }}
                              style={styles.mediaImage}
                              contentFit="cover"
                            />
                            {project.hasVideo && index === videoIdx ? (
                              <View style={styles.playOverlay}>
                                <Ionicons name="play" size={18} color={colors.white} />
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

          {activeTab === 'Services' &&
            (visitorProfessional.loading ? (
              <View style={styles.tabPad}>
                <Text style={styles.emptyCopy}>Loading services…</Text>
              </View>
            ) : visitorProfessional.services.length === 0 ? (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Services</Text>
                </View>
                <Text style={styles.emptyCopy}>No services listed yet.</Text>
              </View>
            ) : (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Services</Text>
                </View>
                {visitorProfessional.services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate('ServiceDetail', {
                        serviceId: service.id,
                        userId: user.id,
                      })
                    }
                  >
                    <ServiceMediaMosaic images={service.images} height={180} />
                    <View style={styles.serviceBody}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>{service.title}</Text>
                        <BookmarkButton
                          kind="service"
                          saved={saved.isSaved(
                            'service',
                            service.id,
                            Boolean(service.isSaved),
                          )}
                          onPress={() => {
                            const shown = saved.isSaved(
                              'service',
                              service.id,
                              Boolean(service.isSaved),
                            );
                            void saved.setDesired(
                              'service',
                              service.id,
                              !shown,
                              Boolean(service.isSaved),
                            );
                          }}
                        />
                        {(service.reviewCount ?? 0) > 0 ? (
                          <TouchableOpacity
                            style={styles.ratingInline}
                            onPress={() =>
                              navigation.navigate('Reviews', { userId: user.id })
                            }
                            activeOpacity={0.8}
                          >
                            <Ionicons name="star" size={14} color="#F5A623" />
                            <Text style={styles.ratingInlineText}>
                              {service.rating.toFixed(1)}
                            </Text>
                            <Text style={styles.reviewCount}>
                              ({reviewCountLabel(service.reviewCount ?? 0)})
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.reviewCount}>No reviews yet</Text>
                        )}
                      </View>
                      <Text style={styles.serviceDesc} numberOfLines={2}>
                        {service.description}
                      </Text>
                      {service.packages.map((pkg) => (
                        <View key={pkg.name} style={styles.priceRow}>
                          <Text style={styles.priceLabel}>{pkg.name}</Text>
                          <View style={styles.priceValueRow}>
                            <MoneyAmount
                              amount={
                                typeof pkg.price === 'number' ? pkg.price : 0
                              }
                              currency={
                                pkg.currency === 'AED' || pkg.currency === 'SAR'
                                  ? pkg.currency
                                  : service.currency === 'AED' ||
                                      service.currency === 'SAR'
                                    ? service.currency
                                    : user.defaultCurrency === 'AED' ||
                                        user.defaultCurrency === 'SAR'
                                      ? user.defaultCurrency
                                      : null
                              }
                              size={12}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

          {activeTab === 'Posts' && (
            <View style={styles.tabPad}>
              {userPosts.length === 0 ? (
                <Text style={styles.emptyCopy}>No posts yet.</Text>
              ) : (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Posts</Text>
                  </View>
                  {userPosts.slice(0, 2).map((post) => (
                    <ProfileFeedPost
                      key={post.id}
                      post={post}
                      saved={saved.isSaved('post', post.id, post.isSaved)}
                      onBookmark={() => {
                        const shown = saved.isSaved('post', post.id, post.isSaved);
                        void saved.setDesired('post', post.id, !shown, post.isSaved);
                      }}
                      onPress={() =>
                        navigation.navigate('PostDetail', { postId: post.id })
                      }
                      onAuthorPress={() =>
                        openUserProfile(navigation, post.author.id, me.id)
                      }
                    />
                  ))}
                  {userPosts.length > 2 ? (
                    <TouchableOpacity
                      style={styles.viewMoreBtn}
                      onPress={() =>
                        navigation.navigate('UserPosts', { userId: user.id })
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewMoreText}>View more</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <Modal
        visible={unconnectOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnconnectOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUnconnectOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Unconnect?</Text>
            <Text style={styles.modalBody}>
              Are you sure you want to unconnect? You’ll have to send a request again before
              connecting with this user.
            </Text>
            <TouchableOpacity
              style={styles.modalDangerBtn}
              onPress={() => {
                disconnect(user.id);
                setUnconnectOpen(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDangerText}>Unconnect</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setUnconnectOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ActionBusyOverlay visible={messageOpening} message="Opening chat…" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    backgroundColor: 'transparent',
  },
  ctaRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  connectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 43,
  },
  connectBtnDone: {
    backgroundColor: '#00A63E',
  },
  connectBtnPending: {
    backgroundColor: '#627D98',
  },
  connectText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.white },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 43,
  },
  messageBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  messageText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.primary },
  messageTextDisabled: { color: colors.textSecondary },
  hireRow: {
    paddingHorizontal: spacing.screen,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  hireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    minHeight: 41,
  },
  hireText: { ...typography.button, fontSize: 15, lineHeight: 18, color: colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.xl,
  },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  modalBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  modalDangerBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalDangerText: { ...typography.button, color: colors.white },
  modalCancelBtn: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { ...typography.button, color: colors.text },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  actionIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPad: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  projectCard: { gap: spacing.sm },
  projectTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '600' },
  projectDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  mediaImageWrap: {
    width: MEDIA,
    height: MEDIA,
    borderRadius: radius.button,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  serviceBody: { padding: spacing.md, gap: spacing.sm },
  serviceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceTitle: {
    flex: 1,
    ...typography.bodyMedium,
    fontWeight: '500',
    color: colors.text,
  },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingInlineText: { ...typography.caption, color: colors.text },
  reviewCount: { ...typography.caption, color: '#829AB1' },
  serviceDesc: { ...typography.caption, color: colors.textTertiary, lineHeight: 18 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  priceLabel: { ...typography.caption, color: colors.textSecondary },
  priceValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceValue: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  emptyCopy: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  errorBanner: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.error + '14',
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  missingText: { ...typography.body, color: colors.text, textAlign: 'center' },
  missingBack: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  missingBackText: { ...typography.button, color: colors.white },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '0A',
  },
  viewMoreText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 15,
  },
});
