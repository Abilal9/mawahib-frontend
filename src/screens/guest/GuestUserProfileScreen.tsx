import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import ProfileTabs from '../../components/profile/ProfileTabs';
import ProfileCollapsingHeader from '../../components/profile/ProfileCollapsingHeader';
import ProfileHeaderChrome, {
  PROFILE_FIXED_BAR_BODY,
} from '../../components/profile/ProfileHeaderChrome';
import ProfileVisitorActions from '../../components/profile/ProfileVisitorActions';
import AboutTab from '../../components/profile/AboutTab';
import GuestScreenHeader from '../../components/guest/GuestScreenHeader';
import {
  GuestPortfolioCard,
  GuestPostCard,
  GuestServiceCard,
  GuestStatusBlock,
  guestLocationLabel,
} from '../../components/guest/GuestDiscoveryCards';
import { useGuestProfile } from '../../hooks/useGuestProfile';
import { useAuthGate } from '../../context/AuthGateContext';
import { guestAboutToProfileContent } from '../../lib/guestAbout';
import { shareProfile } from '../../utils/shareProfile';
import { colors, spacing } from '../../theme';
import type { ProfileTab } from '../../data/types';
import type { SignedOutScreenProps } from '../../navigation/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TABS_FALLBACK = 56;

/**
 * Guest public profile container.
 * Reuses signed-in visitor chrome. Does not mount private providers.
 * Connect / Message / Request Work open the Auth Gate. No mutations.
 */
export default function GuestUserProfileScreen({
  route,
  navigation,
}: SignedOutScreenProps<'UserProfile'>) {
  const { userId } = route.params;
  const [tab, setTab] = useState<ProfileTab>('About');
  const [tabsHeight, setTabsHeight] = useState(TABS_FALLBACK);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const profileState = useGuestProfile(userId);
  const { requireAuth } = useAuthGate();
  const profile = profileState.profile;
  const location = guestLocationLabel(
    profile?.locationCity,
    profile?.locationCountry,
  );

  const fixedBarHeight = insets.top + PROFILE_FIXED_BAR_BODY;
  const scrollViewport = SCREEN_HEIGHT - fixedBarHeight;
  const tabContentMinHeight = Math.max(scrollViewport - tabsHeight, 240);

  const gate = (action: 'connect' | 'message' | 'request' | 'save' | 'like' | 'comment') =>
    requireAuth({
      action,
      route: 'UserProfile',
      params: { userId },
    });

  if (profileState.profileLoading) {
    return (
      <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
        <StatusBar style="dark" />
        <GuestScreenHeader onBack={() => navigation.goBack()} title="Profile" />
        <GuestStatusBlock loading />
      </ScreenContainer>
    );
  }

  if (profileState.notFound || !profile) {
    return (
      <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
        <StatusBar style="dark" />
        <GuestScreenHeader onBack={() => navigation.goBack()} title="Profile" />
        <GuestStatusBlock
          error={profileState.profileError || 'This profile is unavailable.'}
          onRetry={profileState.notFound ? undefined : profileState.refresh}
        />
      </ScreenContainer>
    );
  }

  const about = guestAboutToProfileContent(profile);

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="light" />
      <ProfileHeaderChrome
        topInset={insets.top}
        scrollY={scrollY}
        onBack={() => navigation.goBack()}
        rightIcon="share-outline"
        onRightPress={() =>
          shareProfile({ userId: profile.id, userName: profile.displayName })
        }
        coverUrl={profile.coverUrl}
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
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={profileState.refresh}
            tintColor={colors.primary}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        <ProfileCollapsingHeader
          user={{
            name: profile.displayName,
            title: profile.title,
            avatar: profile.avatarUrl,
            location,
            reviewSummary: profile.reviewSummary,
            rating: profile.reviewSummary.overall.average ?? 0,
            reviewCount: profile.reviewSummary.overall.count,
          }}
          scrollY={scrollY}
          onReviewsPress={() => navigation.navigate('Reviews', { userId: profile.id })}
        >
          <ProfileVisitorActions
            onConnect={() => gate('connect')}
            onMessage={() => gate('message')}
            onRequest={() => gate('request')}
          />
        </ProfileCollapsingHeader>

        <View onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
          <ProfileTabs active={tab} onChange={setTab} />
        </View>

        <View style={{ minHeight: tabContentMinHeight }}>
          {tab === 'About' ? <AboutTab content={about} isOwn={false} /> : null}

          {tab === 'Portfolio' ? (
            <View style={styles.grid}>
              {profileState.portfolio.loading ? <GuestStatusBlock loading /> : null}
              {profileState.portfolio.error ? (
                <GuestStatusBlock
                  error={profileState.portfolio.error}
                  onRetry={profileState.refresh}
                />
              ) : null}
              {!profileState.portfolio.loading &&
              profileState.portfolio.items.length === 0 &&
              !profileState.portfolio.error ? (
                <GuestStatusBlock emptyLabel="No public portfolio yet." />
              ) : null}
              {profileState.portfolio.items.map((project) => (
                <GuestPortfolioCard
                  key={project.id}
                  project={project}
                  onPress={() =>
                    navigation.navigate('PortfolioProjectDetail', {
                      projectId: project.id,
                      userId: profile.id,
                      title: project.title,
                      description: project.description,
                      images: project.images,
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          {tab === 'Services' ? (
            <View style={styles.section}>
              {profileState.services.loading ? <GuestStatusBlock loading /> : null}
              {profileState.services.error ? (
                <GuestStatusBlock
                  error={profileState.services.error}
                  onRetry={profileState.refresh}
                />
              ) : null}
              {!profileState.services.loading &&
              profileState.services.items.length === 0 &&
              !profileState.services.error ? (
                <GuestStatusBlock emptyLabel="No public services yet." />
              ) : null}
              {profileState.services.items.map((service) => (
                <GuestServiceCard
                  key={service.id}
                  service={service}
                  onPress={() =>
                    navigation.navigate('ServiceDetail', { serviceId: service.id })
                  }
                  onSave={() =>
                    requireAuth({
                      action: 'save',
                      route: 'ServiceDetail',
                      params: { serviceId: service.id },
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          {tab === 'Posts' ? (
            <View>
              {profileState.posts.loading ? <GuestStatusBlock loading /> : null}
              {profileState.posts.error ? (
                <GuestStatusBlock
                  error={profileState.posts.error}
                  onRetry={profileState.refresh}
                />
              ) : null}
              {!profileState.posts.loading &&
              profileState.posts.items.length === 0 &&
              !profileState.posts.error ? (
                <GuestStatusBlock emptyLabel="No public posts yet." />
              ) : null}
              {profileState.posts.items.map((post) => (
                <GuestPostCard
                  key={post.id}
                  post={post}
                  onPress={() =>
                    navigation.navigate('PostDetail', { postId: post.id })
                  }
                  onLike={() =>
                    requireAuth({
                      action: 'like',
                      route: 'PostDetail',
                      params: { postId: post.id },
                    })
                  }
                  onComment={() =>
                    requireAuth({
                      action: 'comment',
                      route: 'PostDetail',
                      params: { postId: post.id },
                    })
                  }
                  onSave={() =>
                    requireAuth({
                      action: 'save',
                      route: 'PostDetail',
                      params: { postId: post.id },
                    })
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
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
  section: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
});
