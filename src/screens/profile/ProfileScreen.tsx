import React, { useCallback, useMemo, useRef, useState } from 'react';
import { chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import MoneyAmount from '../../components/ui/MoneyAmount';
import ProfileTabs from '../../components/profile/ProfileTabs';
import ProfileCollapsingHeader from '../../components/profile/ProfileCollapsingHeader';
import { reviewCountLabel } from '../../utils/reviewSummary';
import ProfileHeaderChrome, {
  PROFILE_FIXED_BAR_BODY,
} from '../../components/profile/ProfileHeaderChrome';
import ProfileEmptyState from '../../components/profile/ProfileEmptyState';
import ProfileFeedPost from '../../components/profile/ProfileFeedPost';
import ServiceMediaMosaic from '../../components/explore/ServiceMediaMosaic';
import AboutTab from '../../components/profile/AboutTab';
import AboutCompletionPrompt from '../../components/profile/AboutCompletionPrompt';
import { shareProfile } from '../../utils/shareProfile';
import { openUserProfile } from '../../utils/openUserProfile';
import { getAboutCompletionState } from '../../utils/aboutCompletion';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { useMyProfile } from '../../context/ProfileContext';
import { useAuth } from '../../context/AuthContext';
import { accessTokenSubject } from '../../lib/apiClient';
import { useSaved } from '../../context/SavedContext';
import { useConnections } from '../../context/ConnectionsContext';
import { postService } from '../../services/postService';
import {
  Post,
  ProfileTab,
  AboutSectionKey,
} from '../../data/types';
import { ScreenProps } from '../../navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEDIA = (SCREEN_WIDTH - spacing.screen * 2 - spacing.sm * 2) / 3;
const TABS_FALLBACK = 56;

export default function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const [activeTab, setActiveTab] = React.useState<ProfileTab>('About');
  const [tabsHeight, setTabsHeight] = React.useState(TABS_FALLBACK);
  const [completionPromptOpen, setCompletionPromptOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { user, content, aboutHydrated, profileError, refreshProfessionalProfile } =
    useMyProfile();
  const { accessToken, refreshMe } = useAuth();
  const saved = useSaved();
  const { connectedUsers } = useConnections();
  const [userPosts, setUserPosts] = useState<Post[]>([]);

  useFocusEffect(
    useCallback(() => {
      const token = accessToken;
      if (token && accessTokenSubject(token) === user.id) {
        void refreshMe(token).catch(() => undefined);
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
    }, [user.id, accessToken, refreshMe]),
  );

  const aboutCompletion = useMemo(
    () => getAboutCompletionState(content),
    [content],
  );
  const showAboutCompletionBanner =
    aboutHydrated && !aboutCompletion.complete;

  const fixedBarHeight = insets.top + PROFILE_FIXED_BAR_BODY;
  const scrollViewport = SCREEN_HEIGHT - fixedBarHeight;
  const tabContentMinHeight = Math.max(scrollViewport - tabsHeight, 240);

  const openAboutAdd = (key: AboutSectionKey) => {
    navigation.navigate('EditAboutSection', { section: key });
  };

  const openAboutSection = (key: AboutSectionKey) => {
    navigation.navigate('EditAboutSection', { section: key });
  };

  const openAboutItem = (key: AboutSectionKey, itemId: string) => {
    navigation.navigate('EditAboutSection', { section: key, itemId });
  };

  const openCompletionSection = (key: AboutSectionKey) => {
    setCompletionPromptOpen(false);
    navigation.navigate('EditAboutSection', { section: key });
  };

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="light" />

      <ProfileHeaderChrome
        topInset={insets.top}
        scrollY={scrollY}
        onBack={() => navigation.goBack()}
        secondaryRightIcon="create-outline"
        onSecondaryRightPress={() => navigation.navigate('EditProfile')}
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
          user={user}
          scrollY={scrollY}
          onReviewsPress={() => navigation.navigate('Reviews', { userId: user.id })}
          onConnectionsPress={() => navigation.navigate('Connections')}
          connectionsLabel={t(
            connectedUsers.length === 1 ? 'profile.connectionOne' : 'profile.connectionOther',
            { count: connectedUsers.length },
          )}
        />

        <View onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
          <ProfileTabs active={activeTab} onChange={setActiveTab} />
        </View>

        {profileError ? (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={() => {
              void refreshProfessionalProfile();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.errorBannerText}>
              {t('profile.portfolioRetry')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Tall enough that short tabs can still scroll until sticky tabs pin */}
        <View style={{ minHeight: tabContentMinHeight }}>
          {activeTab === 'About' && (
            <>
              {showAboutCompletionBanner ? (
                <TouchableOpacity
                  style={styles.completeBanner}
                  onPress={() => setCompletionPromptOpen(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.completeBannerIcon}>
                    <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.completeBannerText}>
                    <Text style={styles.completeBannerTitle}>{t('profile.completeProfile')}</Text>
                    <Text style={styles.completeBannerSub}>{t('profile.completeProfileBody')}</Text>
                  </View>
                  <Ionicons name={chevronForwardIcon()} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
              <AboutTab
                content={content}
                isOwn
                onAdd={openAboutAdd}
                onEditSection={openAboutSection}
                onEditItem={openAboutItem}
              />
            </>
          )}

          {activeTab === 'Portfolio' &&
            (content.portfolio.length === 0 ? (
              <ProfileEmptyState
                icon="briefcase-outline"
                title={t('profile.noPortfolio')}
                description={t('profile.noPortfolioBody')}
                cta={t('profile.addPortfolio')}
                onPress={() => navigation.navigate('AddPortfolioProject')}
                showHeaderAdd
                headerTitle={t('profile.tabPortfolio')}
              />
            ) : (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('profile.tabPortfolio')}</Text>
                  <View style={styles.headerActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() =>
                        navigation.navigate('ManageProfileList', { type: 'portfolio' })
                      }
                      hitSlop={8}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => navigation.navigate('AddPortfolioProject')}
                    >
                      <Ionicons name="add-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() =>
                        shareProfile({ userId: user.id, userName: user.name })
                      }
                      hitSlop={8}
                    >
                      <Ionicons
                        name="share-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {content.portfolio.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.projectCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate('PortfolioProjectDetail', {
                        projectId: project.id,
                      })
                    }
                  >
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <Text style={styles.projectDesc} numberOfLines={2}>
                      {project.description}
                    </Text>
                    <View style={styles.mediaGrid}>
                      {project.images.slice(0, 3).map((uri, imgIndex) => {
                        const videoIdx =
                          project.videoIndex ?? project.images.length - 1;
                        return (
                          <View
                            key={`${project.id}-${imgIndex}`}
                            style={styles.mediaItem}
                          >
                            <Image
                              source={{ uri }}
                              style={styles.mediaImage}
                              contentFit="cover"
                            />
                            {project.hasVideo && imgIndex === videoIdx ? (
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
            (content.services.length === 0 ? (
              <ProfileEmptyState
                icon="document-text-outline"
                title={t('profile.noServices')}
                description={t('profile.noServicesBody')}
                cta={t('profile.addService')}
                onPress={() => navigation.navigate('AddProfileService')}
                showHeaderAdd
                headerTitle={t('profile.tabServices')}
              />
            ) : (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('profile.tabServices')}</Text>
                  <View style={styles.headerActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() =>
                        navigation.navigate('ManageProfileList', { type: 'services' })
                      }
                      hitSlop={8}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => navigation.navigate('AddProfileService')}
                    >
                      <Ionicons name="add-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                {content.services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate('ServiceDetail', {
                        serviceId: service.id,
                      })
                    }
                  >
                    <ServiceMediaMosaic images={service.images} height={180} />
                    <View style={styles.serviceBody}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>{service.title}</Text>
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
                          <Text style={styles.reviewCount}>{t('nav.noReviews')}</Text>
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

          {activeTab === 'Posts' &&
            (userPosts.length === 0 ? (
              <ProfileEmptyState
                icon="grid-outline"
                title={t('profile.firstPost')}
                description={t('profile.firstPostBody')}
                cta={t('profile.createPost')}
                onPress={() => navigation.navigate('PostCreate')}
                showHeaderAdd
                headerTitle={t('profile.tabPosts')}
              />
            ) : (
              <View style={styles.tabPad}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('profile.tabPosts')}</Text>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => navigation.navigate('PostCreate')}
                  >
                    <Ionicons name="add-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
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
                    onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                    onAuthorPress={() =>
                      openUserProfile(navigation, post.author.id, user.id)
                    }
                  />
                ))}
                {userPosts.length > 2 ? (
                  <TouchableOpacity
                    style={styles.viewMoreBtn}
                    onPress={() => navigation.navigate('UserPosts')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.viewMoreText}>{t('profile.viewMore')}</Text>
                    <Ionicons name={chevronForwardIcon()} size={18} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
        </View>
      </Animated.ScrollView>

      <AboutCompletionPrompt
        visible={completionPromptOpen}
        state={aboutCompletion}
        onClose={() => setCompletionPromptOpen(false)}
        onSelect={openCompletionSection}
      />
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
  completeBanner: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primary + '0F',
    borderWidth: 1,
    borderColor: colors.primary + '33',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  completeBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBannerText: {
    flex: 1,
    gap: 2,
  },
  completeBannerTitle: {
    ...typography.label,
    color: colors.text,
  },
  completeBannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
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
  tabPad: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectCard: { gap: spacing.sm },
  projectTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '600' },
  projectDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  mediaItem: {
    width: MEDIA,
    height: MEDIA,
    borderRadius: radius.button,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  mediaImage: { width: '100%', height: '100%' },
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
  serviceTitle: { flex: 1, ...typography.bodyMedium, fontWeight: '500', color: colors.text },
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
