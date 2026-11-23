import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import UserAvatar from '../../components/ui/UserAvatar';
import MoneyAmount from '../../components/ui/MoneyAmount';
import GuestScreenHeader from '../../components/guest/GuestScreenHeader';
import { GuestStatusBlock, publicTimeAgo } from '../../components/guest/GuestDiscoveryCards';
import { useGuestJob } from '../../hooks/useGuestJob';
import { useAuthGate } from '../../context/AuthGateContext';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { displayProfileTitle } from '../../constants/profile';
import { categoryCardLabel } from '../../i18n/catalogLabel';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import type { SignedOutScreenProps } from '../../navigation/types';

/**
 * Public job detail. Apply/Save open the Auth Gate. No mutations.
 * No applicant lists, applicant counts, or owner tools.
 */
export default function GuestJobListingDetailScreen({
  route,
  navigation,
}: SignedOutScreenProps<'JobListingDetail'>) {
  const { job, loading, error, notFound, refresh } = useGuestJob(
    route.params.listingId,
  );
  const { requireAuth } = useAuthGate();

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <GuestScreenHeader onBack={() => navigation.goBack()} title={t('work.job')} />
      {loading ? (
        <GuestStatusBlock loading />
      ) : notFound || !job ? (
        <GuestStatusBlock
          error={error || 'This job is unavailable.'}
          onRetry={notFound ? undefined : refresh}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { flex: 1 }]}>{job.title}</Text>
            <BookmarkButton
              kind="job"
              saved={false}
              onPress={() =>
                requireAuth({
                  action: 'save',
                  route: 'JobListingDetail',
                  params: { listingId: job.id },
                })
              }
            />
          </View>
          <TouchableOpacity
            style={styles.poster}
            onPress={() =>
              navigation.navigate('UserProfile', { userId: job.poster.id })
            }
            activeOpacity={0.85}
          >
            <UserAvatar uri={job.poster.avatarUrl} size={44} />
            <View>
              <Text style={styles.posterName}>
                {job.companyName || job.poster.displayName}
              </Text>
              <Text style={styles.meta}>
                {displayProfileTitle(job.poster.title)}
              </Text>
            </View>
          </TouchableOpacity>
          {job.location ? <Text style={styles.meta}>{job.location}</Text> : null}
          <Text style={styles.meta}>{job.employmentType}</Text>
          {job.salaryLabel ? (
            <MoneyAmount amount={job.salaryLabel} currency={job.currency} size={16} rawLabel />
          ) : job.fixedAmount != null ? (
            <MoneyAmount amount={job.fixedAmount} currency={job.currency} size={16} />
          ) : job.minAmount != null && job.maxAmount != null ? (
            <MoneyAmount
              amount={`${job.minAmount} – ${job.maxAmount}`}
              currency={job.currency}
              size={16}
              rawLabel
            />
          ) : null}
          {job.postedAt || job.createdAt ? (
            <Text style={styles.meta}>
              {t('discover.postedOn', { date: publicTimeAgo(job.postedAt || job.createdAt) })}
            </Text>
          ) : null}
          {categoryCardLabel(job) ? (
            <Text style={styles.meta}>{categoryCardLabel(job)}</Text>
          ) : null}
          {job.description ? (
            <Text style={styles.description}>{job.description}</Text>
          ) : null}
          {job.skills.length > 0 ? (
            <View style={styles.chips}>
              {job.skills.map((skill) => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button
            title={t('work.apply')}
            onPress={() =>
              requireAuth({
                action: 'apply',
                route: 'JobListingDetail',
                params: { listingId: job.id },
              })
            }
            fullWidth
          />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  title: { ...typography.h2, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  poster: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterName: { ...typography.label, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  description: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  chipText: { ...typography.caption, color: colors.text },
});
