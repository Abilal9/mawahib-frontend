import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import BookmarkButton from '../ui/BookmarkButton';
import MoneyAmount from '../ui/MoneyAmount';
import { colors, spacing, radius, typography } from '../../theme';
import { toImageSource } from '../../utils/image';
import { stripCurrencyCodeTokens } from '../../utils/money';
import type { Job } from '../../data/types';

export type ExploreJobCardData = {
  id: string;
  title: string;
  company: string;
  companyVerified?: boolean;
  logo?: string | number | null;
  location: string;
  salary: string | number;
  currency?: string | null;
  type: string;
  postedAt?: string | null;
};

function postedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function jobUiType(type: string): Job['type'] | string {
  const key = type.replace(/_/g, '-').toLowerCase();
  if (
    key === 'full-time' ||
    key === 'part-time' ||
    key === 'contract' ||
    key === 'freelance' ||
    key === 'gig'
  ) {
    return key;
  }
  return type;
}

function jobTypeBadge(type: string) {
  const ui = jobUiType(type);
  if (ui === 'part-time') {
    return { label: 'Part-time', bg: '#EFF6FF', border: '#DBEAFE', text: '#193CB8' };
  }
  if (ui === 'full-time') {
    return { label: 'Full-time', bg: '#FEFCE8', border: '#FEF9C2', text: '#894B00' };
  }
  if (ui === 'gig' || ui === 'freelance') {
    return {
      label: ui === 'gig' ? 'Gig' : 'Freelance',
      bg: '#F0FDF4',
      border: '#DCFCE7',
      text: '#016630',
    };
  }
  if (ui === 'contract') {
    return { label: 'Contract', bg: '#FDF2F8', border: '#FCE7F3', text: colors.primary };
  }
  return { label: String(type), bg: '#FDF2F8', border: '#FCE7F3', text: colors.primary };
}

export default function ExploreJobCard({
  job,
  onPress,
  saved = false,
  onBookmark,
  compact = false,
}: {
  job: ExploreJobCardData;
  onPress: () => void;
  saved?: boolean;
  onBookmark?: () => void;
  compact?: boolean;
}) {
  const badge = jobTypeBadge(job.type);
  const companyInitial =
    job.company.trim().charAt(0) || job.title.trim().charAt(0) || '?';
  return (
    <TouchableOpacity
      style={[styles.jobCard, compact && styles.compactCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.jobLogoWrap}>
        {job.logo ? (
          <Image source={toImageSource(job.logo)} style={styles.jobLogo} contentFit="cover" />
        ) : (
          <Text style={styles.jobLogoText}>{companyInitial}</Text>
        )}
      </View>
      <View style={styles.jobBody}>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.jobCompany}>{job.company}</Text>
          {job.companyVerified ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          ) : null}
        </View>
        {job.location ? <Text style={styles.jobMeta}>{job.location}</Text> : null}
        <MoneyAmount
          amount={
            typeof job.salary === 'string'
              ? stripCurrencyCodeTokens(job.salary) || 'Negotiable'
              : job.salary
          }
          currency={job.currency}
          size={14}
          color={colors.textTertiary}
          rawLabel={typeof job.salary === 'string'}
        />
        {job.postedAt ? (
          <Text style={styles.jobMeta}>Posted {postedLabel(job.postedAt)}</Text>
        ) : null}
      </View>
      <View style={styles.jobAside}>
        {onBookmark ? (
          <BookmarkButton kind="job" saved={saved} onPress={onBookmark} />
        ) : null}
        <View style={[styles.jobBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.jobBadgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  jobCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compactCard: {
    width: 300,
    marginBottom: 0,
    marginRight: spacing.sm,
  },
  jobLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  jobLogo: { width: 44, height: 44 },
  jobLogoText: { ...typography.body, fontWeight: '700', color: colors.text },
  jobBody: { flex: 1, minWidth: 0, gap: 2 },
  jobTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  jobCompany: { ...typography.bodySmall, color: colors.textSecondary },
  jobMeta: { ...typography.caption, color: colors.textTertiary },
  jobAside: { alignItems: 'flex-end', gap: spacing.sm },
  jobBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jobBadgeText: { ...typography.caption, fontWeight: '600' },
});
