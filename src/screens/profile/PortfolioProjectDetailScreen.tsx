import React from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { useMyProfile } from '../../context/ProfileContext';
import { ScreenProps } from '../../navigation/types';
import { useVisitorProfessionalProfile } from '../../hooks/useVisitorProfessionalProfile';
import { PortfolioProject } from '../../data/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.85;

export default function PortfolioProjectDetailScreen({
  route,
  navigation,
}: ScreenProps<'PortfolioProjectDetail'>) {
  const insets = useSafeAreaInsets();
  const ownerUserId = route.params.userId;
  const isVisitorView = Boolean(ownerUserId);
  const { content, removePortfolioProject } = useMyProfile();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const visitor = useVisitorProfessionalProfile(
    isVisitorView ? ownerUserId : undefined,
  );

  const project: PortfolioProject | undefined = isVisitorView
    ? visitor.portfolio.find((p) => p.id === route.params.projectId)
    : content.portfolio.find((p) => p.id === route.params.projectId);

  if (isVisitorView && visitor.loading) {
    return (
      <ScreenContainer>
        <StatusBar style="dark" />
        <Text style={styles.missing}>{t('editor.loading')}</Text>
      </ScreenContainer>
    );
  }

  if (!project) {
    return (
      <ScreenContainer>
        <StatusBar style="dark" />
        <View style={[styles.missingTop, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name={backIcon()} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.missing}>{t('editor.projectNotFound')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.heroScroll}
          >
            {project.images.map((uri, index) => (
              <TouchableOpacity
                key={`${project.id}-hero-${index}`}
                activeOpacity={0.95}
                onPress={() =>
                  navigation.navigate('FullPhotoPreview', {
                    images: project.images,
                    initialIndex: index,
                  })
                }
              >
                <Image source={toImageSource(uri)} style={styles.heroImage} contentFit="cover" />
                {project.hasVideo &&
                index === (project.videoIndex ?? project.images.length - 1) ? (
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={56} color={colors.white} />
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name={backIcon()} size={22} color={colors.white} />
          </TouchableOpacity>
          {!isVisitorView ? (
            <View style={[styles.ownerActions, { top: insets.top + spacing.sm }]}>
              <TouchableOpacity
                style={styles.roundBtn}
                onPress={() =>
                  navigation.navigate('AddPortfolioProject', { projectId: project.id })
                }
              >
                <Ionicons name="pencil-outline" size={18} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.roundBtn} onPress={() => setDeleteOpen(true)}>
                <Ionicons name="trash-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : null}
          {project.images.length > 1 ? (
            <View style={styles.heroHint}>
              <Text style={styles.heroHintText}>
                {t('editor.photoCount', { count: project.images.length })}
                {project.hasVideo ? t('editor.includesVideo') : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.description}>{project.description}</Text>

          <Text style={styles.galleryLabel}>{t('editor.gallery')}</Text>
          <View style={styles.gallery}>
            {project.images.map((uri, index) => (
              <TouchableOpacity
                key={`${project.id}-thumb-${index}`}
                style={styles.thumb}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('FullPhotoPreview', {
                    images: project.images,
                    initialIndex: index,
                  })
                }
              >
                <Image source={toImageSource(uri)} style={styles.thumbImage} contentFit="cover" />
                {project.hasVideo &&
                index === (project.videoIndex ?? project.images.length - 1) ? (
                  <View style={styles.thumbPlay}>
                    <Ionicons name="play" size={16} color={colors.white} />
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('editor.deleteProjectTitle')}</Text>
            <Text style={styles.modalBody}>{t('editor.deleteProjectBody', { title: project.title })}</Text>
            <TouchableOpacity
              style={styles.modalDangerBtn}
              onPress={() => {
                setDeleteOpen(false);
                void removePortfolioProject(project.id).then(() =>
                  navigation.goBack(),
                );
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDangerText}>{t('common.delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setDeleteOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const THUMB = (SCREEN_WIDTH - spacing.screen * 2 - spacing.sm * 2) / 3;

const styles = StyleSheet.create({
  missingTop: {
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.lg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  heroWrap: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: colors.borderLight,
  },
  heroScroll: { flex: 1 },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: spacing.screen,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerActions: {
    position: 'absolute',
    right: spacing.screen,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  heroHintText: {
    ...typography.caption,
    color: colors.white,
  },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  galleryLabel: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.md,
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.button,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbPlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  modalDangerBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalDangerText: { ...typography.label, color: colors.white },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCancelText: { ...typography.label, color: colors.textSecondary },
});
