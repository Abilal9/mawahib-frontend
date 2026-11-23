import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import ReorderableMediaGrid from '../../components/ui/ReorderableMediaGrid';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { useMyProfile } from '../../context/ProfileContext';
import { ScreenProps } from '../../navigation/types';
import { requiredTitle } from '../../domain/truthfulFacts';
import { pickAndUploadImage } from '../../lib/uploadMedia';

const MAX_MEDIA = 10;

type MediaItem = { uri: string; mediaAssetId: string };

export default function AddPortfolioProjectScreen({
  navigation,
  route,
}: ScreenProps<'AddPortfolioProject'>) {
  const insets = useSafeAreaInsets();
  const { content, addPortfolioProject, updatePortfolioProject } = useMyProfile();
  const editingId = route.params?.projectId;
  const existing = editingId
    ? content.portfolio.find((p) => p.id === editingId)
    : undefined;
  const isEditing = Boolean(existing);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [media, setMedia] = useState<MediaItem[]>(() => {
    if (!existing) return [];
    const ids = existing.mediaAssetIds ?? [];
    return existing.images
      .map((uri, index) =>
        ids[index] ? { uri, mediaAssetId: ids[index] } : null,
      )
      .filter((item): item is MediaItem => Boolean(item));
  });
  const [mediaDragging, setMediaDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const addMedia = async () => {
    if (media.length >= MAX_MEDIA || uploading) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const uploaded = await pickAndUploadImage('portfolio', setUploadProgress);
      if (!uploaded) return;
      setMedia((prev) => [
        ...prev,
        { uri: uploaded.remoteUrl, mediaAssetId: uploaded.mediaAssetId },
      ]);
    } catch (err) {
      Alert.alert(
        t('editor.uploadFailed'),
        err instanceof Error ? err.message : t('editor.uploadFailedBody'),
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const save = async () => {
    if (media.length === 0) {
      Alert.alert(t('editor.addMedia'), t('editor.addMediaBody'));
      return;
    }
    let trimmedTitle: string;
    try {
      trimmedTitle = requiredTitle(title, 'project title');
    } catch {
      Alert.alert(t('editor.addTitle'), t('editor.enterProjectTitle'));
      return;
    }
    const trimmedDesc = description.trim();
    const mediaAssetIds = media.map((m) => m.mediaAssetId);

    try {
      setSaving(true);
      if (isEditing && existing) {
        await updatePortfolioProject(existing.id, {
          title: trimmedTitle,
          description: trimmedDesc,
          mediaAssetIds,
        });
      } else {
        await addPortfolioProject({
          title: trimmedTitle,
          description: trimmedDesc,
          mediaAssetIds,
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t('editor.saveProjectFailed'),
        err instanceof Error ? err.message : t('editor.saveProjectFailedBody'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? t('editor.editProject') : t('editor.addProjectTitle')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!mediaDragging}
        >
          <Text style={styles.label}>{t('editor.projectTitle')}</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          <Text style={styles.label}>{t('editor.description')}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.mediaHeader}>
            <Text style={styles.labelInline}>{t('editor.projectMedia')}</Text>
            <Text style={styles.mediaCount}>
              {media.length}/{MAX_MEDIA}
            </Text>
          </View>
          {(uploading || uploadProgress != null) && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.progressText}>
                {uploadProgress != null
                  ? t('editor.uploadingPercent', { percent: Math.round(uploadProgress * 100) })
                  : t('editor.uploading')}
              </Text>
            </View>
          )}
          <ReorderableMediaGrid
            uris={media.map((m) => m.uri)}
            onChange={(uris) => {
              const byUri = new Map(media.map((m) => [m.uri, m]));
              setMedia(
                uris
                  .map((uri) => byUri.get(uri))
                  .filter((item): item is MediaItem => Boolean(item)),
              );
            }}
            maxItems={MAX_MEDIA}
            onAdd={() => {
              void addMedia();
            }}
            videoIndex={media.length > 4 ? 4 : undefined}
            onDraggingChange={setMediaDragging}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button
            title={saving ? t('editor.saving') : isEditing ? t('editor.saveChanges') : t('editor.addProject')}
            onPress={() => {
              void save();
            }}
            disabled={saving || uploading || title.trim().length === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.text },
  content: { padding: spacing.screen, paddingBottom: spacing.xxl },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  labelInline: { ...typography.label, color: colors.textSecondary },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  multiline: { minHeight: 110 },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mediaCount: { ...typography.caption, color: colors.textSecondary },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressText: { ...typography.caption, color: colors.textSecondary },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
