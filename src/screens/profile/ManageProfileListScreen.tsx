import React, { useCallback, useEffect, useRef, useState } from 'react';
import { chevronBackIcon } from '../../i18n/direction';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  PanResponder,
  LayoutAnimation,
  UIManager,
  Platform,
  Animated,
  type PanResponderInstance,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { toImageSource } from '../../utils/image';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { useMyProfile } from '../../context/ProfileContext';
import { PortfolioProject, ProfileService } from '../../data/types';
import { ScreenProps } from '../../navigation/types';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ListItem = PortfolioProject | ProfileService;

/** Fallback until the first row measures itself (card height + margin). */
const DEFAULT_ROW_STRIDE = 94;

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function shiftForIndex(
  index: number,
  from: number,
  hover: number,
  stride: number
): number {
  if (from < 0 || hover < 0 || from === hover) return 0;
  if (from < hover) {
    if (index > from && index <= hover) return -stride;
  } else if (index >= hover && index < from) {
    return stride;
  }
  return 0;
}

export default function ManageProfileListScreen({
  navigation,
  route,
}: ScreenProps<'ManageProfileList'>) {
  const { type } = route.params;
  const isPortfolio = type === 'portfolio';
  const insets = useSafeAreaInsets();
  const { content, setPortfolio, setServices, removePortfolioProject, removeService } =
    useMyProfile();

  const contextList = isPortfolio ? content.portfolio : content.services;
  const [draft, setDraft] = useState<ListItem[]>(() => [...contextList]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const removedIdsRef = useRef(new Set<string>());
  const baselineIdsRef = useRef(contextList.map((i) => i.id).join(','));
  const allowLeaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const rowStrideRef = useRef(DEFAULT_ROW_STRIDE);
  const draggingIdRef = useRef<string | null>(null);
  const dragFromIndexRef = useRef(-1);
  const hoverIndexRef = useRef(-1);
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const panByIdRef = useRef<Record<string, PanResponderInstance>>({});

  const isDirty =
    removedIdsRef.current.size > 0 ||
    draft.map((i) => i.id).join(',') !== baselineIdsRef.current;
  dirtyRef.current = isDirty;

  const resetDragVisuals = useCallback(() => {
    draggingIdRef.current = null;
    dragFromIndexRef.current = -1;
    hoverIndexRef.current = -1;
    dragTranslateY.setValue(0);
    setDraggingId(null);
    setHoverIndex(null);
  }, [dragTranslateY]);

  const activateDrag = useCallback(
    (itemId: string) => {
      const index = draftRef.current.findIndex((i) => i.id === itemId);
      if (index < 0) return;
      draggingIdRef.current = itemId;
      dragFromIndexRef.current = index;
      hoverIndexRef.current = index;
      dragTranslateY.setValue(0);
      setDraggingId(itemId);
      setHoverIndex(index);
    },
    [dragTranslateY]
  );

  const updateDragPosition = useCallback(
    (gestureDy: number) => {
      const from = dragFromIndexRef.current;
      if (from < 0 || draggingIdRef.current == null) return;

      const stride = rowStrideRef.current || DEFAULT_ROW_STRIDE;
      dragTranslateY.setValue(gestureDy);

      const target = Math.max(
        0,
        Math.min(
          draftRef.current.length - 1,
          from + Math.round(gestureDy / stride)
        )
      );
      if (target !== hoverIndexRef.current) {
        hoverIndexRef.current = target;
        setHoverIndex(target);
      }
    },
    [dragTranslateY]
  );

  const commitDrag = useCallback(() => {
    const from = dragFromIndexRef.current;
    const to = hoverIndexRef.current;
    const wasActive = draggingIdRef.current != null;

    if (wasActive && from >= 0 && to >= 0 && from !== to) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDraft((prev) => {
        const next = reorder(prev, from, to);
        draftRef.current = next;
        return next;
      });
    }

    resetDragVisuals();
  }, [resetDragVisuals]);

  // Keep pan responders forever-stable; call through refs so handlers stay fresh.
  const activateDragRef = useRef(activateDrag);
  const updateDragPositionRef = useRef(updateDragPosition);
  const commitDragRef = useRef(commitDrag);
  const resetDragVisualsRef = useRef(resetDragVisuals);
  activateDragRef.current = activateDrag;
  updateDragPositionRef.current = updateDragPosition;
  commitDragRef.current = commitDrag;
  resetDragVisualsRef.current = resetDragVisuals;

  const getPanResponder = useCallback((itemId: string) => {
    const existing = panByIdRef.current[itemId];
    if (existing) return existing;

    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        activateDragRef.current(itemId);
      },
      onPanResponderMove: (
        _: GestureResponderEvent,
        gesture: PanResponderGestureState
      ) => {
        if (draggingIdRef.current !== itemId) return;
        updateDragPositionRef.current(gesture.dy);
      },
      onPanResponderRelease: () => {
        if (draggingIdRef.current === itemId) {
          commitDragRef.current();
        }
      },
      onPanResponderTerminate: () => {
        if (draggingIdRef.current === itemId) {
          commitDragRef.current();
        } else {
          resetDragVisualsRef.current();
        }
      },
    });

    panByIdRef.current[itemId] = pan;
    return pan;
  }, [dragTranslateY]);

  // Drop responders for deleted items; keep existing ones stable across reorders.
  useEffect(() => {
    const ids = new Set(draft.map((item) => item.id));
    for (const id of Object.keys(panByIdRef.current)) {
      if (!ids.has(id)) {
        delete panByIdRef.current[id];
      }
    }
  }, [draft]);

  const mergeFromContext = useCallback(() => {
    const ctx = isPortfolio ? content.portfolio : content.services;
    const ctxById = new Map(ctx.map((item) => [item.id, item]));

    setDraft((prev) => {
      if (
        removedIdsRef.current.size === 0 &&
        prev.map((i) => i.id).join(',') === baselineIdsRef.current
      ) {
        baselineIdsRef.current = ctx.map((i) => i.id).join(',');
        return [...ctx];
      }

      const next: ListItem[] = [];
      for (const item of prev) {
        if (removedIdsRef.current.has(item.id)) continue;
        const fresh = ctxById.get(item.id);
        if (fresh) next.push(fresh);
      }

      const nextIds = new Set(next.map((i) => i.id));
      for (const item of ctx) {
        if (!nextIds.has(item.id) && !removedIdsRef.current.has(item.id)) {
          next.push(item);
        }
      }
      return next;
    });
  }, [content.portfolio, content.services, isPortfolio]);

  useFocusEffect(
    useCallback(() => {
      mergeFromContext();
    }, [mergeFromContext])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current || !dirtyRef.current) return;
      e.preventDefault();
      Alert.alert(t('editor.discardTitle'), t('editor.discardList'), [
        { text: t('editor.keepEditing'), style: 'cancel' },
        {
          text: t('editor.discard'),
          style: 'destructive',
          onPress: () => {
            allowLeaveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  const requestLeave = () => {
    if (!isDirty) {
      allowLeaveRef.current = true;
      navigation.goBack();
      return;
    }
    Alert.alert(t('editor.discardTitle'), t('editor.discardList'), [
      { text: t('editor.keepEditing'), style: 'cancel' },
      {
        text: t('editor.discard'),
        style: 'destructive',
        onPress: () => {
          allowLeaveRef.current = true;
          navigation.goBack();
        },
      },
    ]);
  };

  const handleSave = () => {
    void (async () => {
      try {
        const removed = [...removedIdsRef.current];
        for (const id of removed) {
          if (isPortfolio) {
            await removePortfolioProject(id);
          } else {
            await removeService(id);
          }
        }
        if (isPortfolio) {
          await setPortfolio(draft as PortfolioProject[]);
        } else {
          await setServices(draft as ProfileService[]);
        }
        allowLeaveRef.current = true;
        navigation.goBack();
      } catch (err) {
        Alert.alert(
          t('editor.saveProjectFailed'),
          err instanceof Error ? err.message : t('editor.saveListFailed'),
        );
      }
    })();
  };

  const confirmDelete = useCallback(
    (id: string, itemTitle: string) => {
      Alert.alert(
        isPortfolio ? t('editor.deleteProjectTitle') : t('editor.deleteServiceTitle'),
        isPortfolio
          ? t('editor.removePortfolio', { title: itemTitle })
          : t('editor.removeService', { title: itemTitle }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              removedIdsRef.current.add(id);
              setDraft((prev) => prev.filter((item) => item.id !== id));
            },
          },
        ]
      );
    },
    [isPortfolio]
  );

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (height > 0) {
      // Include the card's bottom margin so stride matches visual spacing.
      rowStrideRef.current = height + spacing.md;
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      const isActive = draggingId === item.id;
      const from = dragFromIndexRef.current;
      const hover = hoverIndex ?? from;
      const stride = rowStrideRef.current || DEFAULT_ROW_STRIDE;
      const shiftY =
        isActive || draggingId == null
          ? 0
          : shiftForIndex(index, from, hover, stride);
      const panHandlers = getPanResponder(item.id).panHandlers;

      return (
        <Animated.View
          onLayout={isActive || draggingId == null ? onCardLayout : undefined}
          style={[
            styles.card,
            isActive && styles.cardActive,
            isActive
              ? {
                  transform: [{ translateY: dragTranslateY }],
                  zIndex: 20,
                  elevation: 8,
                }
              : shiftY !== 0
                ? {
                    transform: [{ translateY: shiftY }],
                    zIndex: 1,
                  }
                : null,
          ]}
          pointerEvents={draggingId != null && !isActive ? 'none' : 'auto'}
        >
          <View
            {...panHandlers}
            style={styles.dragHandle}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('editor.reorder')}
          >
            <Ionicons name="reorder-three" size={28} color={colors.textSecondary} />
          </View>

          <View style={styles.cardMain}>
            {'images' in item && item.images[0] ? (
              <Image
                source={toImageSource(item.images[0])}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons
                  name={isPortfolio ? 'briefcase-outline' : 'document-text-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          </View>

          <View style={styles.manageActions}>
            <TouchableOpacity
              style={styles.manageIconBtn}
              disabled={draggingId != null}
              onPress={() => {
                if (isPortfolio) {
                  navigation.navigate('AddPortfolioProject', {
                    projectId: item.id,
                  });
                } else {
                  navigation.navigate('AddProfileService', {
                    serviceId: item.id,
                  });
                }
              }}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manageIconBtn}
              disabled={draggingId != null}
              onPress={() => confirmDelete(item.id, item.title)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    },
    [
      confirmDelete,
      dragTranslateY,
      draggingId,
      getPanResponder,
      hoverIndex,
      isPortfolio,
      navigation,
      onCardLayout,
    ]
  );

  const title = isPortfolio ? t('editor.editPortfolio') : t('editor.editServices');
  const isDragging = draggingId != null;

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={requestLeave} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name={chevronBackIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerIcon} />
      </View>

      <FlatList
        data={draft}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDragging}
        removeClippedSubviews={false}
        ListHeaderComponent={
          <Text style={styles.hint}>{t('editor.reorderHint')}</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isPortfolio ? t('editor.emptyProjects') : t('editor.emptyServices')}
          </Text>
        }
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={requestLeave}
          style={styles.footerBtn}
        />
        <Button title={t('common.save')} onPress={handleSave} style={styles.footerBtn} />
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.text },
  list: { flex: 1 },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  empty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.md,
    paddingEnd: spacing.md,
    paddingStart: spacing.xs,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.background,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dragHandle: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    minWidth: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2, minWidth: 0 },
  cardTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  manageActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  manageIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerBtn: { flex: 1 },
});
