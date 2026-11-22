import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { chatPushRoute, chatPushTarget, claimChatPushResponse } from '../../lib/chatPush';
import { flushQueuedDetach, listenForChatPushes, syncChatPushRegistration } from '../../lib/chatPushRuntime';
import { navigationRef } from '../../navigation/navigationRef';

let pendingTarget: ReturnType<typeof chatPushTarget> = null;

function showUnavailable() {
  Alert.alert('Conversation unavailable', 'This conversation is no longer available.');
}

export function openChatPush(data: unknown, responseId: string, userId: string | null, sessionReady: boolean) {
  if (!claimChatPushResponse(responseId)) return;
  const target = chatPushTarget(data);
  if (!target) return;
  const route = chatPushRoute({ sessionReady, signedInUserId: userId, target });
  if (route === 'wait' || route === 'sign-in') {
    pendingTarget = target;
    return;
  }
  pendingTarget = null;
  if (route === 'unavailable') {
    showUnavailable();
    return;
  }
  if (navigationRef.isReady()) {
    navigationRef.navigate('Chat', { conversationId: target.conversationId });
  } else {
    pendingTarget = target;
  }
}

export function ChatPushBridge() {
  const { apiUser, isSignedIn, mediaCacheReady } = useAuth();
  const userId = apiUser?.id ?? null;
  const sessionReady = Boolean(isSignedIn && mediaCacheReady && userId);

  useEffect(() => {
    void flushQueuedDetach().catch(() => undefined);
    if (!userId) return;
    void syncChatPushRegistration(false).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    return listenForChatPushes((responseId, data) => {
      openChatPush(data, responseId, userId, sessionReady);
    });
  }, [userId, sessionReady]);

  useEffect(() => {
    if (!pendingTarget) return;
    const route = chatPushRoute({
      sessionReady,
      signedInUserId: userId,
      target: pendingTarget,
    });
    if (route === 'wait' || route === 'sign-in') return;
    const target = pendingTarget;
    pendingTarget = null;
    if (route === 'unavailable') {
      showUnavailable();
      return;
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('Chat', { conversationId: target.conversationId });
    }
  }, [sessionReady, userId]);

  return null;
}
