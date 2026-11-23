import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { PROFILE_COVER_HEIGHT } from '../../constants/profile';
import { requireLocalFileByteSize } from '../../lib/uploadMedia';
import { ScreenProps } from '../../navigation/types';

const SCREEN_W = Dimensions.get('window').width;

/**
 * LinkedIn-style cover reposition: pan within the Profile header aspect,
 * then export a final cropped JPEG for Edit Profile draft (upload on Save).
 */
export default function CoverRepositionScreen({
  navigation,
  route,
}: ScreenProps<'CoverReposition'>) {
  const { uri } = route.params;
  const insets = useSafeAreaInsets();
  const frameW = SCREEN_W;
  const frameH = PROFILE_COVER_HEIGHT;

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => setNatural({ w, h }),
      () => {
        Alert.alert(t('editor.imageFailed'), t('editor.pickAnother'));
        navigation.goBack();
      },
    );
  }, [uri, navigation]);

  const baseScale = useMemo(() => {
    if (!natural) return 1;
    return Math.max(frameW / natural.w, frameH / natural.h);
  }, [natural, frameW, frameH]);

  const displayScale = baseScale * zoom;
  const displayW = natural ? natural.w * displayScale : frameW;
  const displayH = natural ? natural.h * displayScale : frameH;

  const clampOffset = useCallback(
    (x: number, y: number) => {
      const minX = Math.min(0, frameW - displayW);
      const maxX = 0;
      const minY = Math.min(0, frameH - displayH);
      const maxY = 0;
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      };
    },
    [displayW, displayH, frameW, frameH],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = { ...offsetRef.current };
        },
        onPanResponderMove: (_, g) => {
          const next = clampOffset(
            dragStart.current.x + g.dx,
            dragStart.current.y + g.dy,
          );
          offsetRef.current = next;
          setOffset(next);
        },
      }),
    [clampOffset],
  );

  useEffect(() => {
    const next = clampOffset(offsetRef.current.x, offsetRef.current.y);
    offsetRef.current = next;
    setOffset(next);
  }, [clampOffset, zoom]);

  const adjustZoom = (delta: number) => {
    setZoom((z) => Math.max(1, Math.min(3, Math.round((z + delta) * 10) / 10)));
  };

  const confirm = async () => {
    if (!natural) return;
    setBusy(true);
    try {
      const originX = Math.max(0, -offsetRef.current.x / displayScale);
      const originY = Math.max(0, -offsetRef.current.y / displayScale);
      const cropW = Math.min(natural.w - originX, frameW / displayScale);
      const cropH = Math.min(natural.h - originY, frameH / displayScale);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.max(1, Math.round(cropW)),
              height: Math.max(1, Math.round(cropH)),
            },
          },
          { resize: { width: Math.round(frameW * 2) } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      // Ensure cropped file is readable with a real size before returning to Edit Profile.
      await requireLocalFileByteSize(result.uri);

      // RN7: navigate() pushes a new route by default. pop:true returns to the
      // existing EditProfile instance so its local draft (title, etc.) survives.
      navigation.navigate({
        name: 'EditProfile',
        params: { coverDraftUri: result.uri },
        merge: true,
        pop: true,
      });
    } catch (err) {
      Alert.alert(
        t('editor.cropFailed'),
        err instanceof Error ? err.message : t('editor.cropFailedBody'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          disabled={busy}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('editor.repositionCover')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.hintWrap}>
        <Text style={styles.hint}>{t('editor.repositionHint')}</Text>
      </View>

      <View style={[styles.frame, { width: frameW, height: frameH }]} {...panResponder.panHandlers}>
        {natural ? (
          <Image
            source={{ uri }}
            style={{
              width: displayW,
              height: displayH,
              transform: [{ translateX: offset.x }, { translateY: offset.y }],
            }}
            resizeMode="cover"
          />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>

      <View style={styles.zoomRow}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(-0.2)}>
          <Ionicons name="remove" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(0.2)}>
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          title={busy ? t('editor.processing') : t('editor.useFraming')}
          onPress={() => {
            void confirm();
          }}
          disabled={busy || !natural}
        />
      </View>
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
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.text },
  hintWrap: { alignItems: 'center', marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary },
  frame: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: {
    ...typography.bodySmall,
    color: colors.text,
    minWidth: 48,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
});
