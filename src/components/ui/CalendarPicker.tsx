import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';
import {
  isCalendarDayBlocked,
  isCurrentLocalMonth,
  isSameLocalDay,
  startOfLocalDay,
  startOfLocalMonth,
} from '../../utils/calendarDay';
import {
  formatGregorianMonthTitle,
  GREGORIAN_WEEKDAYS,
} from '../../utils/gregorianCivilDate';

interface Props {
  /** Any day inside the month to render. */
  month: Date;
  onMonthChange: (month: Date) => void;
  onPickDay: (day: Date) => void;
  /** `single` highlights one day; `range` shades everything between the ends. */
  mode?: 'single' | 'range';
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  /**
   * Extra date-only floor, used while picking a range end.
   * Days before this stay disabled. Today is always the other floor.
   */
  notBefore?: Date | null;
}

function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Month grid used by every deadline picker, so selection behaves the same. */
export default function CalendarPicker({
  month,
  onMonthChange,
  onPickDay,
  mode = 'single',
  selected,
  rangeStart,
  rangeEnd,
  notBefore,
}: Props) {
  const grid = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    return {
      label: formatGregorianMonthTitle(year, monthIndex + 1),
      leadingBlanks: new Date(year, monthIndex, 1).getDay(),
      days: Array.from(
        { length: new Date(year, monthIndex + 1, 0).getDate() },
        (_, i) => i + 1,
      ),
    };
  }, [month]);

  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const atCurrentMonth = isCurrentLocalMonth(month, today);

  const dayAt = (day: number) =>
    new Date(month.getFullYear(), month.getMonth(), day);

  const shiftMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    if (delta < 0 && startOfLocalMonth(next).getTime() < startOfLocalMonth(today).getTime()) {
      return;
    }
    onMonthChange(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{grid.label}</Text>
        <View style={styles.nav}>
          <TouchableOpacity
            hitSlop={8}
            disabled={atCurrentMonth}
            accessibilityState={{ disabled: atCurrentMonth }}
            onPress={atCurrentMonth ? undefined : () => shiftMonth(-1)}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={atCurrentMonth ? colors.border : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8} onPress={() => shiftMonth(1)}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekRow}>
        {GREGORIAN_WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekDay}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.dayCell} />
        ))}
        {grid.days.map((day) => {
          const date = dayAt(day);
          const isStart = mode === 'range' && sameDay(date, rangeStart);
          const isEnd = mode === 'range' && sameDay(date, rangeEnd);
          const isSelected =
            mode === 'range' ? isStart || isEnd : sameDay(date, selected);
          const inRange =
            mode === 'range' &&
            !!rangeStart &&
            !!rangeEnd &&
            date.getTime() > rangeStart.getTime() &&
            date.getTime() < rangeEnd.getTime();
          const bothEnds = !!rangeStart && !!rangeEnd;
          const blocked = isCalendarDayBlocked(date, today, notBefore);
          const isToday = isSameLocalDay(date, today);

          return (
            <Pressable
              key={day}
              style={[
                styles.dayCell,
                inRange && !blocked && styles.dayCellInRange,
                isStart && bothEnds && !blocked && styles.dayCellRangeStart,
                isEnd && bothEnds && !blocked && styles.dayCellRangeEnd,
              ]}
              disabled={blocked}
              accessibilityState={{ disabled: blocked }}
              onPress={blocked ? undefined : () => onPickDay(date)}
            >
              <View
                style={[
                  styles.dayInner,
                  isToday && !isSelected && styles.dayToday,
                  isSelected && !blocked && styles.daySelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    blocked && styles.dayTextDisabled,
                    isSelected && !blocked && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    direction: 'ltr',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  monthLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCellInRange: { backgroundColor: colors.primary + '18' },
  dayCellRangeStart: {
    backgroundColor: colors.primary + '18',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  dayCellRangeEnd: {
    backgroundColor: colors.primary + '18',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  dayInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { ...typography.caption, color: colors.text },
  dayTextDisabled: { color: colors.textSecondary, opacity: 0.35 },
  dayTextSelected: { color: colors.white, fontWeight: '600' },
});
