import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import LocationSelectors from '../../components/ui/LocationSelectors';
import UserAvatar from '../../components/ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { PROFILE_COVER_HEIGHT } from '../../constants/profile';
import { useMyProfile } from '../../context/ProfileContext';
import { ScreenProps } from '../../navigation/types';
import {
  pickLocalImage,
  uploadLocalFile,
  requireLocalFileByteSize,
} from '../../lib/uploadMedia';
import {
  normalizeCountryCode,
  type CountryCode,
} from '../../data/location/geo';
import { hasCustomAvatar } from '../../lib/avatar';

type MediaDraft =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'local'; uri: string; mimeType: string; byteSize: number; fileName: string };

export default function EditProfileScreen({
  navigation,
  route,
}: ScreenProps<'EditProfile'>) {
  const insets = useSafeAreaInsets();
  const { user, saveProfileBasics } = useMyProfile();

  const initialAvatar = hasCustomAvatar(user.avatar)
    ? (typeof user.avatar === 'string' ? user.avatar : String(user.avatar))
    : null;
  const initialCover = user.coverImage?.trim() || null;

  const [displayName, setDisplayName] = useState(user.name ?? '');
  const [title, setTitle] = useState(user.title ?? '');
  const [countryCode, setCountryCode] = useState<CountryCode | null>(
    normalizeCountryCode(user.countryCode),
  );
  const [locationCode, setLocationCode] = useState<string | null>(
    user.locationCode ?? null,
  );
  const [avatarDraft, setAvatarDraft] = useState<MediaDraft>({ kind: 'keep' });
  const [coverDraft, setCoverDraft] = useState<MediaDraft>({ kind: 'keep' });
  const [saving, setSaving] = useState(false);
  const [progressHint, setProgressHint] = useState<string | null>(null);

  // Cover crop screen returns a local URI into params (draft only).
  useEffect(() => {
    const uri = route.params?.coverDraftUri;
    if (!uri) return;
    let cancelled = false;
    (async () => {
      try {
        const byteSize = await requireLocalFileByteSize(uri);
        if (cancelled) return;
        setCoverDraft({
          kind: 'local',
          uri,
          mimeType: 'image/jpeg',
          byteSize,
          fileName: `cover-${Date.now()}.jpg`,
        });
        navigation.setParams({ coverDraftUri: undefined });
      } catch (err) {
        if (cancelled) return;
        navigation.setParams({ coverDraftUri: undefined });
        Alert.alert(
          t('editor.coverFailed'),
          err instanceof Error
            ? err.message
            : t('editor.coverSize'),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params?.coverDraftUri, navigation]);

  const previewAvatar =
    avatarDraft.kind === 'remove'
      ? ''
      : avatarDraft.kind === 'local'
        ? avatarDraft.uri
        : initialAvatar ?? '';

  const previewCover =
    coverDraft.kind === 'remove'
      ? null
      : coverDraft.kind === 'local'
        ? coverDraft.uri
        : initialCover;

  const isDirty = useMemo(() => {
    if (displayName.trim() !== (user.name ?? '').trim()) return true;
    if ((title.trim() || '') !== (user.title ?? '').trim()) return true;
    if (normalizeCountryCode(countryCode) !== normalizeCountryCode(user.countryCode)) {
      return true;
    }
    if ((locationCode ?? null) !== (user.locationCode ?? null)) return true;
    if (avatarDraft.kind !== 'keep') return true;
    if (coverDraft.kind !== 'keep') return true;
    return false;
  }, [
    displayName,
    title,
    countryCode,
    locationCode,
    avatarDraft,
    coverDraft,
    user,
  ]);

  const discardOrBack = useCallback(() => {
    if (!isDirty || saving) {
      navigation.goBack();
      return;
    }
    Alert.alert(t('editor.discardTitle'), t('editor.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('editor.discard'),
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  }, [isDirty, saving, navigation]);

  const pickAvatarLocal = async () => {
    try {
      const local = await pickLocalImage();
      if (!local) return;
      setAvatarDraft({ kind: 'local', ...local });
    } catch (err) {
      Alert.alert(
        t('editor.pickPhotoFailed'),
        err instanceof Error ? err.message : t('editor.tryAgain'),
      );
    }
  };

  const pickCoverLocal = async () => {
    try {
      const local = await pickLocalImage();
      if (!local) return;
      navigation.navigate('CoverReposition', { uri: local.uri });
    } catch (err) {
      Alert.alert(
        t('editor.pickCoverFailed'),
        err instanceof Error ? err.message : t('editor.tryAgain'),
      );
    }
  };

  const resolveMediaUrl = async (
    draft: MediaDraft,
    initialUrl: string | null,
    purpose: 'avatar' | 'cover',
  ): Promise<string | null | undefined> => {
    if (draft.kind === 'keep') return undefined;
    if (draft.kind === 'remove') return null;
    const photo = purpose === 'avatar';
    setProgressHint(t(photo ? 'editor.uploadingPhoto' : 'editor.uploadingCover'));
    const uploaded = await uploadLocalFile({
      ...draft,
      purpose,
      onProgress: (ratio) =>
        setProgressHint(
          t(photo ? 'editor.uploadingPhotoPercent' : 'editor.uploadingCoverPercent', {
            percent: Math.round(ratio * 100),
          }),
        ),
    });
    return uploaded.remoteUrl;
  };

  const save = async () => {
    const name = displayName.trim();
    if (name.length < 2) {
      Alert.alert(t('editor.nameRequired'), t('editor.nameTooShort'));
      return;
    }

    setSaving(true);
    setProgressHint(null);
    let uploadedAvatar: string | null | undefined;
    let uploadedCover: string | null | undefined;
    try {
      uploadedAvatar = await resolveMediaUrl(
        avatarDraft,
        initialAvatar,
        'avatar',
      );
      uploadedCover = await resolveMediaUrl(
        coverDraft,
        initialCover,
        'cover',
      );

      setProgressHint(t('editor.savingProfile'));
      await saveProfileBasics({
        name,
        title: title.trim() || null,
        ...(countryCode && locationCode
          ? { countryCode, locationCode }
          : { countryCode: null, locationCode: null }),
        ...(uploadedAvatar !== undefined ? { avatarUrl: uploadedAvatar } : {}),
        ...(uploadedCover !== undefined ? { coverUrl: uploadedCover } : {}),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t('editor.saveProfileFailed'),
        err instanceof Error ? err.message : t('editor.pleaseTryAgain'),
      );
      // Draft preserved; newly uploaded URLs are unreferenced — lifecycle cleanup deferred.
    } finally {
      setSaving(false);
      setProgressHint(null);
    }
  };

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={discardOrBack} style={styles.iconBtn} disabled={saving}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('editor.editProfile')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.coverPreview}>
            {previewCover ? (
              <Image
                source={previewCover ? toImageSource(previewCover) : undefined}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.coverFallback]} />
            )}
            {previewCover ? (
              <TouchableOpacity
                style={styles.coverRemoveBtn}
                onPress={() => setCoverDraft({ kind: 'remove' })}
                disabled={saving}
                hitSlop={8}
                accessibilityLabel={t('editor.removeCover')}
              >
                <Ionicons name="close" size={16} color={colors.white} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.coverActions}>
            <Button
              title={previewCover ? t('editor.changeCover') : t('editor.addCover')}
              variant="outline"
              size="sm"
              onPress={() => {
                void pickCoverLocal();
              }}
              disabled={saving}
              style={styles.mediaActionBtn}
            />
          </View>

          <View style={styles.avatarWrap}>
            <UserAvatar uri={previewAvatar} size={72} style={styles.avatar} />
            {hasCustomAvatar(previewAvatar) ? (
              <TouchableOpacity
                style={styles.avatarRemoveBtn}
                onPress={() => setAvatarDraft({ kind: 'remove' })}
                disabled={saving}
                hitSlop={8}
                accessibilityLabel={t('editor.removePhoto')}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.avatarActions}>
            <Button
              title={hasCustomAvatar(previewAvatar) ? t('editor.changePhoto') : t('editor.addPhoto')}
              variant="outline"
              size="sm"
              onPress={() => {
                void pickAvatarLocal();
              }}
              disabled={saving}
              style={styles.mediaActionBtn}
            />
          </View>

          {progressHint ? (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.avatarHint}>{progressHint}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>{t('editor.displayName')}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('editor.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!saving}
          />

          <Text style={styles.label}>{t('editor.title')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('editor.titlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!saving}
          />
          <View style={styles.locationBlock}>
            <LocationSelectors
              countryCode={countryCode}
              locationCode={locationCode}
              onCountryChange={setCountryCode}
              onLocationChange={(code) => setLocationCode(code || null)}
              compact
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Button
            title={saving ? t('editor.saving') : t('common.save')}
            onPress={() => {
              void save();
            }}
            disabled={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const EDIT_COVER_PREVIEW_HEIGHT = Math.round(PROFILE_COVER_HEIGHT * 0.72);

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.text },
  content: { paddingBottom: spacing.sm, alignItems: 'center' },
  coverPreview: {
    alignSelf: 'stretch',
    height: EDIT_COVER_PREVIEW_HEIGHT,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  coverFallback: { backgroundColor: colors.primary },
  coverRemoveBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 36, 58, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  coverActions: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
  },
  mediaActionBtn: {
    minWidth: 160,
    paddingHorizontal: spacing.md,
  },
  avatarWrap: {
    marginTop: spacing.sm,
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarRemoveBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 36, 58, 0.55)',
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarActions: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    alignSelf: 'stretch',
    marginBottom: 2,
    paddingHorizontal: spacing.screen,
  },
  input: {
    ...typography.body,
    color: colors.text,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.screen,
  },
  locationBlock: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.screen,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
