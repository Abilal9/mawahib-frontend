import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import GuestAccountEntry from '../../components/layout/GuestAccountEntry';
import { listPaddingAboveTabBar } from '../../components/layout/CustomTabBar';
import ExploreTaxonomyChipRow from '../../components/explore/ExploreTaxonomyChipRow';
import {
  GuestJobCard,
  GuestServiceCard,
  GuestStatusBlock,
  GuestTalentCard,
} from '../../components/guest/GuestDiscoveryCards';
import { useGuestExplore } from '../../hooks/useGuestExplore';
import { useAuthGate } from '../../context/AuthGateContext';
import { exploreTabs, type ExploreTab } from '../../data/mock/explore';
import { colors, spacing, radius, typography } from '../../theme';
import type { GuestTabScreenProps } from '../../navigation/types';

function normalizeTab(value: string | undefined): ExploreTab {
  if (value === 'services' || value === 'jobs' || value === 'talents') return value;
  return 'talents';
}

/** Public Explore. Taxonomy chips send canonical categoryIds, ANDed with typed `q`. */
export default function GuestExploreScreen({
  navigation,
  route,
}: GuestTabScreenProps<'SearchTab'>) {
  const insets = useSafeAreaInsets();
  const [searchOpen, setSearchOpen] = useState(false);
  const explore = useGuestExplore(normalizeTab(route.params?.contentType));
  const { requireAuth } = useAuthGate();

  useEffect(() => {
    if (route.params?.contentType) {
      explore.setTab(normalizeTab(route.params.contentType));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.contentType]);

  const emptyTitle =
    explore.tab === 'talents'
      ? 'No talents found'
      : explore.tab === 'services'
        ? 'No services found'
        : 'No jobs found';

  return (
    <ScreenContainer padded={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        {searchOpen ? (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchField}
              placeholder={`Search ${explore.tab}...`}
              placeholderTextColor={colors.textSecondary}
              value={explore.query}
              onChangeText={explore.setQuery}
              maxLength={120}
              autoFocus
            />
            {explore.query.length > 0 ? (
              <TouchableOpacity onPress={() => explore.setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setSearchOpen(false);
                explore.setQuery('');
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.pageTitle}>Explore</Text>
            <View style={styles.topActions}>
              <GuestAccountEntry size={20} />
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setSearchOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.mainTabs}>
        {exploreTabs.map((item) => {
          const selected = explore.tab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.mainTab}
              onPress={() => explore.setTab(item.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.mainTabLabel, selected && styles.mainTabLabelActive]}>
                <Text style={[styles.mainTabText, selected && styles.mainTabTextActive]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ExploreTaxonomyChipRow
        categories={explore.categories}
        selectedIds={explore.categoryIds}
        onToggle={explore.toggleCategory}
        loading={explore.taxonomyLoading && explore.categories.length === 0}
        failed={Boolean(explore.taxonomyError) && explore.categories.length === 0}
        onRetry={explore.retryTaxonomy}
        filterCount={explore.categoryIds.length}
        onClear={explore.clearCategories}
      />

      {explore.searchBlocked ? (
        <Text style={styles.hint}>Type at least 2 characters to search.</Text>
      ) : null}

      <FlatList
        data={explore.items}
        keyExtractor={(item) =>
          item.kind === 'talent'
            ? item.talent.id
            : item.kind === 'service'
              ? item.service.id
              : item.job.id
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.screen,
          paddingBottom: listPaddingAboveTabBar(insets.bottom, spacing.xl),
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={explore.refreshing}
            onRefresh={explore.refresh}
            tintColor={colors.primary}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={explore.loadMore}
        ListEmptyComponent={
          <GuestStatusBlock
            loading={explore.initialLoading}
            error={explore.error}
            emptyLabel={explore.initialLoading ? undefined : emptyTitle}
            onRetry={explore.refresh}
          />
        }
        ListFooterComponent={
          explore.loadingMore ? (
            <GuestStatusBlock loading />
          ) : explore.error && explore.items.length > 0 ? (
            <GuestStatusBlock error={explore.error} onRetry={explore.refresh} />
          ) : undefined
        }
        renderItem={({ item }) => {
          if (item.kind === 'talent') {
            return (
              <GuestTalentCard
                talent={item.talent}
                onPress={() =>
                  navigation.navigate('UserProfile', { userId: item.talent.id })
                }
                onConnect={() =>
                  requireAuth({
                    action: 'connect',
                    route: 'UserProfile',
                    params: { userId: item.talent.id },
                  })
                }
              />
            );
          }
          if (item.kind === 'service') {
            return (
              <GuestServiceCard
                service={item.service}
                onPress={() =>
                  navigation.navigate('ServiceDetail', {
                    serviceId: item.service.id,
                  })
                }
                onProviderPress={() =>
                  navigation.navigate('UserProfile', {
                    userId: item.service.provider.id,
                  })
                }
                onSave={() =>
                  requireAuth({
                    action: 'save',
                    route: 'ServiceDetail',
                    params: { serviceId: item.service.id },
                  })
                }
              />
            );
          }
          return (
            <GuestJobCard
              job={item.job}
              onPress={() =>
                navigation.navigate('JobListingDetail', {
                  listingId: item.job.id,
                })
              }
              onSave={() =>
                requireAuth({
                  action: 'save',
                  route: 'JobListingDetail',
                  params: { listingId: item.job.id },
                })
              }
            />
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 48,
  },
  pageTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.text },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchField: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  cancelText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  mainTabs: { flexDirection: 'row', paddingHorizontal: spacing.screen },
  mainTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  mainTabLabel: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  mainTabLabelActive: { borderBottomColor: colors.primary },
  mainTabText: { ...typography.body, color: colors.textSecondary },
  mainTabTextActive: { color: colors.text, fontWeight: '600' },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
});
