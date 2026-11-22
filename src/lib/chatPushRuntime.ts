import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { canRegisterChatPush } from './chatPush';
import { pushApi } from '../services/pushApi';

const INSTALLATION_KEY = 'mawahib.push.installation';
let handlerReady = false;

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  const value = typeof fromExtra === 'string' && fromExtra ? fromExtra : fromEas;
  return value && value.length > 0 ? value : null;
}

function expoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
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
  await pushApi.register({
    installationId: id,
    expoPushToken: token.data,
    platform,
  });
}

export async function releaseChatPushRegistration(): Promise<void> {
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) return;
  try {
    await pushApi.unregister(id);
  } catch {
    await pushApi.unregister(id);
  }
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
