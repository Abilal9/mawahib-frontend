import { appEnv } from '../config/env';
import { apiRequest } from '../lib/apiClient';

export type PushRegistrationCredential = {
  registrationGeneration: number;
  detachSecret: string;
};

export const pushApi = {
  register(input: {
    installationId: string;
    expoPushToken: string;
    platform: 'ios' | 'android';
  }): Promise<PushRegistrationCredential> {
    return apiRequest<PushRegistrationCredential>('/users/me/push-devices', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  detach(input: {
    installationId: string;
    registrationGeneration: number;
    detachSecret: string;
  }): Promise<'sent' | 'offline'> {
    return fetch(`${appEnv.apiBaseUrl}/push-device-detach`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
      .then((response) => (response.status === 204 || response.ok ? 'sent' : 'offline'))
      .catch(() => 'offline');
  },

  unregister(installationId: string): Promise<void> {
    return apiRequest<void>(`/users/me/push-devices/${installationId}`, {
      method: 'DELETE',
    });
  },

  setViewing(installationId: string, conversationId: string): Promise<void> {
    return apiRequest<void>(`/users/me/push-devices/${installationId}/viewing`, {
      method: 'PUT',
      body: JSON.stringify({ conversationId }),
    });
  },

  clearViewing(installationId: string): Promise<void> {
    return apiRequest<void>(`/users/me/push-devices/${installationId}/viewing`, {
      method: 'DELETE',
    });
  },
};
