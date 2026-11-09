import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { LoadingBlock, LoadingSkeleton } from '../../components/ui/LoadingPlaceholder';
import AppToast from '../../components/ui/AppToast';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import ProfileOverviewSheet from '../../components/messaging/ProfileOverviewSheet';
import JobOverviewSheet from '../../components/messaging/JobOverviewSheet';
import ChatImageLightbox from '../../components/messaging/ChatImageLightbox';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../../components/ui/UserAvatar';
import { coerceByteSize, formatBytes } from '../../utils/formatBytes';
import { colors, spacing, radius, typography } from '../../theme';
import {
  CHAT_POLL_MS,
  MAX_MESSAGE_ATTACHMENTS,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_DOCUMENT_MIME_TYPE,
  MESSAGE_IMAGE_MIME_TYPES,
} from '../../config/messaging';
import { usePolling } from '../../hooks/usePolling';
import {
  applyConversationSnapshot,
  canAcknowledgeRead,
  isCurrentChatRefresh,
  unreadDividerMessageId,
  visibleReadBoundaryId,
} from '../../lib/chatReadBoundary';
import { mergeChatMessages } from '../../lib/mergeChatMessages';
import { createClientId } from '../../lib/clientId';
import { ApiError } from '../../lib/apiClient';
import {
  pickLocalDocument,
  pickLocalImages,
  prepareImageForUpload,
  uploadLocalFile,
  type LocalPickedFile,
} from '../../lib/uploadMedia';
import { useIdentityGeneration } from '../../hooks/useIdentityGeneration';
import { useAuth } from '../../context/AuthContext';
import { messageService } from '../../services/messageService';
import type {
  ApiConversation,
  ApiMessage,
  MessageAttachment,
  MessageReceiptStatus,
} from '../../services/messagingApi';
import { useMyProfile } from '../../context/ProfileContext';
import { useMessagingUnread } from '../../context/MessagingUnreadContext';
import { openUserProfile } from '../../utils/openUserProfile';
import { openEngagementReview } from '../../utils/openEngagementReview';
import { ScreenProps } from '../../navigation/types';

type PendingAttachment = LocalPickedFile & {
  id: string;
  mediaAssetId?: string;
  error?: string;
};

type MessageImageMime = (typeof MESSAGE_IMAGE_MIME_TYPES)[number];

function attachmentRejection(
  file: LocalPickedFile,
  kind: 'image' | 'document',
): string | null {
  if (
    !Number.isFinite(file.byteSize) ||
    file.byteSize < 1 ||
    file.byteSize > MESSAGE_ATTACHMENT_MAX_BYTES
  ) {
    return `${file.fileName} is larger than 20 MB.`;
  }
  if (
    kind === 'image' &&
    !MESSAGE_IMAGE_MIME_TYPES.includes(file.mimeType as MessageImageMime)
  ) {
    return `${file.fileName} is not a supported photo. Use JPEG, PNG, or WebP.`;
  }
  if (
    kind === 'document' &&
    file.mimeType !== MESSAGE_DOCUMENT_MIME_TYPE &&
    !MESSAGE_IMAGE_MIME_TYPES.includes(file.mimeType as MessageImageMime)
  ) {
    return `${file.fileName} is not a supported file. Use a PDF or a photo.`;
  }
  return null;
}

type ChatRow =
  | { kind: 'divider'; id: string }
  | { kind: 'message'; id: string; message: ApiMessage };

/** Lightweight chat projection of delivered → disputed; details live on the job. */
function isDeliveryDeclinedSystemMessage(message: ApiMessage): boolean {
  const payload = message.systemPayload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (
      record.event === 'engagement_status' &&
      record.toStatus === 'disputed'
    ) {
      return true;
    }
  }
  return message.body === 'Delivery was declined.';
}

function isImageMime(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf' || Boolean(mimeType?.includes('pdf'));
}

function ReceiptTicks({ status }: { status: MessageReceiptStatus }) {
  const color =
    status === 'read' ? '#7EC8FF' : 'rgba(255, 255, 255, 0.75)';
  const name = status === 'sent' ? 'checkmark' : 'checkmark-done';
  return (
    <View style={styles.receiptRow}>
      <Ionicons name={name} size={14} color={color} />
    </View>
  );
}

function AttachmentBlocks({
  attachments,
  isMe,
  onOpenImage,
}: {
  attachments: MessageAttachment[];
  isMe: boolean;
  onOpenImage: (attachmentId: string) => void;
}) {
  if (!attachments?.length) return null;
  const images = attachments.filter(
    (a) => isImageMime(a.mimeType) && Boolean(a.url),
  );
  const files = attachments.filter((a) => !images.includes(a));
  return (
    <View style={styles.attachmentStack}>
      {images.length > 0 ? (
        <View style={images.length > 1 ? styles.imageGrid : undefined}>
          {images.map((a) => (
            <TouchableOpacity
              key={a.id}
              activeOpacity={0.85}
              onPress={() => onOpenImage(a.id)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open photo"
            >
              <Image
                source={toImageSource(a.url ?? '')}
                style={
                  images.length > 1 ? styles.messageImageTile : styles.messageImage
                }
                contentFit="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {files.map((a) => {
        const url = a.url ?? undefined;
        const size = coerceByteSize(a.byteSize);
        if (isImageMime(a.mimeType) && url) {
          return null;
        }
        if (isPdfMime(a.mimeType) || a.fileName) {
          return (
            <TouchableOpacity
              key={a.id}
              style={[
                styles.docCard,
                isMe ? styles.docCardMe : styles.docCardOther,
              ]}
              activeOpacity={0.85}
              onPress={() => {
                if (!url) return;
                void Linking.openURL(url).catch(() => {
                  Alert.alert('Could not open file', 'Please try again later.');
                });
              }}
              disabled={!url}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color={isMe ? colors.white : colors.primary}
              />
              <View style={styles.docMeta}>
                <Text
                  style={[styles.docName, isMe && styles.docNameMe]}
                  numberOfLines={2}
                >
                  {a.fileName || 'Document'}
                </Text>
                {size != null ? (
                  <Text style={[styles.docSize, isMe && styles.docSizeMe]}>
                    {formatBytes(size)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }
        return null;
      })}
    </View>
  );
}

const COMPOSER_ACTION_SIZE = 40;

export default function ChatScreen({ route, navigation }: ScreenProps<'Chat'>) {
  const conversationId = route.params.conversationId;
  const { user: me } = useMyProfile();
  const { apiUser } = useAuth();
  const myId = apiUser?.id || me.id;
  const insets = useSafeAreaInsets();
  const { userId, identityChanged, snapshot, isStale } =
    useIdentityGeneration(conversationId);
  const { refresh: refreshUnread } = useMessagingUnread();
  const [conversation, setConversation] = useState<ApiConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [text, setText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const [profileSheetUserId, setProfileSheetUserId] = useState<string | null>(
    null,
  );
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [missing, setMissing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [unreadDividerBeforeId, setUnreadDividerBeforeId] = useState<
    string | null
  >(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const listRef = useRef<FlatList<ChatRow>>(null);
  const nearBottomRef = useRef(false);
  const appActiveRef = useRef(AppState.currentState === 'active');
  const focusedRef = useRef(false);
  const visibleIdsRef = useRef(new Set<string>());
  const ackGenRef = useRef(0);
  const ackedBoundaryRef = useRef<string | null>(null);
  const inFlightBoundaryRef = useRef<string | null>(null);
  const refreshGenRef = useRef(0);
  const openedReadSequenceRef = useRef<number | null | undefined>(undefined);
  const messagesRef = useRef<ApiMessage[]>([]);
  const conversationRef = useRef<ApiConversation | null>(null);
  const acknowledgeRef = useRef<() => void>(() => undefined);
  const pendingScrollTargetRef = useRef<'end' | 'divider' | null>(null);
  const loadingOlderRef = useRef(false);
  const sendingRef = useRef(false);
  const clientMessageIdRef = useRef<string | null>(null);

  if (identityChanged) {
    sendingRef.current = false;
    clientMessageIdRef.current = null;
    conversationRef.current = null;
    messagesRef.current = [];
    setConversation(null);
    setMessages([]);
    setText('');
    setPendingAttachments([]);
    setLoading(true);
    setRefreshing(false);
    setSending(false);
    setLoadFailed(false);
    setMissing(false);
    setOlderCursor(null);
    setHasNewBelow(false);
    setUnreadDividerBeforeId(null);
    ackGenRef.current += 1;
    visibleIdsRef.current = new Set();
    ackedBoundaryRef.current = null;
    inFlightBoundaryRef.current = null;
    openedReadSequenceRef.current = undefined;
    refreshGenRef.current += 1;
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const refreshLatest = useCallback(
    async (opts: { initial?: boolean } = {}) => {
      const generation = ++refreshGenRef.current;
      const started = snapshot();
      if (!started.userId || isStale(started.userId, started.epoch)) return;
      const stillCurrent = () =>
        isCurrentChatRefresh(generation, refreshGenRef.current) &&
        !isStale(started.userId, started.epoch);
      try {
        if (!stillCurrent()) return;
        const showingCached =
          messagesRef.current.length > 0 &&
          conversationRef.current?.id === conversationId;
        if (showingCached) setRefreshing(true);
        const pagePromise = messageService.getMessages(conversationId, {
          limit: 50,
        });
        const convPromise =
          opts.initial || !conversationRef.current
            ? messageService.getConversation(conversationId)
            : Promise.resolve(conversationRef.current);
        const [page, conv] = await Promise.all([pagePromise, convPromise]);
        if (!stillCurrent() || !conv) return;
        const applied = applyConversationSnapshot(conversationRef.current, conv);
        conversationRef.current = applied;
        setConversation(applied);
        setLoadFailed(false);
        const chronological = [...page.items].reverse();
        const previous = messagesRef.current;
        const merged = mergeChatMessages(previous, chronological);
        if (!stillCurrent()) return;
        messagesRef.current = merged;
        setMessages(merged);
        const prevNewest = previous[previous.length - 1]?.id;
        const nextNewest = merged[merged.length - 1]?.id;
        if (
          !opts.initial &&
          prevNewest &&
          nextNewest &&
          prevNewest !== nextNewest
        ) {
          if (nearBottomRef.current) {
            queueMicrotask(() => scrollToLatest(true));
          } else {
            queueMicrotask(() => setHasNewBelow(true));
          }
        }
        if (opts.initial) {
          setOlderCursor(page.nextCursor);
          setHasNewBelow(false);
          openedReadSequenceRef.current = applied.lastReadSequence;
          const dividerId = unreadDividerMessageId({
            messages: chronological,
            viewerId: started.userId,
            lastReadSequence: applied.lastReadSequence,
            hasOlder: page.nextCursor != null,
          });
          setUnreadDividerBeforeId(dividerId);
          pendingScrollTargetRef.current = dividerId ? 'divider' : 'end';
          nearBottomRef.current = dividerId == null;
        }
        setMissing(false);
      } catch (e) {
        if (!stillCurrent()) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          setMissing(true);
          setLoadFailed(false);
          messagesRef.current = [];
          setMessages([]);
          conversationRef.current = null;
          setConversation(null);
        } else {
          console.warn('[chat] load failed', e);
          setLoadFailed(true);
        }
      } finally {
        if (stillCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [conversationId, isStale, scrollToLatest, snapshot],
  );

  const loadOlder = useCallback(async () => {
    if (!olderCursor || loadingOlderRef.current) return;
    const started = snapshot();
    if (!started.userId || isStale(started.userId, started.epoch)) return;
    const cursor = olderCursor;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await messageService.getMessages(conversationId, {
        cursor,
        limit: 50,
      });
      if (isStale(started.userId, started.epoch)) return;
      const chronological = [...page.items].reverse();
      const merged = mergeChatMessages(
        chronological,
        messagesRef.current,
        Date.now(),
        false,
      );
      messagesRef.current = merged;
      setMessages(merged);
      setOlderCursor(page.nextCursor);
      if (openedReadSequenceRef.current !== undefined && started.userId) {
        setUnreadDividerBeforeId(
          unreadDividerMessageId({
            messages: merged,
            viewerId: started.userId,
            lastReadSequence: openedReadSequenceRef.current,
            hasOlder: page.nextCursor != null,
          }),
        );
      }
    } catch (e) {
      console.warn('[chat] load older failed', e);
    } finally {
      loadingOlderRef.current = false;
      if (!isStale(started.userId, started.epoch)) setLoadingOlder(false);
    }
  }, [conversationId, isStale, olderCursor, snapshot]);

  const acknowledgeVisible = useCallback(async () => {
    if (!canAcknowledgeRead({
      appActive: appActiveRef.current,
      focused: focusedRef.current,
    })) {
      return;
    }
    const started = snapshot();
    if (!started.userId || isStale(started.userId, started.epoch)) return;
    const boundaryId = visibleReadBoundaryId({
      messages,
      visibleIds: visibleIdsRef.current,
      lastReadSequence: conversationRef.current?.lastReadSequence ?? null,
      hasOlder: olderCursor != null,
    });
    if (
      !boundaryId ||
      boundaryId === ackedBoundaryRef.current ||
      boundaryId === inFlightBoundaryRef.current
    ) {
      return;
    }
    const generation = ackGenRef.current;
    inFlightBoundaryRef.current = boundaryId;
    try {
      if (!canAcknowledgeRead({
        appActive: appActiveRef.current,
        focused: focusedRef.current,
      })) {
        return;
      }
      const conv = await messageService.markRead(conversationId, boundaryId);
      if (generation !== ackGenRef.current) return;
      if (isStale(started.userId, started.epoch)) return;
      ackedBoundaryRef.current = boundaryId;
      const applied = applyConversationSnapshot(conversationRef.current, conv);
      conversationRef.current = applied;
      setConversation(applied);
      void refreshUnread();
    } catch {
      // The boundary stays unacknowledged so a later visible pass can retry.
    } finally {
      if (inFlightBoundaryRef.current === boundaryId) {
        inFlightBoundaryRef.current = null;
      }
      const next = visibleReadBoundaryId({
        messages,
        visibleIds: visibleIdsRef.current,
        lastReadSequence: conversationRef.current?.lastReadSequence ?? null,
        hasOlder: olderCursor != null,
      });
      if (
        next &&
        next !== boundaryId &&
        next !== ackedBoundaryRef.current &&
        canAcknowledgeRead({
          appActive: appActiveRef.current,
          focused: focusedRef.current,
        })
      ) {
        void acknowledgeVisible();
      }
    }
  }, [
    conversation?.lastReadSequence,
    conversationId,
    isStale,
    messages,
    olderCursor,
    refreshUnread,
    snapshot,
  ]);

  acknowledgeRef.current = () => {
    void acknowledgeVisible();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ChatRow }> }) => {
      const ids = new Set<string>();
      for (const token of viewableItems) {
        if (token.item.kind === 'message') ids.add(token.item.message.id);
      }
      visibleIdsRef.current = ids;
      acknowledgeRef.current();
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setFocused(true);
      setLoading(true);
      setRefreshing(false);
      messagesRef.current = [];
      setMessages([]);
      setOlderCursor(null);
      pendingScrollTargetRef.current = 'end';
      nearBottomRef.current = false;
      visibleIdsRef.current = new Set();
      ackedBoundaryRef.current = null;
      openedReadSequenceRef.current = undefined;
      setHasNewBelow(false);
      void refreshLatest({ initial: true });
      return () => {
        focusedRef.current = false;
        refreshGenRef.current += 1;
        ackGenRef.current += 1;
        visibleIdsRef.current = new Set();
        ackedBoundaryRef.current = null;
        inFlightBoundaryRef.current = null;
        openedReadSequenceRef.current = undefined;
        setFocused(false);
        setUnreadDividerBeforeId(null);
      };
    }, [refreshLatest, userId]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      appActiveRef.current = active;
      setAppActive(active);
      if (active && focusedRef.current) {
        void refreshLatest({ initial: false });
      }
    });
    return () => subscription.remove();
  }, [refreshLatest]);

  useEffect(() => {
    void acknowledgeVisible();
  }, [acknowledgeVisible, appActive, focused]);

  usePolling(
    () => void refreshLatest({ initial: false }),
    CHAT_POLL_MS,
    focused && !missing && appActive,
    { immediate: false },
  );

  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distanceFromBottom < 96;
    nearBottomRef.current = nearBottom;
    if (nearBottom && hasNewBelow) setHasNewBelow(false);
    if (contentOffset.y < 48) {
      void loadOlder();
    }
  };

  const peer = conversation?.peer;
  const work = conversation?.workContext;
  const writable = conversation?.writable ?? false;
  const viewerArchived =
    conversation?.viewerArchived === true ||
    Boolean(conversation?.viewerArchivedAt);

  const chatRows = useMemo<ChatRow[]>(() => {
    const rows: ChatRow[] = [];
    for (const message of messages) {
      if (unreadDividerBeforeId === message.id) {
        rows.push({ kind: 'divider', id: `divider-${message.id}` });
      }
      rows.push({ kind: 'message', id: message.id, message });
    }
    return rows;
  }, [messages, unreadDividerBeforeId]);

  const gallery = useMemo(() => {
    const items: { id: string; url: string }[] = [];
    for (const message of messages) {
      for (const a of message.attachments ?? []) {
        if (isImageMime(a.mimeType) && a.url) {
          items.push({ id: a.id, url: a.url });
        }
      }
    }
    return items;
  }, [messages]);

  const openImage = useCallback(
    (attachmentId: string) => {
      const index = gallery.findIndex((item) => item.id === attachmentId);
      setLightboxIndex(index >= 0 ? index : 0);
      setLightboxOpen(true);
    },
    [gallery],
  );

  const headerSubtitle = useMemo(() => {
    if (work) {
      return `${work.title} · ${work.status.replace(/_/g, ' ')}`;
    }
    return peer?.title || '';
  }, [work, peer]);

  const showRateCta =
    Boolean(work) && !writable && work?.canSubmit === true;

  const canSend =
    (text.trim().length > 0 || pendingAttachments.length > 0) && !sending;

  const openRateReview = (initialRating?: number) => {
    if (!work) return;
    const workRequestId = work.workRequestId ?? undefined;
    const jobId = workRequestId ?? work.engagementId;
    openEngagementReview(navigation, {
      jobId,
      workRequestId,
      engagementId: work.engagementId,
      conversationId,
      initialRating,
    });
  };

  const archiveOrUnarchive = async () => {
    setManaging(true);
    try {
      if (viewerArchived) {
        await messageService.unarchive(conversationId);
        const refreshed = await messageService.getConversation(conversationId);
        const applied = applyConversationSnapshot(
          conversationRef.current,
          refreshed,
        );
        conversationRef.current = applied;
        setConversation(applied);
        void refreshUnread();
      } else {
        await messageService.archive(conversationId);
        void refreshUnread();
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert(
        viewerArchived ? 'Could not unarchive' : 'Could not archive',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setManaging(false);
    }
  };

  const confirmSoftDelete = async () => {
    setManaging(true);
    try {
      await messageService.softDelete(conversationId);
      setDeleteConfirmVisible(false);
      void refreshUnread();
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        'Could not delete',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setManaging(false);
    }
  };

  const openChatMenu = () => {
    if (managing) return;
    Alert.alert('Conversation', undefined, [
      {
        text: viewerArchived ? 'Unarchive conversation' : 'Archive conversation',
        onPress: () => void archiveOrUnarchive(),
      },
      {
        text: 'Delete conversation',
        style: 'destructive',
        onPress: () => setDeleteConfirmVisible(true),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const send = async () => {
    if (sendingRef.current) return;
    const started = snapshot();
    const trimmed = text.trim();
    const pending = pendingAttachments.map((file) => ({ ...file }));
    if (!trimmed && pending.length === 0) return;
    if (!writable) return;
    if (!started.userId || isStale(started.userId, started.epoch)) return;

    if (trimmed.length > MESSAGE_BODY_MAX_LENGTH) {
      setToast('Message is too long. Please make it shorter.');
      return;
    }
    if (pending.length > MAX_MESSAGE_ATTACHMENTS) {
      setToast(`You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files.`);
      return;
    }

    sendingRef.current = true;
    setSending(true);
    const clientMessageId = clientMessageIdRef.current ?? createClientId();
    clientMessageIdRef.current = clientMessageId;
    const live = () => !isStale(started.userId, started.epoch);
    try {
      const mediaAssetIds: string[] = [];
      for (const file of pending) {
        if (!live()) return;
        if (file.mediaAssetId) {
          mediaAssetIds.push(file.mediaAssetId);
          continue;
        }
        try {
          const uploaded = await uploadLocalFile({
            uri: file.uri,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            fileName: file.fileName,
            width: file.width,
            height: file.height,
            purpose: 'message',
          });
          if (!live()) return;
          file.mediaAssetId = uploaded.mediaAssetId;
          file.error = undefined;
          mediaAssetIds.push(uploaded.mediaAssetId);
          setPendingAttachments(pending.map((item) => ({ ...item })));
        } catch (uploadError) {
          file.error =
            uploadError instanceof Error
              ? uploadError.message
              : 'Upload failed';
          if (live()) {
            setPendingAttachments(pending.map((item) => ({ ...item })));
          }
          throw uploadError;
        }
      }

      if (!live()) return;
      const created = await messageService.sendMessage(conversationId, {
        body: trimmed || undefined,
        mediaAssetIds: mediaAssetIds.length > 0 ? mediaAssetIds : undefined,
        clientMessageId,
      });
      if (!live()) return;
      const withSent = mergeChatMessages(messagesRef.current, [created]);
      messagesRef.current = withSent;
      setMessages(withSent);
      setText('');
      setPendingAttachments([]);
      clientMessageIdRef.current = null;
      nearBottomRef.current = true;
      setHasNewBelow(false);
      scrollToLatest(true);
      if (!live()) return;
      const refreshed = await messageService.getConversation(conversationId);
      if (!live()) return;
      const appliedConversation = applyConversationSnapshot(
        conversationRef.current,
        refreshed,
      );
      conversationRef.current = appliedConversation;
      setConversation(appliedConversation);
      void refreshUnread();
    } catch (e) {
      if (!live()) return;
      const message =
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Please try again.';
      if (/too long/i.test(message)) {
        setToast('Message is too long. Please make it shorter.');
      } else {
        Alert.alert('Could not send', message);
      }
    } finally {
      if (live()) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  const addPendingFiles = (
    files: LocalPickedFile[],
    kind: 'image' | 'document',
  ) => {
    const accepted: PendingAttachment[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const reason = attachmentRejection(file, kind);
      if (reason) rejected.push(reason);
      else {
        accepted.push({
          id: createClientId(),
          uri: file.uri,
          mimeType: file.mimeType,
          byteSize: file.byteSize,
          fileName: file.fileName,
          width: file.width,
          height: file.height,
        });
      }
    }
    setPendingAttachments((prev) => {
      const room = MAX_MESSAGE_ATTACHMENTS - prev.length;
      const next = accepted.slice(0, Math.max(0, room));
      if (accepted.length > next.length) {
        rejected.push(
          `You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files in one message.`,
        );
      }
      if (rejected.length > 0) {
        queueMicrotask(() =>
          Alert.alert('Some files were not added', rejected.join('\n')),
        );
      }
      return [...prev, ...next];
    });
  };

  const pickPhoto = async () => {
    setAttachMenuOpen(false);
    const room = MAX_MESSAGE_ATTACHMENTS - pendingAttachments.length;
    if (room < 1) {
      Alert.alert(
        'Attachment limit',
        `You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files in one message.`,
      );
      return;
    }
    setAttaching(true);
    try {
      const files = await pickLocalImages(room);
      const prepared: LocalPickedFile[] = [];
      for (const file of files) {
        prepared.push(
          await prepareImageForUpload({ ...file, purpose: 'message' }),
        );
      }
      if (prepared.length > 0) addPendingFiles(prepared, 'image');
    } catch (e) {
      Alert.alert(
        'Could not attach',
        e instanceof Error ? e.message : 'Could not attach image.',
      );
    } finally {
      setAttaching(false);
    }
  };

  const pickDocument = async () => {
    setAttachMenuOpen(false);
    const room = MAX_MESSAGE_ATTACHMENTS - pendingAttachments.length;
    if (room < 1) {
      Alert.alert(
        'Attachment limit',
        `You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files in one message.`,
      );
      return;
    }
    setAttaching(true);
    try {
      const local = await pickLocalDocument();
      if (local) addPendingFiles([local], 'document');
    } catch (e) {
      Alert.alert(
        'Could not attach',
        e instanceof Error ? e.message : 'Could not attach file.',
      );
    } finally {
      setAttaching(false);
    }
  };

  const onAttach = () => {
    if (!writable || attaching || sending) return;
    Keyboard.dismiss();
    setAttachMenuOpen(true);
  };

  const openHeaderOverview = () => {
    if (work) {
      setJobSheetOpen(true);
      return;
    }
    if (peer?.id) {
      setProfileSheetUserId(peer.id);
      setProfileSheetOpen(true);
    }
  };

  const openProfileOverview = (userId: string) => {
    setJobSheetOpen(false);
    setProfileSheetUserId(userId);
    setProfileSheetOpen(true);
  };

  const viewJobDetails = () => {
    if (!work) return;
    if (work.workRequestId) {
      navigation.navigate('WorkRequestDetail', {
        requestId: work.workRequestId,
      });
      return;
    }
    Alert.alert(
      'Job details',
      'A linked work request is not available for this engagement yet.',
    );
  };

  if (missing) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Conversation not found</Text>
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

  return (
    <ScreenContainer padded={false} safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerPerson}
          onPress={openHeaderOverview}
          activeOpacity={0.8}
          disabled={!peer?.id && !work}
        >
          <UserAvatar
            uri={peer?.avatarUrl}
            size={40}
            style={styles.headerAvatar}
          />
            <View style={styles.headerInfo}>
              {peer?.displayName ? (
                <Text style={styles.headerName} numberOfLines={1}>
                  {peer.displayName}
                </Text>
              ) : loading ? (
                <LoadingSkeleton label="Loading conversation">
                  <LoadingBlock width={120} height={14} />
                </LoadingSkeleton>
              ) : (
                <Text style={styles.headerName} numberOfLines={1}>
                  Conversation
                </Text>
              )}
              {headerSubtitle ? (
                <Text style={styles.headerStatus} numberOfLines={1}>
                  {headerSubtitle}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              accessibilityLabel="Updating conversation"
            />
          ) : null}
        {work ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setJobSheetOpen(true)}
            accessibilityLabel="Job overview"
          >
            <Ionicons name="briefcase-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.backButton}
          onPress={openChatMenu}
          disabled={managing}
          accessibilityLabel="Conversation options"
        >
          {managing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="archive-outline" size={22} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {showRateCta ? (
        <TouchableOpacity
          style={styles.rateCard}
          onPress={() => openRateReview()}
          activeOpacity={0.85}
        >
          <View style={styles.rateCopy}>
            <View style={styles.rateStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => openRateReview(star)}
                  hitSlop={6}
                  accessibilityLabel={`Rate ${star} stars`}
                >
                  <Ionicons
                    name="star-outline"
                    size={28}
                    color={colors.warning}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.rateTitle}>Rate this job</Text>
            <Text style={styles.rateSubtitle}>
              Share feedback on {work?.title ?? 'this completed work'}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      ) : null}

      {work?.status === 'completed' && work.viewerReviewRating != null ? (
        <View style={styles.rateCard}>
          <View style={styles.rateCopy}>
            <View style={styles.rateStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= (work.viewerReviewRating ?? 0) ? 'star' : 'star-outline'}
                  size={22}
                  color={colors.warning}
                />
              ))}
            </View>
            <Text style={styles.rateTitle}>Your rating</Text>
            <Text style={styles.rateSubtitle}>
              Thanks — this job chat is archived for you.
            </Text>
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading && messages.length === 0 ? (
          <LoadingSkeleton label="Loading messages" style={styles.messageSkeleton}>
            <LoadingBlock width="72%" height={54} style={styles.skeletonIncoming} />
            <LoadingBlock width="64%" height={42} style={styles.skeletonOutgoing} />
            <LoadingBlock width="78%" height={54} style={styles.skeletonIncoming} />
            <LoadingBlock width="48%" height={42} style={styles.skeletonOutgoing} />
          </LoadingSkeleton>
        ) : (
          <View style={styles.flex}>
            <FlatList
              ref={listRef}
              data={chatRows}
              extraData={chatRows
                .map((row) =>
                  row.kind === 'message'
                    ? `${row.id}:${row.message.receiptStatus ?? ''}`
                    : row.id,
                )
                .join('|')}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onScroll={onListScroll}
              scrollEventThrottle={16}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
              onScrollToIndexFailed={(info) => {
                listRef.current?.scrollToOffset({
                  offset: Math.max(0, info.averageItemLength * info.index),
                  animated: false,
                });
              }}
              onContentSizeChange={() => {
                const target = pendingScrollTargetRef.current;
                if (!target || chatRows.length === 0) return;
                if (target === 'divider') {
                  const index = chatRows.findIndex(
                    (row) => row.kind === 'divider',
                  );
                  if (index >= 0) {
                    listRef.current?.scrollToIndex({
                      index,
                      animated: false,
                      viewPosition: 0.2,
                    });
                    nearBottomRef.current = false;
                  } else {
                    listRef.current?.scrollToEnd({ animated: false });
                    nearBottomRef.current = true;
                  }
                } else {
                  listRef.current?.scrollToEnd({ animated: false });
                  nearBottomRef.current = true;
                }
                pendingScrollTargetRef.current = null;
              }}
              ListHeaderComponent={
                loadingOlder ? (
                  <View style={styles.olderLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : undefined
              }
              renderItem={({ item }) => {
                if (item.kind === 'divider') {
                  return (
                    <View style={styles.newMessagesDivider}>
                      <View style={styles.newMessagesLine} />
                      <Text style={styles.newMessagesLabel}>New Messages</Text>
                      <View style={styles.newMessagesLine} />
                    </View>
                  );
                }
                const message = item.message;
                if (message.kind === 'system') {
                  const declined = isDeliveryDeclinedSystemMessage(message);
                  const canOpenJob = declined && !!work?.workRequestId;
                  const systemBody = (
                    <>
                      {message.body ? (
                        <Text style={styles.systemText}>{message.body}</Text>
                      ) : null}
                      {canOpenJob ? (
                        <Text style={styles.systemLink}>View details</Text>
                      ) : null}
                    </>
                  );
                  if (canOpenJob) {
                    return (
                      <TouchableOpacity
                        style={styles.systemRow}
                        onPress={viewJobDetails}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Delivery was declined. View job details"
                      >
                        {systemBody}
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View style={styles.systemRow}>{systemBody}</View>
                  );
                }
                const isMe = message.senderId === myId;
                return (
                  <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
                    <View
                      style={[
                        styles.bubble,
                        isMe ? styles.bubbleMe : styles.bubbleOther,
                      ]}
                    >
                      <AttachmentBlocks
                        attachments={message.attachments ?? []}
                        isMe={isMe}
                        onOpenImage={openImage}
                      />
                      {message.body ? (
                        <Text
                          style={[
                            styles.bubbleText,
                            isMe && styles.bubbleTextMe,
                            message.attachments?.length
                              ? styles.captionAfterAttach
                              : null,
                          ]}
                        >
                          {message.body}
                        </Text>
                      ) : null}
                      {isMe && message.receiptStatus ? (
                        <ReceiptTicks status={message.receiptStatus} />
                      ) : null}
                    </View>
                  </View>
                );
              }}
            />
            {hasNewBelow ? (
              <TouchableOpacity
                style={styles.newMessagesChip}
                onPress={() => {
                  setHasNewBelow(false);
                  nearBottomRef.current = true;
                  scrollToLatest(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.newMessagesChipText}>New messages</Text>
                <Ionicons name="chevron-down" size={16} color={colors.white} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {loadFailed && !conversation && !loading ? (
          <View style={styles.readOnlyBar}>
            <Text style={styles.readOnlyText}>Could not load this conversation.</Text>
            <TouchableOpacity
              onPress={() => void refreshLatest({ initial: true })}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : conversation && !writable ? (
          <View style={styles.readOnlyBar}>
            <Text style={styles.readOnlyText}>
              This conversation is read-only.
            </Text>
          </View>
        ) : conversation ? (
          <View
            style={[
              styles.composer,
              {
                paddingBottom: keyboardOpen
                  ? spacing.sm
                  : Math.max(insets.bottom, spacing.sm),
              },
            ]}
          >
            {pendingAttachments.length > 0 ? (
              <View style={styles.pendingRow}>
                {pendingAttachments.map((a) => (
                  <View key={a.id} style={styles.pendingItem}>
                    {isImageMime(a.mimeType) ? (
                      <Image
                        source={toImageSource(a.uri)}
                        style={styles.pendingThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.pendingPdfChip}>
                        <Ionicons
                          name="document-text-outline"
                          size={16}
                          color={colors.textTertiary}
                        />
                        <View style={styles.pendingPdfMeta}>
                          <Text style={styles.pendingChipText} numberOfLines={1}>
                            {a.fileName}
                          </Text>
                          <Text style={styles.pendingSizeText}>
                            {formatBytes(a.byteSize)}
                          </Text>
                        </View>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.pendingRemove}
                      onPress={() =>
                        setPendingAttachments((prev) =>
                          prev.filter((p) => p.id !== a.id),
                        )
                      }
                      hitSlop={8}
                      disabled={sending}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${a.fileName}`}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {a.error ? (
                      <Text style={styles.pendingError} numberOfLines={2}>
                        Failed
                      </Text>
                    ) : null}
                    {sending && !a.mediaAssetId && !a.error ? (
                      <ActivityIndicator
                        style={styles.pendingSpinner}
                        size="small"
                        color={colors.primary}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.inputBar}>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={onAttach}
                disabled={attaching || sending}
                accessibilityRole="button"
                accessibilityLabel="Add attachment"
              >
                {attaching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="add"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MESSAGE_BODY_MAX_LENGTH}
                editable={!sending}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !canSend && styles.sendButtonDisabled,
                ]}
                onPress={() => void send()}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ConfirmActionModal
        visible={deleteConfirmVisible}
        title="Delete conversation"
        message="This removes the conversation from your inbox. The other person keeps their copy."
        confirmLabel="Delete"
        danger
        busy={managing}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => void confirmSoftDelete()}
      />

      <JobOverviewSheet
        visible={jobSheetOpen}
        workContext={work}
        peer={peer}
        onClose={() => setJobSheetOpen(false)}
        onViewJobDetails={viewJobDetails}
        onOpenParticipant={() => {
          if (peer?.id) openProfileOverview(peer.id);
        }}
      />

      <ProfileOverviewSheet
        visible={profileSheetOpen}
        userId={profileSheetUserId}
        conversationId={conversationId}
        onClose={() => {
          setProfileSheetOpen(false);
          setProfileSheetUserId(null);
        }}
        onOpenFullProfile={(id) => openUserProfile(navigation, id, me.id)}
        onOpenMedia={() => {
          setProfileSheetOpen(false);
          setProfileSheetUserId(null);
          navigation.navigate('ConversationMedia', { conversationId });
        }}
      />

      <ChatImageLightbox
        visible={lightboxOpen}
        images={gallery.map((item) => item.url)}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      <Modal
        visible={attachMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachMenuOpen(false)}
      >
        <Pressable
          style={styles.attachMenuBackdrop}
          onPress={() => setAttachMenuOpen(false)}
        >
          <Pressable
            style={[
              styles.attachMenu,
              { marginBottom: Math.max(insets.bottom, spacing.md) + 64 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={() => void pickPhoto()}
              activeOpacity={0.85}
            >
              <Ionicons name="image-outline" size={20} color={colors.text} />
              <Text style={styles.attachMenuText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={() => void pickDocument()}
              activeOpacity={0.85}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.text}
              />
              <Text style={styles.attachMenuText}>PDF / Document</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachMenuItem, styles.attachMenuCancel]}
              onPress={() => setAttachMenuOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.attachMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <AppToast message={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPerson: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { ...typography.label, color: colors.text },
  headerStatus: { ...typography.caption, color: colors.textSecondary },
  attachMenuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  attachMenu: {
    marginLeft: spacing.screen,
    marginBottom: Platform.OS === 'ios' ? 88 : 72,
    alignSelf: 'flex-start',
    minWidth: 200,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  attachMenuText: {
    ...typography.body,
    color: colors.text,
  },
  attachMenuCancel: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    justifyContent: 'center',
  },
  attachMenuCancelText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FFF8E8',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#F5E0B0',
  },
  rateStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  rateCopy: { flex: 1, gap: 2 },
  rateTitle: { ...typography.label, color: colors.text },
  rateSubtitle: { ...typography.caption, color: colors.textSecondary },
  messageList: { padding: spacing.screen, paddingBottom: spacing.lg, flexGrow: 1 },
  messageSkeleton: {
    flex: 1,
    padding: spacing.screen,
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  skeletonIncoming: { alignSelf: 'flex-start' },
  skeletonOutgoing: { alignSelf: 'flex-end' },
  olderLoading: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  newMessagesDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  newMessagesLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  newMessagesLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  newMessagesChip: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  newMessagesChipText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  bubbleRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  bubbleRowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bubbleText: { ...typography.body, color: colors.text, lineHeight: 20 },
  bubbleTextMe: { color: colors.white },
  captionAfterAttach: { marginTop: spacing.sm },
  receiptRow: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  attachmentStack: { gap: spacing.sm },
  imageGrid: {
    width: 200,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  messageImage: {
    width: 200,
    height: 160,
    borderRadius: radius.button,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  messageImageTile: {
    width: 98,
    height: 98,
    borderRadius: radius.button,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    minWidth: 180,
  },
  docCardMe: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  docCardOther: {
    backgroundColor: colors.background,
  },
  docMeta: { flex: 1, minWidth: 0 },
  docName: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  docNameMe: { color: colors.white },
  docSize: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  docSizeMe: { color: 'rgba(255,255,255,0.8)' },
  systemRow: {
    alignItems: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  systemText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  systemLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  composer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  pendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
  },
  pendingItem: {
    position: 'relative',
  },
  pendingError: {
    ...typography.caption,
    color: colors.error,
    marginTop: 2,
    maxWidth: 64,
  },
  pendingSpinner: {
    position: 'absolute',
    top: 22,
    left: 22,
  },
  pendingThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.button,
    backgroundColor: colors.borderLight,
  },
  pendingPdfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    backgroundColor: colors.borderLight,
    borderRadius: radius.button,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  pendingPdfMeta: { flex: 1, minWidth: 0 },
  pendingChipText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  pendingSizeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  pendingRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.white,
    borderRadius: 10,
  },
  attachButton: {
    width: COMPOSER_ACTION_SIZE,
    height: COMPOSER_ACTION_SIZE,
    borderRadius: COMPOSER_ACTION_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: COMPOSER_ACTION_SIZE,
    height: COMPOSER_ACTION_SIZE,
    borderRadius: COMPOSER_ACTION_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  readOnlyBar: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  readOnlyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryText: {
    ...typography.label,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
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
