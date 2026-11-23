import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { formatGregorianMonthTitle } from '../../utils/gregorianCivilDate';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface SidebarCalendarPreviewProps {
  onPress: () => void;
}

export default function SidebarCalendarPreview({ onPress }: SidebarCalendarPreviewProps) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const { firstDay, monthLabel, days } = useMemo(() => {
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const monthLabel = formatGregorianMonthTitle(month.getFullYear(), month.getMonth() + 1);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return { firstDay, monthLabel, days };
  }, [month]);

  const shiftMonth = (delta: number) => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </TouchableOpacity>
        <View style={styles.nav}>
          <TouchableOpacity hitSlop={8} onPress={() => shiftMonth(-1)}>
            <Ionicons name="chevron-back" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8} onPress={() => shiftMonth(1)}>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
        <View style={styles.weekDays}>
          {WEEKDAYS.map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekDay}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {Array.from({ length: firstDay }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.dayCell} />
          ))}
          {days.map((day) => (
            <View key={day} style={styles.dayCell}>
              <View style={styles.dayInner}>
                <Text style={styles.dayText}>{day}</Text>
              </View>
              <View style={styles.dotsSpacer} />
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    direction: 'ltr',
    backgroundColor: colors.white,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  monthLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%' as `${number}%`,
    alignItems: 'center',
    paddingVertical: 0,
    minHeight: 24,
  },
  dayInner: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 1,
    minHeight: 3,
  },
  dotsSpacer: {
    height: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
