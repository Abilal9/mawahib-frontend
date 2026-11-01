import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import GuestAppHeader from '../../components/layout/GuestAppHeader';
import { listPaddingAboveTabBar } from '../../components/layout/CustomTabBar';
import HomeSplashLoader from '../../components/ui/HomeSplashLoader';
import HomePendingPlaceholder from '../../components/ui/HomePendingPlaceholder';
import {
  GuestJobCard,
  GuestPostCard,
  GuestSectionHeader,
  GuestServiceCard,
  GuestStatusBlock,
  GuestTalentCard,
} from '../../components/guest/GuestDiscoveryCards';
import {
  useGuestHome,
  type GuestHomeSection,
  type GuestHomeSectionKey,
} from '../../hooks/useGuestHome';
import { useAuthGate } from '../../context/AuthGateContext';
import {
  resolveHomeInitialLoader,
  resolveHomePageEmpty,
  resolveHomeSectionAppearance,
  sectionHasVisibleError,
  type HomeSectionAppearance,
} from '../../lib/homeLoadingPresentation';
import { colors, spacing, typography } from '../../theme';
import type { GuestTabScreenProps } from '../../navigation/types';

function sectionPending<T>(section: GuestHomeSection<T>): boolean {
  return section.loading;
}

function GuestHomeSectionSlot({
  appearance,
  error,
  onRetry,
  children,
}: {
  appearance: HomeSectionAppearance;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (appearance === 'omit' || appearance === 'empty') return null;
  if (appearance === 'placeholder') return <HomePendingPlaceholder />;
  if (appearance === 'error') {
    return <GuestStatusBlock error={error} onRetry={onRetry} />;
  }
  return <>{children}</>;
}

/** Public discovery Home. No authenticated feed, providers, or viewer flags. */
export default function GuestHomeScreen({
  navigation,
}: GuestTabScreenProps<'HomeTab'>) {
  const insets = useSafeAreaInsets();
  const home = useGuestHome();
  const { requireAuth } = useAuthGate();
  const openExplore = (contentType?: 'talents' | 'services' | 'jobs') =>
    navigation.navigate('SearchTab', contentType ? { contentType } : undefined);

  const hasContent =
    home.talents.items.length > 0 ||
    home.services.items.length > 0 ||
    home.jobs.items.length > 0 ||
    home.posts.items.length > 0;
  const anyPending =
    sectionPending(home.talents) ||
    sectionPending(home.services) ||
    sectionPending(home.jobs) ||
    sectionPending(home.posts);
  const hasVisibleError =
    sectionHasVisibleError({
      error: home.talents.error,
      itemCount: home.talents.items.length,
    }) ||
    sectionHasVisibleError({
      error: home.services.error,
      itemCount: home.services.items.length,
    }) ||
    sectionHasVisibleError({
      error: home.jobs.error,
      itemCount: home.jobs.items.length,
    }) ||
    sectionHasVisibleError({
      error: home.posts.error,
      itemCount: home.posts.items.length,
    });
  const showInitialLoader = resolveHomeInitialLoader({
    hasContent,
    anyPending,
    refreshing: home.refreshing,
    hasVisibleError,
  });
  const pageEmpty = resolveHomePageEmpty({
    hasContent,
    anyPending,
    allFailed:
      !hasContent &&
      !anyPending &&
      Boolean(
        home.talents.error &&
          home.services.error &&
          home.jobs.error &&
          home.posts.error,
      ),
  });
  const appearanceFor = (section: GuestHomeSection<unknown>) =>
    resolveHomeSectionAppearance({
      itemCount: section.items.length,
      loading: section.loading,
      error: section.error,
      showInitialLoader,
    });

  const retry = (key: GuestHomeSectionKey) => () => home.retrySection(key);

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <GuestAppHeader />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: listPaddingAboveTabBar(insets.bottom, spacing.xl),
          flexGrow: showInitialLoader ? 1 : undefined,
        }}
        refreshControl={
          <RefreshControl
            refreshing={home.refreshing}
            onRefresh={home.refresh}
            tintColor={colors.primary}
          />
        }
      >
        {showInitialLoader ? <HomeSplashLoader fill /> : null}

        {pageEmpty === 'error' ? (
          <GuestStatusBlock
            error="Unable to load public discovery."
            onRetry={home.refresh}
          />
        ) : (
          <>
            <GuestHomeSectionSlot
              appearance={appearanceFor(home.talents)}
              error={home.talents.error}
              onRetry={retry('talents')}
            >
              <GuestSectionHeader
                title="Talents & businesses"
                onPress={() => openExplore('talents')}
              />
              <FlatList
                data={home.talents.items}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.carousel}
                renderItem={({ item }) => (
                  <GuestTalentCard
                    talent={item}
                    compact
                    onPress={() =>
                      navigation.navigate('UserProfile', { userId: item.id })
                    }
                    onConnect={() =>
                      requireAuth({
                        action: 'connect',
                        route: 'UserProfile',
                        params: { userId: item.id },
                      })
                    }
                  />
                )}
              />
            </GuestHomeSectionSlot>

            <GuestHomeSectionSlot
              appearance={appearanceFor(home.services)}
              error={home.services.error}
              onRetry={retry('services')}
            >
              <GuestSectionHeader
                title="Services"
                onPress={() => openExplore('services')}
              />
              <FlatList
                data={home.services.items}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.carousel}
                renderItem={({ item }) => (
                  <GuestServiceCard
                    service={item}
                    compact
                    onPress={() =>
                      navigation.navigate('ServiceDetail', {
                        serviceId: item.id,
                      })
                    }
                    onProviderPress={() =>
                      navigation.navigate('UserProfile', {
                        userId: item.provider.id,
                      })
                    }
                    onSave={() =>
                      requireAuth({
                        action: 'save',
                        route: 'ServiceDetail',
                        params: { serviceId: item.id },
                      })
                    }
                  />
                )}
              />
            </GuestHomeSectionSlot>

            <GuestHomeSectionSlot
              appearance={appearanceFor(home.jobs)}
              error={home.jobs.error}
              onRetry={retry('jobs')}
            >
              <GuestSectionHeader
                title="Open jobs"
                onPress={() => openExplore('jobs')}
              />
              <FlatList
                data={home.jobs.items}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.carousel}
                renderItem={({ item }) => (
                  <GuestJobCard
                    job={item}
                    compact
                    onPress={() =>
                      navigation.navigate('JobListingDetail', {
                        listingId: item.id,
                      })
                    }
                    onSave={() =>
                      requireAuth({
                        action: 'save',
                        route: 'JobListingDetail',
                        params: { listingId: item.id },
                      })
                    }
                  />
                )}
              />
            </GuestHomeSectionSlot>

            <GuestHomeSectionSlot
              appearance={appearanceFor(home.posts)}
              error={home.posts.error}
              onRetry={retry('posts')}
            >
              <GuestSectionHeader title="Newest posts" />
              {home.posts.items.map((post) => (
                <GuestPostCard
                  key={post.id}
                  post={post}
                  onPress={() =>
                    navigation.navigate('PostDetail', { postId: post.id })
                  }
                  onAuthorPress={() =>
                    navigation.navigate('UserProfile', {
                      userId: post.author.id,
                    })
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
            </GuestHomeSectionSlot>

            {pageEmpty === 'empty' ? (
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>Nothing public yet</Text>
                <Text style={styles.emptyText}>
                  Public talents, services, jobs, and posts will appear here.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  carousel: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  emptyCopy: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
  },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
});
