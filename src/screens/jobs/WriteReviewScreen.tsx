import React, { useEffect, useMemo, useRef, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import { colors, spacing, radius, typography } from '../../theme';
import UserAvatar from '../../components/ui/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMyProfile } from '../../context/ProfileContext';
import { openUserProfile } from '../../utils/openUserProfile';
import { ApiError } from '../../lib/apiClient';
import { marketplaceApi } from '../../services/marketplaceApi';
import { pickLocalImage, uploadLocalFile } from '../../lib/uploadMedia';
import { ScreenProps } from '../../navigation/types';

const MAX_REVIEW_IMAGES = 4;
const REVIEW_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

interface ReviewImageDraft {
  /** Local key for list rendering / removal. */
  key: string;
  uri: string;
  mimeType: string;
  byteSize: number;
  fileName: string;
  /** Set once uploaded so a retry after a failed submit does not re-upload. */
  mediaAssetId?: string;
}

export default function WriteReviewScreen({
  route,
  navigation,
}: ScreenProps<'WriteReview'>) {
  const { getJobById, refresh } = useUserJobs();
  const { apiUser } = useAuth();
  const { user: me } = useMyProfile();
  const job =
    getJobById(route.params.jobId) ??
    (route.params.workRequestId
      ? getJobById(route.params.workRequestId)
      : undefined);

  const engagementId = route.params.engagementId ?? job?.engagementId;
  const alreadySubmitted = Boolean(job?.reviewState?.myReview);
  const windowOpen = !job?.reviewState || job.reviewState.canSubmit;
  const canSubmit = Boolean(engagementId) && windowOpen && !alreadySubmitted;

  const initial = route.params.initialRating ?? 0;
  const authorId = apiUser?.id ?? null;
  const authorRef = useRef(authorId);
  const boundAuthor = useRef(authorId);
  authorRef.current = authorId;

  const [rating, setRating] = useState(initial);
  const [text, setText] = useState(job?.reviewText ?? '');
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<ReviewImageDraft[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (boundAuthor.current !== authorId) {
    boundAuthor.current = authorId;
    setRating(0);
    setText('');
    setImages([]);
    setImageError(null);
    setSubmitted(false);
    setSubmitting(false);
  }

  useEffect(() => {
    setRating(initial);
  }, [initial]);

  const titleLabel = useMemo(
    () => job?.title ?? 'Completed work',
    [job?.title],
  );

  if (!job && !engagementId) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Job not found</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.missingBack}
          >
            <Text style={styles.missingBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const otherName = job?.counterpart.name;

  const addImage = async () => {
    if (submitting) return;
    const owner = authorRef.current;
    setImageError(null);
    if (images.length >= MAX_REVIEW_IMAGES) {
      setImageError(`You can add up to ${MAX_REVIEW_IMAGES} photos.`);
      return;
    }
    try {
      const picked = await pickLocalImage();
      if (!picked || authorRef.current !== owner) return;
      if (!REVIEW_IMAGE_MIME_TYPES.includes(picked.mimeType.toLowerCase())) {
        setImageError('Only JPG and PNG photos can be added.');
        return;
      }
      setImages((prev) => [
        ...prev,
        { ...picked, key: `${Date.now()}-${prev.length}` },
      ]);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Could not pick a photo.');
    }
  };

  const removeImage = (key: string) => {
    setImages((prev) => prev.filter((img) => img.key !== key));
  };

  const confirmSubmit = () => {
    if (rating < 1 || rating > 5) return;
    Alert.alert(
      'Submit review?',
      "You won't be able to edit this review after submitting.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => void onSubmit() },
      ],
    );
  };

  const onSubmit = async () => {
    if (!engagementId || submitting) return;
    const owner = authorRef.current;
    const engagementForOwner = engagementId;
    if (rating < 1 || rating > 5) {
      Alert.alert('Rating required', 'Please choose a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      // Upload each photo once; remember its asset id so retries are cheap.
      const uploaded: ReviewImageDraft[] = [];
      for (const img of images) {
        if (authorRef.current !== owner) return;
        if (img.mediaAssetId) {
          uploaded.push(img);
          continue;
        }
        const result = await uploadLocalFile({
          uri: img.uri,
          mimeType: img.mimeType,
          byteSize: img.byteSize,
          fileName: img.fileName,
          purpose: 'review',
        });
        if (authorRef.current !== owner) return;
        uploaded.push({ ...img, mediaAssetId: result.mediaAssetId });
        setImages((prev) =>
          prev.map((p) =>
            p.key === img.key ? { ...p, mediaAssetId: result.mediaAssetId } : p,
          ),
        );
      }
      if (authorRef.current !== owner) return;
      const mediaAssetIds = uploaded
        .map((img) => img.mediaAssetId)
        .filter((id): id is string => Boolean(id));
      await marketplaceApi.createEngagementReview(engagementForOwner, {
        rating,
        body: text.trim() || undefined,
        mediaAssetIds: mediaAssetIds.length > 0 ? mediaAssetIds : undefined,
      });
      if (authorRef.current !== owner) return;
      void refresh();
      setSubmitted(true);
    } catch (e) {
      Alert.alert(
        'Could not submit review',
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name={backIcon()} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Write your review</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!canSubmit ? (
            <View style={styles.deferredBanner}>
              <Text style={styles.deferredTitle}>Review unavailable</Text>
              <Text style={styles.deferredBody}>
                This job is not linked to a completed engagement, so a review
                cannot be submitted.
              </Text>
            </View>
          ) : null}

          {job ? (
            <TouchableOpacity
              style={styles.personCard}
              onPress={() =>
                openUserProfile(navigation, job.counterpart.id, me.id)
              }
              activeOpacity={0.85}
            >
              <UserAvatar uri={job.counterpart.avatar} size={56} style={styles.avatar} />
              <View style={styles.personMeta}>
                <Text style={styles.personName}>{job.counterpart.name}</Text>
                <Text style={styles.jobTitle} numberOfLines={2}>
                  {job.title}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.personCard}>
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.personMeta}>
                <Text style={styles.personName}>Rate this job</Text>
                <Text style={styles.jobTitle} numberOfLines={2}>
                  {titleLabel}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.promptText}>
            {otherName
              ? `How was it working with ${otherName}?`
              : 'How was your experience?'}
          </Text>
          {job?.reviewState && !windowOpen && !alreadySubmitted ? (
            <Text style={styles.privacyCopy}>Review period ended</Text>
          ) : null}
          <Text style={styles.privacyCopy}>
            Your review will stay private until the other person submits theirs
            or the 14-day review period ends.
          </Text>
          <Text style={styles.sectionLabel}>Your rating</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const value = i + 1;
              const filled = rating >= value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    if (canSubmit) setRating(value);
                  }}
                  activeOpacity={0.75}
                  hitSlop={6}
                  disabled={!canSubmit}
                >
                  <Ionicons
                    name="star"
                    size={36}
                    color={filled ? colors.warning : colors.border}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Write your review</Text>
          <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
            <TextInput
              style={styles.input}
              placeholder="Share details about your experience..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={2000}
              editable={canSubmit}
            />
          </View>
          <Text style={styles.charCount}>{text.length}/2000</Text>

          <Text style={styles.sectionLabel}>
            Photos (optional · up to {MAX_REVIEW_IMAGES})
          </Text>
          <View style={styles.imagesRow}>
            {images.map((img) => (
              <View key={img.key} style={styles.thumbWrap}>
                <Image
                  source={{ uri: img.uri }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  hitSlop={6}
                  disabled={submitting}
                  accessibilityLabel="Remove photo"
                  onPress={() => removeImage(img.key)}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_REVIEW_IMAGES ? (
              <TouchableOpacity
                style={styles.addThumb}
                activeOpacity={0.8}
                disabled={submitting}
                accessibilityLabel="Add photo"
                onPress={() => void addImage()}
              >
                <Ionicons name="add" size={26} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {imageError ? <Text style={styles.imageError}>{imageError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {canSubmit ? (
            <Button
              title="Submit review"
              fullWidth
              loading={submitting}
              disabled={submitting || rating < 1 || alreadySubmitted}
              onPress={confirmSubmit}
            />
          ) : (
            <Button
              title="Submit review"
              fullWidth
              disabled
              onPress={() => undefined}
            />
          )}
        </View>
      </KeyboardAvoidingView>
      <ActionBusyOverlay visible={submitting} message="Submitting review…" />
      <SuccessConfirmationModal
        visible={submitted}
        title="Review submitted"
        message="Thanks for your feedback."
        onDone={() => {
          setSubmitted(false);
          if (route.params.conversationId) {
            navigation.navigate('ArchivedConversations');
          } else {
            navigation.goBack();
          }
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  deferredBanner: {
    backgroundColor: '#FEF9C3',
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  deferredTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#8A6A16',
  },
  deferredBody: {
    ...typography.caption,
    color: '#8A6A16',
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.borderLight,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personMeta: { flex: 1, gap: 4 },
  personName: { ...typography.label, color: colors.text },
  jobTitle: { ...typography.bodySmall, color: colors.textSecondary },
  promptText: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbWrap: { width: 72, height: 72 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.button,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageError: { ...typography.caption, color: colors.error },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    minHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 100,
    padding: 0,
  },
  privacyCopy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
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
