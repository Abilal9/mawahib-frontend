import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export type ExploreChipCategory = {
  id: string;
  nameEn: string;
};

/**
 * Presentation-only category chips. Parent supplies public or authenticated
 * catalog data. Does not fetch.
 */
export default function ExploreTaxonomyChipRow({
  categories,
  selectedIds,
  onToggle,
  loading = false,
  failed = false,
  onRetry,
  filterCount = 0,
  onClear,
}: {
  categories: readonly ExploreChipCategory[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  filterCount?: number;
  onClear?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {failed ? (
        <TouchableOpacity onPress={onRetry} disabled={!onRetry}>
          <Text style={styles.retry}>Couldn’t load categories. Tap to retry.</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categories.map((category) => {
            const selected = selectedIds.includes(category.id);
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.chip, selected && styles.chipOn]}
                onPress={() => onToggle(category.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={category.nameEn}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {category.nameEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      {filterCount > 0 && onClear ? (
        <View style={styles.actions}>
          <Text style={styles.count}>Filters {filterCount}</Text>
          <TouchableOpacity
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Text style={styles.clear}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  loader: { alignSelf: 'flex-start', marginLeft: spacing.screen },
  retry: {
    ...typography.caption,
    color: colors.primary,
    paddingHorizontal: spacing.screen,
  },
  chips: { paddingHorizontal: spacing.screen, gap: spacing.xs, alignItems: 'center' },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.white },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
  count: { ...typography.caption, color: colors.textSecondary },
  clear: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
