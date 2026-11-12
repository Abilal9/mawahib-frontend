import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import { colors, spacing, radius, typography } from '../../theme';
import {
  NOTIFICATION_TABS,
  NotificationTab,
  filterNotifications,
} from '../../data/mock/notifications';
import { ScreenProps } from '../../navigation/types';
import { Notification } from '../../data/types';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMyProfile } from '../../context/ProfileContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useConnections } from '../../context/ConnectionsContext';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { openUserProfile } from '../../utils/openUserProfile';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../../components/ui/UserAvatar';
import { ApiError } from '../../lib/apiClient';
import { messageService } from '../../services/messageService';
import { openEngagementReview } from '../../utils/openEngagementReview';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (sameDay) return `Today at ${time}`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  const icons: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
    like: 'heart-outline',
    comment: 'chatbubble-outline',
    follow: 'people-outline',
    job: 'briefcase-outline',
    message: 'mail-outline',
    system: 'notifications-outline',
  };
  return (
    <View style={styles.iconCircle}>
      <Ionicons name={icons[type]} size={18} color={colors.textTertiary} />
    </View>
  );
}

function NotificationItem({
  item,
  showRating,
  onPress,
  onAccept,
  onReject,
  onRate,
}: {
  item: Notification;
  showRating?: boolean;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRate?: (rating: number) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.item, !item.read && styles.itemUnread]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {item.user ? (
        <UserAvatar uri={item.user.avatar} size={40} style={styles.avatar} />
      ) : (
        <NotificationIcon type={item.type} />
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title ?? item.user?.name ?? 'Notification'}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
        {item.context ? (
          <Text style={styles.context} numberOfLines={1}>
            {item.context}
          </Text>
        ) : null}

        {item.actions?.includes('accept') ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.85}>
              <Text style={styles.rejectText}>Reject Request</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showRating ? (
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const value = i + 1;
              return (
                <TouchableOpacity
                  key={value}
                  hitSlop={6}
                  activeOpacity={0.75}
                  onPress={() => onRate?.(value)}
                >
                  <Ionicons name="star-outline" size={18} color={colors.border} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
      {!item.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const { getJobById, acceptRequest, rejectRequest, refresh } = useUserJobs();
  const { user: me } = useMyProfile();
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);
    const {
    notifications,
    loading,
    failed,
    loadingMore,
    moreFailed,
    hasMore,
    loadMore,
    refresh: refreshNotifications,
    markRead,
    markAllRead,
    clearActions,
    clearRatingPrompt,
    remove,
  } = useNotifications();
  const { refresh: refreshConnections } = useConnections();
  const [activeTab, setActiveTab] = useState<NotificationTab>('All');
  const [responding, setResponding] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => void;
  } | null>(null);

  const filtered = useMemo(
    () => filterNotifications(notifications, activeTab),
    [notifications, activeTab]
  );

  const clearAll = () => {
    markAllRead();
  };

  /** Notifications carry ids from either side; only work requests can be opened. */
  const resolveRequestId = (item: Notification) => {
    if (item.userJobId) {
      const byRequest = getJobById(item.userJobId);
      if (byRequest?.requestId) return byRequest.requestId;
    }
    if (item.jobId) {
      const byListing = getJobById(item.jobId);
      if (byListing?.requestId) return byListing.requestId;
    }
    return undefined;
  };

  const openNotification = (item: Notification) => {
    markRead(item.id);

    const deep = item.deepLink;
    const params = deep?.params ?? {};
    const deepScreen = deep?.screen;
    const apiType = item.apiType;

    // Connection events always open the actor/sender profile — even after accept.
    // Must run before work-request routing: legacy payloads used params.requestId
    // for the connection request id, which is not a work request id.
    if (
      apiType === 'connection_request' ||
      apiType === 'connection_accepted' ||
      deepScreen === 'connection' ||
      deepScreen === 'connection_request'
    ) {
      const senderId =
        item.user?.id ||
        (typeof params.userId === 'string' ? params.userId : undefined);
      void (async () => {
        await refreshConnections();
        if (senderId) {
          openUserProfile(navigation, senderId, me.id);
        } else {
          navigation.navigate('Connections');
        }
      })();
      return;
    }

    if (apiType === 'message_received' || deepScreen === 'conversation') {
      const conversationId =
        typeof params.conversationId === 'string'
          ? params.conversationId
          : item.conversationId;
      if (conversationId) {
        navigation.navigate('Chat', { conversationId });
        return;
      }
      navigation.navigate('MainTabs', { screen: 'MessagesTab' });
      return;
    }

    if (apiType === 'engagement_status' || deepScreen === 'engagement') {
      const engagementId =
        typeof params.engagementId === 'string'
          ? params.engagementId
          : undefined;
      if (engagementId) {
        void (async () => {
          try {
            const workChats = await messageService.listConversations('work');
            const match = messageService.findWorkConversation(
              workChats,
              engagementId,
            );
            if (match) {
              navigation.navigate('Chat', { conversationId: match.id });
              return;
            }
          } catch {
            // fall through
          }
          navigation.navigate('MainTabs', { screen: 'JobsTab' });
        })();
        return;
      }
      navigation.navigate('MainTabs', { screen: 'JobsTab' });
      return;
    }

    if (
      apiType === 'post_liked' ||
      apiType === 'post_commented' ||
      deepScreen === 'post' ||
      deepScreen === 'PostDetail'
    ) {
      const postId =
        (typeof params.postId === 'string' && params.postId) || item.postId;
      if (postId) {
        navigation.navigate('PostDetail', {
          postId,
          focusComments: typeof params.commentId === 'string',
          commentId: typeof params.commentId === 'string' ? params.commentId : undefined,
        });
      } else {
        Alert.alert(
          'Post unavailable',
          'This post is no longer available.',
        );
      }
      return;
    }

    if (
      apiType === 'work_request_event' ||
      deepScreen === 'work_request' ||
      deepScreen === 'WorkRequestDetail'
    ) {
      const requestId =
        (typeof params.workRequestId === 'string' && params.workRequestId) ||
        (typeof params.requestId === 'string' && params.requestId) ||
        resolveRequestId(item);
      if (requestId) {
        navigation.navigate('WorkRequestDetail', { requestId });
        return;
      }
      navigation.navigate('MainTabs', { screen: 'JobsTab' });
      return;
    }

    switch (item.type) {
      case 'job': {
        const requestId = resolveRequestId(item);
        if (requestId) {
          navigation.navigate('WorkRequestDetail', { requestId });
        } else if (item.jobId) {
          navigation.navigate('JobListingDetail', { listingId: item.jobId });
        } else {
          navigation.navigate('MainTabs', { screen: 'JobsTab' });
        }
        break;
      }
      case 'message':
        if (item.conversationId) {
          navigation.navigate('Chat', { conversationId: item.conversationId });
        } else {
          navigation.navigate('MainTabs', { screen: 'MessagesTab' });
        }
        break;
      case 'follow':
        if (item.user?.id) {
          openUserProfile(navigation, item.user.id, me.id);
        } else {
          navigation.navigate('Connections');
        }
        break;
      case 'system': {
        const postId =
          (typeof params.postId === 'string' && params.postId) || item.postId;
        if (postId) {
          navigation.navigate('PostDetail', {
            postId,
            focusComments: typeof params.commentId === 'string',
            commentId: typeof params.commentId === 'string' ? params.commentId : undefined,
          });
          break;
        }
        if (typeof params.workRequestId === 'string') {
          navigation.navigate('WorkRequestDetail', { requestId: params.workRequestId });
          break;
        }
        if (typeof params.listingId === 'string') {
          navigation.navigate('JobListingDetail', { listingId: params.listingId });
          break;
        }
        if (typeof params.serviceId === 'string') {
          navigation.navigate('ServiceDetail', { serviceId: params.serviceId });
          break;
        }
        navigation.navigate('MainTabs', { screen: 'JobsTab' });
        break;
      }
      case 'like':
      case 'comment':
        if (item.postId) {
          navigation.navigate('PostDetail', { postId: item.postId });
        } else {
          Alert.alert(
            'Post unavailable',
            'This post is no longer available.',
          );
        }
        break;
      default:
        break;
    }
  };

  const onTabPress = (tab: NotificationTab) => {
    setActiveTab(tab);
  };

  /** Inline Accept / Reject Request act on the work request behind the row. */
  const respondToRequest = (
    item: Notification,
    respond: (requestId: string) => Promise<unknown>,
    successKey: 'requestAccepted' | 'requestRejected',
    onSuccess: () => void,
  ) => {
    if (responding) return;
    const requestId = resolveRequestId(item);
    if (!requestId) {
      navigation.navigate('MainTabs', { screen: 'JobsTab' });
      return;
    }
    void (async () => {
      setResponding(true);
      try {
        await respond(requestId);
        onSuccess();
        showSuccess(successKey);
      } catch (e) {
        Alert.alert(
          'Could not update request',
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Please try again.',
        );
      } finally {
        setResponding(false);
      }
    })();
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />

      <View style={styles.stickyTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity onPress={clearAll} hitSlop={8}>
            <Text style={styles.clearAll}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {NOTIFICATION_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={styles.tab}
                onPress={() => onTabPress(tab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                <View style={[styles.tabUnderline, !active && styles.tabUnderlineHidden]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={styles.listFlex}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const linked = item.userJobId ? getJobById(item.userJobId) : undefined;
          const showRating = linked?.reviewState
            ? linked.reviewState.canSubmit
            : !!item.showRating;
          return (
          <NotificationItem
            item={item}
            showRating={showRating}
            onPress={() => openNotification(item)}
            onAccept={() =>
              setConfirm({
                title: 'Accept?',
                message:
                  'This accepts the request and moves it to Pending Payment.',
                confirmLabel: 'Accept',
                run: () =>
                  respondToRequest(
                    item,
                    acceptRequest,
                    'requestAccepted',
                    () => clearActions(item.id),
                  ),
              })
            }
            onReject={() =>
              setConfirm({
                title: 'Reject Request?',
                message:
                  'This permanently closes the work request and moves it to History.',
                confirmLabel: 'Reject Request',
                danger: true,
                run: () =>
                  respondToRequest(
                    item,
                    rejectRequest,
                    'requestRejected',
                    () => remove(item.id),
                  ),
              })
            }
            onRate={(rating) => {
              clearRatingPrompt(item.id);
              const requestId = resolveRequestId(item);
              if (requestId) {
                const job = getJobById(requestId);
                openEngagementReview(navigation, {
                  jobId: requestId,
                  workRequestId: requestId,
                  engagementId: job?.engagementId,
                  initialRating: rating,
                });
              }
            }}
          />
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>Loading notifications</Text>
          ) : failed ? (
            <TouchableOpacity onPress={() => void refreshNotifications()}>
              <Text style={styles.empty}>Couldn’t load notifications. Tap to try again.</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.empty}>
              {activeTab === 'All' ? 'No notifications yet.' : 'No notifications in this category.'}
            </Text>
          )
        }
        ListFooterComponent={
          notifications.length === 0 ? null : loadingMore ? (
            <Text style={styles.empty}>Loading older notifications</Text>
          ) : moreFailed ? (
            <TouchableOpacity onPress={loadMore}>
              <Text style={styles.empty}>Couldn’t load older notifications. Tap to try again.</Text>
            </TouchableOpacity>
          ) : hasMore ? (
            <TouchableOpacity onPress={loadMore} style={styles.loadOlder}>
              <Text style={styles.loadOlderText}>Load older notifications</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.empty}>No older notifications</Text>
          )
        }
        onEndReached={() => {
          if (hasMore && !loadingMore) loadMore();
        }}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <ConfirmActionModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        danger={confirm?.danger}
        busy={responding}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const pending = confirm;
          setConfirm(null);
          pending.run();
        }}
      />
      <ActionBusyOverlay visible={responding} message="Updating request…" />
      <SuccessConfirmationModal
        visible={successVisible}
        title={successTitle}
        message={successMessage}
        onDone={() => void completeSuccess()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stickyTop: {
    backgroundColor: colors.white,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  clearAll: { ...typography.caption, color: colors.textSecondary },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabs: {
    paddingHorizontal: spacing.screen,
    gap: spacing.lg,
    alignItems: 'flex-end',
    minHeight: 40,
  },
  tab: {
    justifyContent: 'flex-end',
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
    paddingBottom: spacing.sm,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabUnderline: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabUnderlineHidden: {
    backgroundColor: 'transparent',
  },
  listFlex: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  itemUnread: {
    backgroundColor: '#F0F7FF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  content: { flex: 1, gap: 2, minWidth: 0 },
  title: { ...typography.label, color: colors.text, fontWeight: '600' },
  message: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  context: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  acceptText: { ...typography.caption, color: colors.white, fontWeight: '600' },
  rejectBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rejectText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.screen + 40 + spacing.md,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.screen,
  },
  loadOlder: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  loadOlderText: {
    ...typography.label,
    color: colors.primary,
  },
});
