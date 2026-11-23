import React, { useCallback, useEffect, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../../components/ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import {
  conversationPreview,
  messageService,
} from '../../services/messageService';
import { useIdentityGeneration } from '../../hooks/useIdentityGeneration';
import type { ApiConversation } from '../../services/messagingApi';
import { useAuth } from '../../context/AuthContext';
import { useMessagingUnread } from '../../context/MessagingUnreadContext';
import { ScreenProps } from '../../navigation/types';

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

export default function ArchivedConversationsScreen({
  navigation,
}: ScreenProps<'ArchivedConversations'>) {
  const { isSignedIn } = useAuth();
  const { userId, identityChanged, snapshot, isStale } =
    useIdentityGeneration('archived');
  const { refresh: refreshUnread } = useMessagingUnread();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (identityChanged) {
    setConversations([]);
    setLoading(true);
    setLoadError(false);
  }

  const load = useCallback(async () => {
    const started = snapshot();
    if (!isSignedIn || !started.userId || isStale(started.userId, started.epoch)) {
      if (!isStale(started.userId, started.epoch)) {
        setConversations([]);
        setLoading(false);
      }
      return;
    }
    try {
      const items = await messageService.listConversations(undefined, 'archived');
      if (isStale(started.userId, started.epoch)) return;
      setConversations(items);
      setLoadError(false);
      void refreshUnread();
    } catch (e) {
      console.warn('[archived] load failed', e);
      if (!isStale(started.userId, started.epoch)) setLoadError(true);
    } finally {
      if (!isStale(started.userId, started.epoch)) setLoading(false);
    }
  }, [isSignedIn, isStale, refreshUnread, snapshot]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    void load();
  }, [userId, load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      await messageService.unarchive(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      void refreshUnread();
    } catch (e) {
      Alert.alert(
        'Could not restore',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = (id: string) => {
    Alert.alert(
      'Delete conversation',
      'This removes the conversation from your list. The other person keeps their copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(id);
              try {
                await messageService.softDelete(id);
                setConversations((prev) => prev.filter((c) => c.id !== id));
                void refreshUnread();
              } catch (e) {
                Alert.alert(
                  'Could not delete',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const openOverflow = (item: ApiConversation) => {
    Alert.alert(item.peer?.displayName ?? 'Conversation', undefined, [
      {
        text: 'Restore',
        onPress: () => void restore(item.id),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove(item.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer padded={false} safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={8}
        >
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived</Text>
        <View style={styles.headerBtn} />
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
          ListEmptyComponent={
            loadError ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>Could not load archived conversations.</Text>
                <TouchableOpacity
                  onPress={() => void load()}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Text style={styles.retry}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.empty}>No archived conversations.</Text>
            )
          }
          renderItem={({ item }) => {
            const name =
              item.type === 'work' && item.workContext?.title
                ? item.peer?.displayName ?? 'Job chat'
                : item.peer?.displayName ?? 'Conversation';
            const subtitle = conversationPreview(item);
            return (
              <TouchableOpacity
                style={styles.conversation}
                onPress={() =>
                  navigation.navigate('Chat', { conversationId: item.id })
                }
                onLongPress={() => openOverflow(item)}
                activeOpacity={0.8}
              >
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
                    <View style={styles.rightMeta}>
                      <Text style={styles.time}>
                        {formatTime(item.lastMessageAt)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openOverflow(item)}
                        hitSlop={8}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={18}
                            color={colors.textSecondary}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
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
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: { ...typography.caption, color: colors.textSecondary },
  lastMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
