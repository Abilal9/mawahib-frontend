import { apiRequest } from '../lib/apiClient';

export const pushApi = {
  register(input: {
    installationId: string;
    expoPushToken: string;
    platform: 'ios' | 'android';
  }): Promise<void> {
    return apiRequest<void>('/users/me/push-devices', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
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
