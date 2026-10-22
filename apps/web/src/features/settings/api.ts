import { baseApi } from '@/lib/api/base-api';
import type { Schemas, Settings } from '@/lib/api/types';

type Session = Schemas['SessionDto'];
type NotificationPreference = Schemas['NotificationPreferenceDto'];

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSettings: build.query<Settings, void>({
      query: () => ({ url: '/me/settings' }),
      providesTags: ['Settings'],
    }),

    updateSettings: build.mutation<Settings, Schemas['UpdateSettingsDto']>({
      query: (body) => ({ url: '/me/settings', method: 'PATCH', body }),
      invalidatesTags: ['Settings'],
    }),

    getNotificationPreferences: build.query<NotificationPreference[], void>({
      query: () => ({ url: '/me/notification-preferences' }),
      providesTags: ['Settings'],
    }),

    updateNotificationPreferences: build.mutation<
      NotificationPreference[],
      NotificationPreference[]
    >({
      query: (body) => ({ url: '/me/notification-preferences', method: 'PATCH', body }),
      invalidatesTags: ['Settings'],
    }),

    getSessions: build.query<Session[], void>({
      query: () => ({ url: '/auth/sessions' }),
      providesTags: ['Session'],
    }),

    revokeSession: build.mutation<void, string>({
      query: (sessionId) => ({ url: `/auth/sessions/${sessionId}`, method: 'DELETE' }),
      invalidatesTags: ['Session'],
    }),

    changePassword: build.mutation<void, Schemas['ChangePasswordDto']>({
      query: (body) => ({ url: '/auth/password/change', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),

    setupTwoFactor: build.mutation<Schemas['TwoFactorSetupDto'], void>({
      query: () => ({ url: '/auth/2fa/setup', method: 'POST' }),
    }),

    enableTwoFactor: build.mutation<Schemas['BackupCodesDto'], string>({
      query: (code) => ({ url: '/auth/2fa/enable', method: 'POST', body: { code } }),
      invalidatesTags: ['Me'],
    }),

    disableTwoFactor: build.mutation<void, string>({
      query: (password) => ({ url: '/auth/2fa/disable', method: 'POST', body: { password } }),
      invalidatesTags: ['Me'],
    }),

    deactivateAccount: build.mutation<void, Schemas['PasswordConfirmDto']>({
      query: (body) => ({ url: '/me/deactivate', method: 'POST', body }),
    }),

    deleteAccount: build.mutation<Schemas['DeletionScheduledDto'], Schemas['PasswordConfirmDto']>({
      query: (body) => ({ url: '/me', method: 'DELETE', body }),
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useChangePasswordMutation,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
  useDeactivateAccountMutation,
  useDeleteAccountMutation,
} = settingsApi;
