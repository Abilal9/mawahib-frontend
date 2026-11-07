import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import MapsLocationLink from '../../components/job/MapsLocationLink';
import Button from '../../components/ui/Button';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import UserAvatar from '../../components/ui/UserAvatar';
import { toImageSource } from '../../utils/image';
import { openUserProfile } from '../../utils/openUserProfile';
import { colors, spacing, radius, typography } from '../../theme';
import { MarketplaceSuccessKey } from '../../utils/marketplaceSuccess';
import { jobService } from '../../services';
import {
  ApiApplication,
  ApiApplicationStatus,
  ApiJobListing,
  isAcceptApplicationResult,
  mapApiListingToJob,
  marketplaceApi,
} from '../../services/marketplaceApi';
import { useUserJobs } from '../../context/UserJobsContext';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import ContentReportSheet from '../../components/report/ContentReportSheet';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { ScreenProps } from '../../navigation/types';
import { JobListing } from '../../data/types';
import { visibleJobSkillLabels } from '../../domain/offeringTaxonomy';
import { ApiError } from '../../lib/apiClient';
import MoneyAmount from '../../components/ui/MoneyAmount';
import { stripCurrencyCodeTokens } from '../../utils/money';

export default function JobListingDetailScreen({
  route,
  navigation,
}: ScreenProps<'JobListingDetail'>) {
  const {
    applyToListing,
    archiveListing,
    reopenListing,
    closeListing,
    deleteListing,
    jobs,
    refresh,
  } = useUserJobs();
  const { apiUser } = useAuth();
  const saved = useSaved();
  const { listingId } = route.params;
  const [job, setJob] = useState<JobListing | undefined>(() =>
    jobService.getByIdSync(listingId),
  );
  const [apiListing, setApiListing] = useState<ApiJobListing | null>(null);
  const [loading, setLoading] = useState(!job);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [ownerActionError, setOwnerActionError] = useState<string | null>(null);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => void;
  } | null>(null);
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(
    null,
  );
  const [applicantBusy, setApplicantBusy] = useState<string | null>(null);
  const [applicantError, setApplicantError] = useState<string | null>(null);
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The API listing carries posterId + status, which owner actions depend on.
      const next = await marketplaceApi.getListing(listingId);
      setApiListing(next);
      setJob(mapApiListingToJob(next));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError('Job not found');
      } else {
        setError(e instanceof ApiError ? e.message : 'Failed to load job');
      }
      setApiListing(null);
      setJob(undefined);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewerOwnsListing = Boolean(
    apiUser && apiListing && apiUser.id === apiListing.posterId,
  );

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true);
    setApplicationsError(null);
    try {
      setApplications(
        await marketplaceApi.listApplicationsForListing(listingId),
      );
    } catch (e) {
      setApplicationsError(
        e instanceof ApiError ? e.message : 'Could not load applicants',
      );
    } finally {
      setApplicationsLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (viewerOwnsListing) void loadApplications();
  }, [viewerOwnsListing, loadApplications]);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!job || error) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>{error || 'Job not found'}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.missingBack}>
            <Text style={styles.missingBackText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.missingBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const typeLabel =
    job.type === 'part-time'
      ? 'Part-time'
      : job.type === 'full-time'
        ? 'Full-time'
        : job.type === 'contract'
          ? 'Contract'
          : job.type === 'gig'
            ? 'Gig'
            : 'Freelance';

  const isOwner = Boolean(apiUser && apiListing && apiUser.id === apiListing.posterId);
  /** Any signed-in user may apply; the API rejects applying to your own listing. */
  const canApply = Boolean(apiUser) && !isOwner;
  const skillLabels = visibleJobSkillLabels(job.skills);

  const runOwnerAction = (
    action: () => Promise<void>,
    successKey: Extract<
      MarketplaceSuccessKey,
      | 'listingArchived'
      | 'listingReopened'
      | 'listingClosed'
      | 'listingDeleted'
    >,
  ) => {
    void (async () => {
      setOwnerBusy(true);
      setOwnerActionError(null);
      try {
        await action();
        showSuccess(successKey);
      } catch (e) {
        setOwnerActionError(
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Could not update this listing',
        );
      } finally {
        setOwnerBusy(false);
      }
    })();
  };

  const askOwnerAction = (
    title: string,
    message: string,
    confirmLabel: string,
    action: () => Promise<void>,
    successKey: Extract<
      MarketplaceSuccessKey,
      | 'listingArchived'
      | 'listingReopened'
      | 'listingClosed'
      | 'listingDeleted'
    >,
    danger?: boolean,
  ) => {
    setConfirm({
      title,
      message,
      confirmLabel,
      danger,
      run: () => runOwnerAction(action, successKey),
    });
  };

  /** Work request carrying this applicant's application (owner's received side). */
  const requestIdForApplicant = (applicantId: string): string | undefined =>
    jobs.find(
      (j) =>
        j.source === 'job_posting' &&
        j.type === 'received' &&
        j.listingId === listingId &&
        j.counterpart.id === applicantId,
    )?.requestId;

  const reviewApplicant = (
    application: ApiApplication,
    status: Exclude<ApiApplicationStatus, 'submitted' | 'withdrawn'>,
  ) => {
    if (applicantBusy) return;
    void (async () => {
      setApplicantBusy(
        status === 'accepted' ? 'Selecting applicant…' : 'Updating applicant…',
      );
      setApplicantError(null);
      try {
        const result = await marketplaceApi.patchApplication(
          application.id,
          status,
        );
        if (status === 'accepted' && isAcceptApplicationResult(result)) {
          // No engagement yet: the applicant still has to accept the request.
          void refresh();
          navigation.navigate('WorkRequestDetail', {
            requestId: result.workRequest.id,
          });
          void loadApplications();
          return;
        }
        await Promise.all([loadApplications(), refresh()]);
      } catch (e) {
        setApplicantError(
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Could not update this applicant',
        );
      } finally {
        setApplicantBusy(null);
      }
    })();
  };

  const askReviewApplicant = (
    application: ApiApplication,
    status: 'under_review' | 'rejected' | 'accepted',
  ) => {
    const name = application.applicant.displayName;
    if (status === 'accepted') {
      setConfirm({
        title: 'Select Applicant?',
        message: `${name} will be asked to accept this job. Work and payment start only after they accept.`,
        confirmLabel: 'Select Applicant',
        run: () => reviewApplicant(application, 'accepted'),
      });
    } else if (status === 'rejected') {
      setConfirm({
        title: 'Reject Applicant?',
        message: `${name}'s application will be rejected and closed.`,
        confirmLabel: 'Reject',
        danger: true,
        run: () => reviewApplicant(application, 'rejected'),
      });
    } else {
      setConfirm({
        title: 'Mark Under Review?',
        message: `${name} will see that you are reviewing their application.`,
        confirmLabel: 'Under Review',
        run: () => reviewApplicant(application, 'under_review'),
      });
    }
  };

  const deleteAction = {
    title: 'Delete',
    onPress: () =>
      askOwnerAction(
        'Delete Listing?',
        'This removes the listing and closes any open negotiations on it. Accepted work already in progress is not cancelled.',
        'Delete Listing',
        () => deleteListing(listingId),
        'listingDeleted',
        true,
      ),
  };

  const ownerActions: { title: string; onPress: () => void }[] = isOwner
    ? apiListing?.status === 'open'
      ? [
          {
            title: 'Archive',
            onPress: () =>
              askOwnerAction(
                'Archive Listing?',
                'The listing will be hidden from Explore and open negotiations will be closed. You can reopen later for new applicants.',
                'Archive',
                () => archiveListing(listingId),
                'listingArchived',
              ),
          },
          {
            title: 'Close',
            onPress: () =>
              askOwnerAction(
                'Close Listing?',
                'Closing ends open applications and negotiations on this listing.',
                'Close Listing',
                () => closeListing(listingId),
                'listingClosed',
                true,
              ),
          },
          deleteAction,
        ]
      : apiListing?.status === 'archived'
        ? [
            {
              title: 'Reopen',
              onPress: () =>
                askOwnerAction(
                  'Reopen Listing?',
                  'The listing will become visible again for new applicants.',
                  'Reopen',
                  () => reopenListing(listingId),
                  'listingReopened',
                ),
            },
            {
              title: 'Close',
              onPress: () =>
                askOwnerAction(
                  'Close Listing?',
                  'Closing ends open applications and negotiations on this listing.',
                  'Close Listing',
                  () => closeListing(listingId),
                  'listingClosed',
                  true,
                ),
            },
            deleteAction,
          ]
        : apiListing?.status === 'closed'
          ? [
              {
                title: 'Reopen',
                onPress: () =>
                  askOwnerAction(
                    'Reopen Listing?',
                    'The listing will become visible again for new applicants.',
                    'Reopen',
                    () => reopenListing(listingId),
                    'listingReopened',
                  ),
              },
              deleteAction,
            ]
          : [deleteAction]
    : [];

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        {apiListing && !isOwner ? (
          <TouchableOpacity
            onPress={() => setReportOpen(true)}
            style={styles.headerButton}
            accessibilityLabel="Report job"
          >
            <Ionicons name="flag-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        {apiListing &&
        apiListing.status !== 'draft' &&
        apiListing.status !== 'archived' ? (
          <BookmarkButton
            kind="job"
            saved={saved.isSaved('job', listingId, Boolean(apiListing.isSaved))}
            size={24}
            idleColor={colors.text}
            onPress={() => {
              const shown = saved.isSaved(
                'job',
                listingId,
                Boolean(apiListing.isSaved),
              );
              void saved.setDesired(
                'job',
                listingId,
                !shown,
                Boolean(apiListing.isSaved),
              );
            }}
          />
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            {job.logo ? (
              <Image source={toImageSource(job.logo)} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>{job.company.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.title}>{job.title}</Text>
              <Text style={styles.company}>{job.company}</Text>
            </View>
          </View>

          <View style={styles.badges}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{typeLabel}</Text>
            </View>
          </View>

          {job.location?.trim() ? (
            <MapsLocationLink query={job.location} />
          ) : null}
          <View style={styles.metaRow}>
            <MoneyAmount
              amount={stripCurrencyCodeTokens(job.salary) || 'Negotiable'}
              currency={job.currency}
              size={16}
              color={colors.textSecondary}
              rawLabel
            />
          </View>
        </View>

        {job.description?.trim() ? (
          <>
            <Text style={styles.sectionTitle}>About this job</Text>
            <Text style={styles.description}>{job.description}</Text>
          </>
        ) : null}

        {skillLabels.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skills}>
              {skillLabels.map((skill) => (
                <View key={skill} style={styles.skillTag}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {isOwner ? (
          <View style={styles.applicantsSection}>
            <Text style={styles.sectionTitle}>
              Applicants{applications.length > 0 ? ` (${applications.length})` : ''}
            </Text>
            {applicantError ? (
              <Text style={styles.applyError}>{applicantError}</Text>
            ) : null}
            {applicationsLoading && applications.length === 0 ? (
              <ActivityIndicator color={colors.primary} />
            ) : applicationsError ? (
              <View style={styles.applicantEmpty}>
                <Text style={styles.applyHint}>{applicationsError}</Text>
                <Button
                  title="Retry"
                  variant="secondary"
                  onPress={() => void loadApplications()}
                />
              </View>
            ) : applications.length === 0 ? (
              <Text style={styles.applyHint}>No applicants yet.</Text>
            ) : (
              applications.map((application) => {
                const requestId =
                  application.status === 'accepted'
                    ? requestIdForApplicant(application.applicantId)
                    : undefined;
                const canReview =
                  apiListing?.status === 'open' &&
                  (application.status === 'submitted' ||
                    application.status === 'under_review');
                return (
                  <ApplicantCard
                    key={application.id}
                    application={application}
                    disabled={applicantBusy !== null}
                    onOpenProfile={() =>
                      openUserProfile(
                        navigation,
                        application.applicantId,
                        apiUser?.id ?? '',
                      )
                    }
                    onUnderReview={
                      canReview && application.status === 'submitted'
                        ? () => askReviewApplicant(application, 'under_review')
                        : undefined
                    }
                    onReject={
                      canReview
                        ? () => askReviewApplicant(application, 'rejected')
                        : undefined
                    }
                    onSelect={
                      canReview
                        ? () => askReviewApplicant(application, 'accepted')
                        : undefined
                    }
                    onViewRequest={
                      requestId
                        ? () =>
                            navigation.navigate('WorkRequestDetail', {
                              requestId,
                            })
                        : undefined
                    }
                  />
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {applyError ? (
          <Text style={styles.applyError}>{applyError}</Text>
        ) : null}
        {ownerActionError ? (
          <Text style={styles.applyError}>{ownerActionError}</Text>
        ) : null}
        {isOwner ? (
          <>
            <Text style={styles.applyHint}>
              You posted this listing · {apiListing?.status.replace(/_/g, ' ')}
            </Text>
            {ownerActions.length > 0 ? (
              <View style={styles.ownerActions}>
                {ownerActions.map((action) => (
                  <Button
                    key={action.title}
                    title={action.title}
                    variant="secondary"
                    style={styles.ownerActionBtn}
                    disabled={ownerBusy}
                    onPress={action.onPress}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : canApply ? (
          <Button
            title={applying ? 'Applying…' : 'Apply'}
            fullWidth
            disabled={applying}
            onPress={() =>
              setConfirm({
                title: 'Apply?',
                message:
                  'Your application will be sent to the listing owner as a work request.',
                confirmLabel: 'Apply',
                run: () => {
                  void (async () => {
                    setApplying(true);
                    setApplyError(null);
                    try {
                      await applyToListing(job.id);
                      showSuccess('applicationSent');
                    } catch (e) {
                      setApplyError(
                        e instanceof ApiError ? e.message : 'Could not apply',
                      );
                    } finally {
                      setApplying(false);
                    }
                  })();
                },
              })
            }
          />
        ) : (
          <Text style={styles.applyHint}>
            Sign in to apply to this listing.
          </Text>
        )}
      </View>

      <ConfirmActionModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        danger={confirm?.danger}
        busy={applying || ownerBusy || applicantBusy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const pending = confirm;
          setConfirm(null);
          pending.run();
        }}
      />

      <ContentReportSheet
        visible={reportOpen}
        title="Report job"
        targetType="job_listing"
        targetId={listingId}
        onClose={() => setReportOpen(false)}
      />

      <ActionBusyOverlay
        visible={applying || ownerBusy || applicantBusy !== null}
        message={
          applicantBusy ??
          (applying ? 'Sending application…' : 'Updating listing…')
        }
      />
      <SuccessConfirmationModal
        visible={successVisible}
        title={successTitle}
        message={successMessage}
        onDone={() => void completeSuccess()}
      />
    </ScreenContainer>
  );
}

const APPLICATION_STATUS_LABEL: Record<ApiApplicationStatus, string> = {
  submitted: 'New',
  under_review: 'Under Review',
  accepted: 'Selected',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const APPLICATION_STATUS_TONE: Record<
  ApiApplicationStatus,
  { bg: string; text: string }
> = {
  submitted: { bg: '#FCE7F3', text: '#BE185D' },
  under_review: { bg: '#FEF9C3', text: '#8A6A16' },
  accepted: { bg: '#DCFCE7', text: '#15803D' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C' },
  withdrawn: { bg: '#EEF2F6', text: '#627D98' },
};

function formatApplicationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ApplicantCard({
  application,
  disabled,
  onOpenProfile,
  onUnderReview,
  onReject,
  onSelect,
  onViewRequest,
}: {
  application: ApiApplication;
  disabled: boolean;
  onOpenProfile: () => void;
  onUnderReview?: () => void;
  onReject?: () => void;
  onSelect?: () => void;
  onViewRequest?: () => void;
}) {
  const tone = APPLICATION_STATUS_TONE[application.status];
  const cover = application.coverLetter.trim();
  return (
    <View style={styles.applicantCard}>
      <TouchableOpacity
        style={styles.applicantTop}
        onPress={onOpenProfile}
        activeOpacity={0.8}
      >
        <UserAvatar uri={application.applicant.avatarUrl} size={44} />
        <View style={styles.applicantInfo}>
          <Text style={styles.applicantName} numberOfLines={1}>
            {application.applicant.displayName}
          </Text>
          {application.applicant.title ? (
            <Text style={styles.applicantTitle} numberOfLines={1}>
              {application.applicant.title}
            </Text>
          ) : null}
          <Text style={styles.applicantDate}>
            Applied {formatApplicationDate(application.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.text }]}>
            {APPLICATION_STATUS_LABEL[application.status]}
          </Text>
        </View>
      </TouchableOpacity>
      {cover ? (
        <Text style={styles.applicantCover} numberOfLines={3}>
          {cover}
        </Text>
      ) : null}
      {onUnderReview || onReject || onSelect || onViewRequest ? (
        <View style={styles.applicantActions}>
          {onUnderReview ? (
            <Button
              title="Under Review"
              size="sm"
              variant="secondary"
              style={styles.applicantActionBtn}
              numberOfLines={1}
              disabled={disabled}
              onPress={onUnderReview}
            />
          ) : null}
          {onReject ? (
            <Button
              title="Reject"
              size="sm"
              variant="secondary"
              style={styles.applicantActionBtn}
              numberOfLines={1}
              disabled={disabled}
              onPress={onReject}
            />
          ) : null}
          {onSelect ? (
            <Button
              title="Select Applicant"
              size="sm"
              style={styles.applicantActionBtn}
              numberOfLines={1}
              disabled={disabled}
              onPress={onSelect}
            />
          ) : null}
          {onViewRequest ? (
            <Button
              title="View Request"
              size="sm"
              style={styles.applicantActionBtn}
              numberOfLines={1}
              disabled={disabled}
              onPress={onViewRequest}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  applicantsSection: { marginTop: spacing.xl, gap: spacing.md },
  applicantEmpty: { gap: spacing.md },
  applicantCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  applicantTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  applicantInfo: { flex: 1 },
  applicantName: { ...typography.label, color: colors.text },
  applicantTitle: { ...typography.caption, color: colors.textSecondary },
  applicantDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  applicantCover: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  applicantActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  applicantActionBtn: { flexGrow: 1, flexBasis: '30%' },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusPillText: { ...typography.caption, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  heroTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  logo: { width: 56, height: 56, borderRadius: radius.button },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { ...typography.h3, color: colors.primary },
  heroInfo: { flex: 1, justifyContent: 'center' },
  title: { ...typography.h2, color: colors.text },
  company: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  typeText: { ...typography.caption, color: '#193CB8', fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  metaText: { ...typography.bodySmall, color: colors.textSecondary },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: '#FFF0F7',
  },
  skillText: { ...typography.bodySmall, color: colors.primary },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  applyError: { ...typography.caption, color: colors.error ?? '#DC2626', textAlign: 'center' },
  applyHint: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  ownerActions: { flexDirection: 'row', gap: spacing.sm },
  ownerActionBtn: { flex: 1 },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  missingText: { ...typography.body, color: colors.text, textAlign: 'center' },
  missingBack: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  missingBackText: { ...typography.button, color: colors.white },
});
