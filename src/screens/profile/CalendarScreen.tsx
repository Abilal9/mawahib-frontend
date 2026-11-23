import React, { useMemo } from 'react';
import { backIcon, chevronBackIcon, chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import UserAvatar from '../../components/ui/UserAvatar';
import { getAppliedLocale, t } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';
import { useMyCalendar } from '../../hooks/useMyCalendar';
import {
  formatGregorianLongDate,
  formatGregorianMonthTitle,
  formatGregorianSpan,
  gregorianWeekdayHeading,
  gregorianMonthGrid,
  indicatorDays,
  monthBounds,
  scheduledOnDay,
  workRequestRoute,
  type CalendarItem,
  type ScheduledCalendarItem,
} from '../../utils/gregorianCivilDate';
import type { MessageKey } from '../../i18n/messages';

const CALENDAR_STATUS_KEYS: Record<string, MessageKey> = {
  pending_payment: 'status.pendingPayment',
  payment_failed: 'calendar.paymentFailed',
  in_progress: 'status.inProgress',
  delivered: 'status.delivered',
  disputed: 'status.disputed',
  completed: 'status.completed',
};

function calendarStatusText(status: string, fallback: string): string {
  const key = CALENDAR_STATUS_KEYS[status];
  return key ? t(key) : fallback;
}

export default function CalendarScreen({ navigation }: ScreenProps<'Calendar'>) {
  const calendar = useMyCalendar();
  const locale = getAppliedLocale();
  const grid = useMemo(
    () => gregorianMonthGrid(calendar.year, calendar.month),
    [calendar.year, calendar.month],
  );
  const bounds = monthBounds(calendar.year, calendar.month);
  const monthTitle = formatGregorianMonthTitle(calendar.year, calendar.month, locale);
  const heading = formatGregorianLongDate(calendar.selected, locale) ?? monthTitle;
  const page =
    calendar.page &&
    calendar.page.from === bounds.from &&
    calendar.page.to === bounds.to
      ? calendar.page
      : null;
  const marks = useMemo(() => {
    if (!page || calendar.phase !== 'ready') return new Set<string>();
    return new Set(indicatorDays(page.scheduled, page.from, page.to));
  }, [page, calendar.phase]);
  const dayItems = useMemo(
    () => (page ? scheduledOnDay(page.scheduled, calendar.selected) : []),
    [page, calendar.selected],
  );

  const openItem = (item: CalendarItem) => {
    const params = workRequestRoute(item.workRequestId);
    if (!params) return;
    navigation.navigate('WorkRequestDetail', params);
  };

  const monthHasScheduled = (page?.scheduled.length ?? 0) > 0;
  const hasUnscheduled = (page?.unscheduled.length ?? 0) > 0 || page?.unscheduledHasMore === true;

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={calendar.refreshing}
            onRefresh={calendar.refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => calendar.shiftMonth(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.previousMonth')}
          >
            <Ionicons name={chevronBackIcon()} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthName}>{monthTitle}</Text>
          <TouchableOpacity
            onPress={() => calendar.shiftMonth(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.nextMonth')}
          >
            <Ionicons name={chevronForwardIcon()} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekDays}>
          {Array.from({ length: 7 }, (_, index) => (
            <Text key={index} style={styles.weekDay}>
              {gregorianWeekdayHeading(index, locale)}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {grid.map((cell, index) => {
            if (!cell) {
              return <View key={`blank-${index}`} style={styles.dayCell} />;
            }
            const isSelected = cell.iso === calendar.selected;
            const isToday = cell.iso === calendar.today;
            const marked = marks.has(cell.iso);
            const label = formatGregorianLongDate(cell.iso, locale) ?? cell.iso;
            return (
              <Pressable
                key={cell.iso}
                style={styles.dayCell}
                onPress={() => calendar.selectDay(cell.iso)}
                accessibilityRole="button"
                accessibilityLabel={marked ? t('calendar.scheduled', { date: label }) : label}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.dayInner, isToday && !isSelected && styles.dayToday, isSelected && styles.daySelected]}>
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{cell.day}</Text>
                </View>
                <View style={[styles.eventDotSpacer, marked && styles.eventDot]} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.eventsSection}>
          {calendar.phase !== 'error' && !page ? (
            <Text style={styles.noEvents}>Loading calendar…</Text>
          ) : null}
          {calendar.phase === 'error' ? (
            <View>
              <Text style={styles.noEvents}>Couldn{"'"}t load calendar</Text>
              <TouchableOpacity onPress={calendar.retry} style={styles.retry} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {calendar.phase === 'ready' && page ? (
            <View>
              <Text style={styles.eventsTitle}>{heading}</Text>
              {page.scheduledHasMore ? (
                <Text style={styles.notice}>Some scheduled work in this period is not shown.</Text>
              ) : null}
              {dayItems.length === 0 ? (
                <Text style={styles.noEvents}>
                  {monthHasScheduled || hasUnscheduled
                    ? 'Nothing scheduled this day'
                    : 'No scheduled work yet'}
                </Text>
              ) : (
                dayItems.map((item) => (
                  <AgendaCard key={item.engagementId} item={item} onPress={() => openItem(item)} />
                ))
              )}

              {hasUnscheduled ? (
                <View style={styles.unscheduled}>
                  <Text style={styles.eventsTitle}>Unscheduled</Text>
                  {page.unscheduled.map((item) => (
                    <AgendaCard
                      key={item.engagementId}
                      item={item}
                      detail="Date not set"
                      onPress={() => openItem(item)}
                    />
                  ))}
                  {page.unscheduledHasMore ? (
                    <Text style={styles.notice}>More unscheduled work exists.</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function AgendaCard({
  item,
  detail,
  onPress,
}: {
  item: CalendarItem | ScheduledCalendarItem;
  detail?: string;
  onPress: () => void;
}) {
  const range =
    'startDate' in item
      ? formatGregorianSpan(item.startDate, item.endDate, getAppliedLocale())
      : null;
  const subtitle = detail ?? range;
  const tappable = workRequestRoute(item.workRequestId) !== null;
  return (
    <Pressable
      style={styles.eventCard}
      disabled={!tappable}
      accessibilityRole={tappable ? 'button' : 'text'}
      accessibilityState={{ disabled: !tappable }}
      onPress={tappable ? onPress : undefined}
    >
      <UserAvatar uri={item.counterpart.avatarUrl} size={40} />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventMeta}>{item.counterpart.displayName}</Text>
        {subtitle ? <Text style={styles.eventMeta}>{subtitle}</Text> : null}
        <Text style={styles.eventStatus}>{calendarStatusText(item.engagementStatus, item.statusLabel)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
  },
  monthName: { ...typography.h2, color: colors.text },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screen,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayText: { ...typography.body, color: colors.text },
  dayTextSelected: {
    color: colors.white,
    fontFamily: typography.label.fontFamily,
  },
  eventDot: {
    backgroundColor: colors.primary,
    borderRadius: 2.5,
  },
  eventDotSpacer: {
    width: 5,
    height: 5,
    marginTop: 4,
  },
  eventsSection: { padding: spacing.screen, paddingTop: spacing.xl },
  eventsTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  noEvents: { ...typography.body, color: colors.textSecondary },
  notice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: { ...typography.label, color: colors.white },
  unscheduled: { marginTop: spacing.xl },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
    alignItems: 'center',
  },
  eventInfo: { flex: 1 },
  eventTitle: { ...typography.label, color: colors.text },
  eventMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  eventStatus: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
  },
});
