import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  ScrollView,
  type ScrollViewInstance,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ui/ScreenContainer';
import MoneyAmount from '../../components/ui/MoneyAmount';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import UserAvatar from '../../components/ui/UserAvatar';
import {
  UserJob,
  UserJobSection,
  jobRecencyTime,
  jobTotalPrice,
  resolveJobDetails,
} from '../../data/types/userJobs';
import { TabScreenProps } from '../../navigation/types';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMyProfile } from '../../context/ProfileContext';
import { openUserProfile } from '../../utils/openUserProfile';
import { openEngagementReview } from '../../utils/openEngagementReview';
import EngagementReviewPrompt from '../../components/job/EngagementReviewPrompt';

type JobsTab = 'received' | 'sent';
type SectionSort = 'most-recent' | 'oldest' | 'due-date';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH - spacing.screen * 2;
const SECTION_BODY_MIN_HEIGHT = 220;

interface SectionSpec {
  key: UserJobSection;
  titleKey: MessageKey;
  dot: string;
  countColor: string;
  emptyKey: MessageKey;
  loadKey: MessageKey;
}

const RECEIVED_SECTIONS: SectionSpec[] = [
  {
    key: 'requests',
    titleKey: 'work.requests',
    dot: '#C084FC',
    countColor: '#8B5CF6',
    emptyKey: 'work.noRequests',
    loadKey: 'work.loadRequests',
  },
  {
    key: 'pending-payment',
    titleKey: 'status.pendingPayment',
    dot: '#60A5FA',
    countColor: '#2E6AC5',
    emptyKey: 'work.noPayments',
    loadKey: 'work.loadPayments',
  },
  {
    key: 'in-progress',
    titleKey: 'status.inProgress',
    dot: '#60A5FA',
    countColor: '#3B82F6',
    emptyKey: 'work.noProgress',
    loadKey: 'work.loadProgress',
  },
  {
    key: 'completed',
    titleKey: 'work.history',
    dot: '#22C55E',
    countColor: '#16A34A',
    emptyKey: 'work.noHistory',
    loadKey: 'work.loadHistory',
  },
];

const SENT_SECTIONS: SectionSpec[] = [
  {
    key: 'requests',
    titleKey: 'work.requests',
    dot: '#C084FC',
    countColor: '#8B5CF6',
    emptyKey: 'work.noRequests',
    loadKey: 'work.loadRequests',
  },
  {
    key: 'pending-payment',
    titleKey: 'status.pendingPayment',
    dot: '#60A5FA',
    countColor: '#2E6AC5',
    emptyKey: 'work.noPayments',
    loadKey: 'work.loadPayments',
  },
  {
    key: 'in-progress',
    titleKey: 'status.inProgress',
    dot: '#60A5FA',
    countColor: '#3B82F6',
    emptyKey: 'work.noProgress',
    loadKey: 'work.loadProgress',
  },
  {
    key: 'posted',
    titleKey: 'work.postedJobs',
    dot: '#F59E0B',
    countColor: '#B45309',
    emptyKey: 'work.noPosted',
    loadKey: 'work.loadPosted',
  },
  {
    key: 'completed',
    titleKey: 'work.history',
    dot: '#22C55E',
    countColor: '#16A34A',
    emptyKey: 'work.noHistory',
    loadKey: 'work.loadHistory',
  },
];

function sortJobs(
  items: UserJob[],
  sort: SectionSort,
  section?: UserJobSection,
) {
  const copy = [...items];
  if (sort === 'most-recent') {
    if (section === 'completed') {
      // History: completedAt → updatedAt → createdAt, newest first.
      return copy.sort((a, b) => jobRecencyTime(b) - jobRecencyTime(a));
    }
    return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  if (sort === 'oldest') {
    return copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }
  return copy.sort((a, b) => {
    const aDate = Date.parse(a.dueDate ?? a.date);
    const bDate = Date.parse(b.dueDate ?? b.date);
    if (Number.isNaN(aDate)) return 1;
    if (Number.isNaN(bDate)) return -1;
    return aDate - bDate;
  });
}

function getStatusTone(status: UserJob['status']) {
  switch (status) {
    case 'pending':
      return { bg: '#FCE7F3', text: '#BE185D' };
    case 'under-review':
      return { bg: '#FEF9C3', text: '#8A6A16' };
    case 'selected':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'changes-requested':
      return { bg: '#FEF9C3', text: '#8A6A16' };
    case 'changes-declined':
      return { bg: '#FFEDD5', text: '#C2410C' };
    case 'pending-payment':
      return { bg: '#E0ECFF', text: '#2E6AC5' };
    case 'rejected':
      return { bg: '#FEE2E2', text: '#B91C1C' };
    case 'withdrawn':
      return { bg: '#EEF2F6', text: colors.textSecondary };
    case 'in-progress':
    case 'delivered':
      return { bg: '#DBEAFE', text: '#1D4ED8' };
    case 'disputed':
      return { bg: '#FFEDD5', text: '#C2410C' };
    case 'completed':
      return { bg: '#DCFCE7', text: '#15803D' };
    default:
      return { bg: '#EEF2F6', text: colors.textSecondary };
  }
}

function SectionBodyState({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.sectionBody}>{children}</View>;
}

function JobFlowCard({
  job,
  onPress,
  onCounterpartPress,
  onStarPress,
  hideStatus,
  showReviewPrompt,
}: {
  job: UserJob;
  onPress: () => void;
  onCounterpartPress: () => void;
  onStarPress?: (rating: number) => void;
  hideStatus?: boolean;
  showReviewPrompt?: boolean;
}) {
  const tone = getStatusTone(job.status);
  const showStars = !!showReviewPrompt;
  const details = resolveJobDetails(job);
  const total = jobTotalPrice(details);
  const showMoney =
    job.source !== 'posted_listing' &&
    total > 0 &&
    !!details.currencySymbol;

  return (
    <TouchableOpacity
      style={styles.receivedJobCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.badgeRow}>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>{job.sourceLabel}</Text>
        </View>
        {job.unread ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.receivedTopRow}>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.title}
        </Text>
        <View style={styles.statusAndChevron}>
          {!hideStatus ? (
            <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusText, { color: tone.text }]}>
                {job.statusLabel}
              </Text>
            </View>
          ) : null}
          <Ionicons name={chevronForwardIcon()} size={16} color={colors.border} />
        </View>
      </View>

      <View style={styles.metaLine}>
        <Text style={styles.metaLabel}>{t('work.user')}</Text>
        <TouchableOpacity
          style={styles.userInline}
          onPress={(e) => {
            e.stopPropagation?.();
            onCounterpartPress();
          }}
          activeOpacity={0.8}
        >
          <UserAvatar
            uri={job.counterpart.avatar}
            size={22}
            style={styles.userAvatar}
          />
          <Text style={styles.metaValue}>{job.counterpart.name}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.metaSeparator} />
      <View style={styles.metaLine}>
        <Text style={styles.metaLabel}>{t('work.requested')}</Text>
        <View style={styles.userInline}>
          <Ionicons name="time-outline" size={14} color="#3F78B7" />
          <Text style={styles.dateValue}>{job.date}</Text>
        </View>
      </View>
      {showMoney ? (
        <>
          <View style={styles.metaSeparator} />
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>{t('work.total')}</Text>
            <MoneyAmount
              amount={total}
              currency={details.currencySymbol}
              size={14}
            />
          </View>
        </>
      ) : null}
      {job.activityLabel ? (
        <>
          <View style={styles.metaSeparator} />
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>{job.activityLabel}</Text>
            <Text style={styles.activityValue}>{job.activityValue ?? ''}</Text>
          </View>
        </>
      ) : null}
      {showStars ? (
        <>
          <View style={styles.metaSeparator} />
          <EngagementReviewPrompt
            compact
            otherName={job.counterpart.name}
            existingRating={job.rating}
            canSubmit={job.reviewState?.canSubmit}
            windowClosesAt={job.reviewState?.windowClosesAt}
            published={job.reviewState?.published}
            onSelectRating={(value) => onStarPress?.(value)}
          />
        </>
      ) : null}
    </TouchableOpacity>
  );
}

export default function JobsScreen({
  navigation,
  route,
}: TabScreenProps<'JobsTab'>) {
  const { jobs: userJobs, loading, error, unread, refresh } = useUserJobs();
  const { user: me } = useMyProfile();
  /** Canonical default on mount / tab-bar press: Received → Requests. */
  const [activeTab, setActiveTab] = useState<JobsTab>('received');
  const [activePage, setActivePage] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortSection, setSortSection] = useState<UserJobSection>('requests');
  const [sectionSort, setSectionSort] = useState<
    Record<UserJobSection, SectionSort>
  >({
    requests: 'most-recent',
    'pending-payment': 'most-recent',
    'in-progress': 'most-recent',
    completed: 'most-recent',
    posted: 'most-recent',
  });
  const pagerRef = useRef<ScrollViewInstance>(null);
  const pendingSection = useRef<UserJobSection | null>(null);
  const [landingNonce, setLandingNonce] = useState(0);
  const scrollOffsets = useRef<Record<string, number>>({});
  const sectionScrollRefs = useRef<Record<string, ScrollViewInstance | null>>({});
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  const applyLanding = useCallback(
    (landing: { tab?: JobsTab; section?: UserJobSection }) => {
      if (landing.tab === 'sent' || landing.tab === 'received') {
        setActiveTab(landing.tab);
      }
      pendingSection.current = landing.section ?? 'requests';
      setLandingNonce((n) => n + 1);
    },
    [],
  );

  /**
   * Tab-bar press = fresh Jobs visit → canonical Received → Requests.
   * Does not run when returning via Back from a detail screen.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      applyLanding({ tab: 'received', section: 'requests' });
    });
    return unsubscribe;
  }, [navigation, applyLanding]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const landing = route.params;
      const hasLanding =
        landing?.tab === 'sent' ||
        landing?.tab === 'received' ||
        Boolean(landing?.section);

      if (hasLanding) {
        applyLanding({
          tab: landing?.tab,
          section: landing?.section,
        });
        navigation.setParams({ tab: undefined, section: undefined });
        return;
      }

      // Back / re-focus without override: restore scroll positions.
      requestAnimationFrame(() => {
        const x = activePageRef.current * (PANEL_WIDTH + spacing.md);
        pagerRef.current?.scrollTo({ x, animated: false });
        Object.entries(scrollOffsets.current).forEach(([key, y]) => {
          if (y > 0) {
            sectionScrollRefs.current[key]?.scrollTo({ y, animated: false });
          }
        });
      });
    }, [refresh, route.params, navigation, applyLanding]),
  );

  const sections = activeTab === 'received' ? RECEIVED_SECTIONS : SENT_SECTIONS;

  useEffect(() => {
    const target = pendingSection.current;
    if (!target) return;
    const idx = sections.findIndex((s) => s.key === target);
    if (idx < 0) return;
    pendingSection.current = null;
    setActivePage(idx);
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({
        x: idx * (PANEL_WIDTH + spacing.md),
        animated: false,
      });
    });
  }, [activeTab, sections, userJobs.length, landingNonce]);

  const sectioned = useMemo(() => {
    const scoped = userJobs.filter((j) => j.type === activeTab);
    const result = {} as Record<UserJobSection, UserJob[]>;
    sections.forEach((section) => {
      result[section.key] = sortJobs(
        scoped.filter((j) => j.section === section.key),
        sectionSort[section.key],
        section.key,
      );
    });
    return result;
  }, [userJobs, activeTab, sections, sectionSort]);

  const openJob = (job: UserJob) => {
    if (job.section === 'posted' && job.listingId) {
      navigation.navigate('JobListingDetail', { listingId: job.listingId });
      return;
    }
    if (job.requestId) {
      navigation.navigate('WorkRequestDetail', { requestId: job.requestId });
    }
  };

  const showSectionLoading = loading && userJobs.length === 0;
  const showSectionError = Boolean(error) && !showSectionLoading;

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('work.jobs')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabBar}>
        {(['received', 'sent'] as JobsTab[]).map((tab) => {
          const count = tab === 'received' ? unread.received : unread.sent;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                setActiveTab(tab);
                setActivePage(0);
              }}
            >
              <View style={styles.tabLabelRow}>
                <Text
                  style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
                >
                  {tab === 'received' ? t('work.received') : t('work.sent')}
                </Text>
                {count > 0 ? <View style={styles.tabUnreadDot} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        // Remount per tab so the pager starts on the first section again.
        key={activeTab}
        ref={pagerRef}
        horizontal
        pagingEnabled
        snapToInterval={PANEL_WIDTH + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pager}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const page = Math.round(x / (PANEL_WIDTH + spacing.md));
          setActivePage(Math.max(0, Math.min(sections.length - 1, page)));
        }}
        scrollEventThrottle={16}
      >
        {sections.map((section) => {
          const items = sectioned[section.key] ?? [];
          return (
            <View key={section.key} style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelTitleWrap}>
                  <View style={[styles.panelDot, { backgroundColor: section.dot }]} />
                  <Text style={styles.panelTitle}>{t(section.titleKey)}</Text>
                  <Text style={[styles.panelCount, { color: section.countColor }]}>
                    {showSectionLoading || showSectionError ? '—' : items.length}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.panelFilter}
                  onPress={() => {
                    setSortSection(section.key);
                    setSortOpen(true);
                  }}
                >
                  <Ionicons
                    name="filter-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={(ref) => {
                  sectionScrollRefs.current[`${activeTab}:${section.key}`] = ref;
                }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  scrollOffsets.current[`${activeTab}:${section.key}`] =
                    e.nativeEvent.contentOffset.y;
                }}
              >
                {showSectionLoading ? (
                  <SectionBodyState>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </SectionBodyState>
                ) : showSectionError ? (
                  <SectionBodyState>
                    <Ionicons
                      name="warning-outline"
                      size={28}
                      color={colors.error}
                    />
                    <Text style={styles.errorTitle}>{t(section.loadKey)}</Text>
                    <Text style={styles.errorSubtitle}>{t('work.tryAgain')}</Text>
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => void refresh()}
                    >
                      <Text style={styles.retryText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                  </SectionBodyState>
                ) : items.length === 0 ? (
                  <SectionBodyState>
                    <Text style={styles.emptyText}>{t(section.emptyKey)}</Text>
                  </SectionBodyState>
                ) : (
                  items.map((job) => (
                    <JobFlowCard
                      key={job.id}
                      job={job}
                      hideStatus={section.key === 'posted'}
                      showReviewPrompt={
                        section.key === 'completed' &&
                        job.status === 'completed' &&
                        !!job.reviewState?.eligible
                      }
                      onPress={() => openJob(job)}
                      onCounterpartPress={() =>
                        openUserProfile(navigation, job.counterpart.id, me.id)
                      }
                      onStarPress={(rating) =>
                        openEngagementReview(navigation, {
                          jobId: job.id,
                          engagementId: job.engagementId,
                          workRequestId: job.requestId,
                          initialRating: rating,
                        })
                      }
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.dotsRow}>
        {sections.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === activePage && styles.dotActive]} />
        ))}
      </View>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable style={styles.sortBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sortTitle}>
              {t('work.sortSection', {
                section: t(sections.find((s) => s.key === sortSection)?.titleKey ?? 'work.requests'),
              })}
            </Text>
            {(
              [
                { id: 'most-recent', labelKey: 'work.mostRecent' },
                { id: 'oldest', labelKey: 'discover.oldestFirst' },
                { id: 'due-date', labelKey: 'discover.dueDate' },
              ] as const
            ).map((opt) => {
              const selected = sectionSort[sortSection] === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.sortOption}
                  onPress={() => {
                    setSectionSort((prev) => ({ ...prev, [sortSection]: opt.id }));
                    setSortOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      selected && styles.sortOptionTextSelected,
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pager: {
    paddingHorizontal: spacing.screen,
    paddingEnd: spacing.screen,
    gap: spacing.md,
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    maxHeight: 560,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  panelTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  panelTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  panelCount: {
    ...typography.label,
  },
  panelFilter: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  sectionBody: {
    minHeight: SECTION_BODY_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.primary + '14',
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  receivedJobCard: {
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewStars: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  badgeRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: '#EEF2F6',
  },
  sourceBadgeText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  receivedTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  statusAndChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobTitle: {
    ...typography.h3,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '500',
  },
  metaLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  metaSeparator: {
    width: '100%',
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  userInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  metaValue: {
    ...typography.bodySmall,
    color: colors.text,
  },
  dateValue: {
    ...typography.bodySmall,
    color: '#3F78B7',
  },
  activityValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: 78,
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D6DEE8',
  },
  dotActive: {
    width: 34,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  sortBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  sortTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sortOptionText: {
    ...typography.body,
    color: colors.text,
  },
  sortOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
