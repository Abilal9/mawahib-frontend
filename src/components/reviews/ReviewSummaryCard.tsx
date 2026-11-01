import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';
import type { ReviewDistribution } from '../../data/types';

export default function ReviewSummaryCard({
  average,
  total,
  distribution,
  rated,
}: {
  average: number;
  total: number;
  distribution: ReviewDistribution[] | null;
  rated: boolean;
}) {
  const filledStars = rated ? Math.round(average) : 0;
  return (
    <View style={styles.summaryCard}>
      {distribution ? (
        <View style={styles.distCol}>
          {distribution.map((row) => (
            <View key={row.stars} style={styles.distRow}>
              <Text style={styles.distLabel}>{row.stars}</Text>
              <Ionicons name="star" size={10} color="#F5A623" />
              <View style={styles.barTrack}>
                {row.percent > 0 ? (
                  <View style={[styles.barFill, { width: `${row.percent * 100}%` }]} />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.distCol} />
      )}
      <View style={styles.summaryRight}>
        <Text style={[styles.average, !rated && styles.averageUnrated]}>
          {average.toFixed(1)}
        </Text>
        <View style={styles.summaryStars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < filledStars ? 'star' : 'star-outline'}
              size={14}
              color={i < filledStars ? '#F5A623' : colors.border}
            />
          ))}
        </View>
        <Text style={styles.summaryCount}>
          {total === 0 ? 'No reviews yet' : `${total} Reviews`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  distCol: {
    flex: 1,
    gap: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distLabel: {
    ...typography.caption,
    color: colors.text,
    width: 10,
    fontSize: 11,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginLeft: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  summaryRight: {
    alignItems: 'center',
    minWidth: 88,
  },
  average: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    color: colors.primary,
  },
  averageUnrated: {
    color: colors.textSecondary,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  summaryCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
