import React, { useCallback, useRef, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import ChatImageLightbox from '../../components/messaging/ChatImageLightbox';
import { colors, spacing, typography } from '../../theme';
import { messagingApi, type ConversationMediaItem } from '../../services/messagingApi';
import { getMediaCacheKey } from '../../lib/mediaCacheKey';
import { toImageSource } from '../../utils/image';
import { useIdentityGeneration } from '../../hooks/useIdentityGeneration';
import { ScreenProps } from '../../navigation/types';

const COLUMNS = 3;
const GAP = 2;

export default function ConversationMediaScreen({
  navigation,
  route,
}: ScreenProps<'ConversationMedia'>) {
  const { conversationId } = route.params;
  const { userId, identityChanged, snapshot, isStale } =
    useIdentityGeneration(conversationId);
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  const [items, setItems] = useState<ConversationMediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const loadingMoreRef = useRef(false);

  if (identityChanged) {
    setItems([]);
    setNextCursor(null);
    setLoading(true);
    setLoadingMore(false);
    setLoadError(false);
    setLightboxOpen(false);
  }

  const loadFirst = useCallback(async () => {
    const started = snapshot();
    if (!started.userId || isStale(started.userId, started.epoch)) return;
    setLoading(true);
    try {
      const page = await messagingApi.listConversationMedia(conversationId, {
        limit: 40,
      });
      if (isStale(started.userId, started.epoch)) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setLoadError(false);
    } catch (e) {
      console.warn('[conversation-media] load failed', e);
      if (!isStale(started.userId, started.epoch)) setLoadError(true);
    } finally {
      if (!isStale(started.userId, started.epoch)) setLoading(false);
    }
  }, [conversationId, isStale, snapshot]);

  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst, userId]),
  );

  const loadMore = async () => {
    if (!nextCursor || loadingMoreRef.current || loading) return;
    const started = snapshot();
    if (!started.userId || isStale(started.userId, started.epoch)) return;
    const cursor = nextCursor;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await messagingApi.listConversationMedia(conversationId, {
        cursor,
        limit: 40,
      });
      if (isStale(started.userId, started.epoch)) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      console.warn('[conversation-media] load more failed', e);
    } finally {
      loadingMoreRef.current = false;
      if (!isStale(started.userId, started.epoch)) setLoadingMore(false);
    }
  };

  const urls = items
    .map((i) => i.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  const openAt = (item: ConversationMediaItem) => {
    if (!item.url) return;
    const visible = items.filter(
      (entry) => typeof entry.url === 'string' && entry.url.length > 0,
    );
    const index = visible.findIndex((entry) => entry.id === item.id);
    setLightboxIndex(index >= 0 ? index : 0);
    setLightboxOpen(true);
  };

  return (
    <ScreenContainer padded={false} safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Media</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loadError ? (
              <View>
                <Text style={styles.empty}>Could not load media.</Text>
                <TouchableOpacity
                  onPress={() => void loadFirst()}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Text style={styles.retry}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.empty}>No media has been shared yet.</Text>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={styles.footerSpinner}
                color={colors.primary}
              />
            ) : undefined
          }
          renderItem={({ item, index }) => {
            const col = index % COLUMNS;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openAt(item)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  marginRight: col < COLUMNS - 1 ? GAP : 0,
                  marginBottom: GAP,
                  backgroundColor: colors.background,
                }}
              >
                {item.url ? (
                  <Image
                    source={toImageSource(item.url)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    recyclingKey={getMediaCacheKey(item.url) ?? item.id}
                  />
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <ChatImageLightbox
        visible={lightboxOpen}
        images={urls}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h2, color: colors.text },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  retry: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  footerSpinner: { marginVertical: spacing.lg },
});
