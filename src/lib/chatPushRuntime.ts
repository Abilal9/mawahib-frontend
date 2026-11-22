import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { canRegisterChatPush, isExpoGoApp } from './chatPush';
import { detachQueueDecision, type QueuedDetach } from './chatPushDetach';
import { pushApi } from '../services/pushApi';

const INSTALLATION_KEY = 'mawahib.push.installation';
const CREDENTIAL_KEY = 'mawahib.push.credential';
const DETACH_QUEUE_KEY = 'mawahib.push.detachQueue';
let handlerReady = false;

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  const value = typeof fromExtra === 'string' && fromExtra ? fromExtra : fromEas;
  return value && value.length > 0 ? value : null;
}

function expoGo(): boolean {
  return isExpoGoApp(Constants.appOwnership);
}

async function installationId(): Promise<string | null> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing) return existing;
  const created = globalThis.crypto?.randomUUID?.();
  if (!created) return null;
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
}

function ensureHandler(): void {
  if (handlerReady) return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function syncChatPushRegistration(requestPermission: boolean): Promise<void> {
  if (expoGo() || !projectId()) return;
  ensureHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && requestPermission) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (!canRegisterChatPush({ expoGo: false, projectId: projectId(), permission: status === 'granted' ? 'granted' : 'denied' })) {
    return;
  }
  const id = await installationId();
  const experienceId = projectId();
  if (!id || !experienceId) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: experienceId });
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
  if (!platform || !token.data) return;
  const credential = await pushApi.register({
    installationId: id,
    expoPushToken: token.data,
    platform,
  });
  await SecureStore.setItemAsync(
    CREDENTIAL_KEY,
    JSON.stringify({
      installationId: id,
      registrationGeneration: credential.registrationGeneration,
      detachSecret: credential.detachSecret,
    }),
  );
  await clearStaleDetachQueue(credential.registrationGeneration);
}

async function readCredential(): Promise<QueuedDetach | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as QueuedDetach;
  if (!parsed.installationId || !parsed.detachSecret || !parsed.registrationGeneration) return null;
  return parsed;
}

async function clearStaleDetachQueue(registeredGeneration: number): Promise<void> {
  const raw = await SecureStore.getItemAsync(DETACH_QUEUE_KEY);
  if (!raw) return;
  const queued = JSON.parse(raw) as QueuedDetach;
  if (detachQueueDecision({ result: 'offline', queuedGeneration: queued.registrationGeneration, registeredGeneration }) === 'clear') {
    await SecureStore.deleteItemAsync(DETACH_QUEUE_KEY);
  }
}

export async function flushQueuedDetach(): Promise<void> {
  const raw = await SecureStore.getItemAsync(DETACH_QUEUE_KEY);
  if (!raw) return;
  const queued = JSON.parse(raw) as QueuedDetach;
  const result = await pushApi.detach(queued);
  if (detachQueueDecision({ result, queuedGeneration: queued.registrationGeneration, registeredGeneration: null }) === 'clear') {
    await SecureStore.deleteItemAsync(DETACH_QUEUE_KEY);
  }
}

export async function releaseChatPushRegistration(): Promise<void> {
  const current = await readCredential();
  if (current) {
    await SecureStore.setItemAsync(DETACH_QUEUE_KEY, JSON.stringify(current));
  }
  await flushQueuedDetach();
}


export async function renewChatPushViewing(conversationId: string): Promise<void> {
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) return;
  await pushApi.setViewing(id, conversationId);
}

export async function clearChatPushViewing(): Promise<void> {
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) return;
  await pushApi.clearViewing(id);
}

export function listenForChatPushes(
  onResponse: (responseId: string, data: unknown) => void,
): () => void {
  ensureHandler();
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse(response.notification.request.identifier, response.notification.request.content.data);
  });
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    onResponse(last.notification.request.identifier, last.notification.request.content.data);
  }
  return () => subscription.remove();
}
