import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import ConversationSwipeRow from '../../components/messaging/ConversationSwipeRow';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../../components/ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import { INBOX_POLL_MS } from '../../config/messaging';
import { usePolling } from '../../hooks/usePolling';
import {
  conversationPreview,
  isConversationUnread,
  messageService,
} from '../../services/messageService';
import { useIdentityGeneration } from '../../hooks/useIdentityGeneration';
import type { ApiConversation } from '../../services/messagingApi';
import { useAuth } from '../../context/AuthContext';
import { useMessagingUnread } from '../../context/MessagingUnreadContext';
import { TabScreenProps } from '../../navigation/types';
import { syncChatPushRegistration } from '../../lib/chatPushRuntime';

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function typeBadge(type: ApiConversation['type']): string {
  if (type === 'work') return 'Job';
  if (type === 'connection') return 'Connection';
  return 'Support';
}

export default function MessagesInboxScreen({
  navigation,
}: TabScreenProps<'MessagesTab'>) {
  const { isSignedIn } = useAuth();
  const { userId, identityChanged, snapshot, isStale } =
    useIdentityGeneration('inbox');
  const { refresh: refreshUnread } = useMessagingUnread();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (identityChanged) {
    setConversations([]);
    setLoading(true);
    setRefreshing(false);
    setLoadError(false);
  }

  const load = useCallback(async (mode: 'poll' | 'refresh' = 'poll') => {
    const started = snapshot();
    if (!started.userId || isStale(started.userId, started.epoch)) {
      if (!isStale(started.userId, started.epoch)) {
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    if (mode === 'refresh') setRefreshing(true);
    try {
      const items = await messageService.listConversations(undefined, 'inbox');
      if (isStale(started.userId, started.epoch)) return;
      setConversations(items);
      setLoadError(false);
      void refreshUnread();
    } catch (e) {
      console.warn('[inbox] load failed', e);
      if (!isStale(started.userId, started.epoch)) setLoadError(true);
    } finally {
      if (!isStale(started.userId, started.epoch)) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isStale, refreshUnread, snapshot]);

  const askedForPush = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!askedForPush.current) {
        askedForPush.current = true;
        void syncChatPushRegistration(true).catch(() => undefined);
      }
      setFocused(true);
      setLoading(true);
      void load();
      return () => {
        setFocused(false);
        setSwipedId(null);
      };
    }, [load, userId]),
  );

  usePolling(
    () => void load('poll'),
    INBOX_POLL_MS,
    focused && isSignedIn && Boolean(userId),
    { immediate: false },
  );

  const confirmArchive = async () => {
    if (!archiveTargetId) return;
    setBusy(true);
    try {
      await messageService.archive(archiveTargetId);
      setConversations((prev) =>
        prev.filter((c) => c.id !== archiveTargetId),
      );
      void refreshUnread();
      setSwipedId(null);
      setArchiveTargetId(null);
    } catch (e) {
      Alert.alert(
        'Could not archive',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setBusy(true);
    try {
      await messageService.softDelete(deleteTargetId);
      setConversations((prev) => prev.filter((c) => c.id !== deleteTargetId));
      void refreshUnread();
      setSwipedId(null);
      setDeleteTargetId(null);
    } catch (e) {
      Alert.alert(
        'Could not delete',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer padded={false} safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('ArchivedConversations')}
          hitSlop={8}
          accessibilityLabel="Archived conversations"
        >
          <Ionicons name="archive-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setSwipedId(null)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load('refresh')}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            loadError ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>Could not load conversations.</Text>
                <TouchableOpacity
                  onPress={() => void load('refresh')}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Text style={styles.retry}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.empty}>
                No conversations yet. Connect with someone or start a job to
                message here.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const unread = isConversationUnread(item);
            const name =
              item.type === 'work' && item.workContext?.title
                ? item.peer?.displayName ?? 'Job chat'
                : item.peer?.displayName ?? 'Conversation';
            const subtitle = conversationPreview(item);
            return (
              <ConversationSwipeRow
                open={swipedId === item.id}
                onOpenChange={(next) =>
                  setSwipedId(next ? item.id : null)
                }
                onPressArchive={() => {
                  setSwipedId(item.id);
                  setArchiveTargetId(item.id);
                }}
                onPressDelete={() => {
                  setSwipedId(item.id);
                  setDeleteTargetId(item.id);
                }}
                onPress={() =>
                  navigation.navigate('Chat', { conversationId: item.id })
                }
              >
                <View style={styles.conversation}>
                  <UserAvatar
                    uri={item.peer?.avatarUrl}
                    size={52}
                    style={styles.avatar}
                  />
                  <View style={styles.content}>
                    <View style={styles.topRow}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {name}
                        </Text>
                        <View
                          style={[
                            styles.badgeType,
                            item.type === 'work' && styles.badgeTypeWork,
                          ]}
                        >
                          <Text style={styles.badgeTypeText}>
                            {typeBadge(item.type)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.time}>
                        {formatTime(item.lastMessageAt)}
                      </Text>
                    </View>
                    <View style={styles.bottomRow}>
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {subtitle}
                      </Text>
                      {unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                  </View>
                </View>
              </ConversationSwipeRow>
            );
          }}
        />
      )}

      <ConfirmActionModal
        visible={archiveTargetId != null}
        title="Archive Conversation?"
        message="This conversation will be moved to your Archived Conversations. You can restore it at any time."
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveTargetId(null)}
        onConfirm={() => void confirmArchive()}
      />

      <ConfirmActionModal
        visible={deleteTargetId != null}
        title="Delete Conversation?"
        message="This will remove the conversation from your inbox. This only affects your account."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => void confirmDelete()}
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
  headerTitle: { ...typography.h2, color: colors.text },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.screen, paddingBottom: 120, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center' },
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
  conversation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.avatar },
  content: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  name: { ...typography.label, color: colors.text, flexShrink: 1 },
  badgeType: {
    backgroundColor: colors.background,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTypeWork: {
    backgroundColor: '#E0ECFF',
  },
  badgeTypeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  time: { ...typography.caption, color: colors.textSecondary },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  lastMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginStart: spacing.sm,
  },
});
