import type { FetchBaseQueryError, FetchBaseQueryMeta } from '@reduxjs/toolkit/query';
import { baseApi } from '@/lib/api/base-api';
import type { Me, Schemas } from '@/lib/api/types';

type Availability = Schemas['UserNameAvailabilityDto'];
type RegisterBody = Schemas['RegisterDto'];
type RegisterResult = Schemas['RegisterResponseDto'];
type LoginBody = Schemas['LoginDto'];
type TwoFactorBody = Schemas['TwoFactorLoginDto'];
type Providers = Schemas['OAuthProvidersDto'];

/** Ответ входа: пользователь или (при включённой 2FA) запрос второго шага. */
export type LoginResult = Me | { twoFactorRequired: true; challengeId: string };

// При 429 сохраняем заголовок Retry-After (секунды), чтобы показать время ожидания.
function keepRetryAfter(response: FetchBaseQueryError, meta?: FetchBaseQueryMeta) {
  return { ...response, retryAfter: meta?.response?.headers.get('Retry-After') ?? undefined };
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOAuthProviders: build.query<Providers, void>({
      query: () => ({ url: '/auth/oauth/providers' }),
    }),

    checkUserName: build.query<Availability, string>({
      query: (userName) => ({ url: '/auth/username-availability', params: { userName } }),
    }),

    register: build.mutation<RegisterResult, RegisterBody>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
    }),

    verifyEmail: build.mutation<Me, { email: string; code: string }>({
      query: (body) => ({ url: '/auth/register/verify', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
      invalidatesTags: ['Me'],
    }),

    resendCode: build.mutation<void, { email: string }>({
      query: (body) => ({ url: '/auth/register/resend-code', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
    }),

    login: build.mutation<LoginResult, LoginBody>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
      invalidatesTags: ['Me'],
    }),

    loginTwoFactor: build.mutation<Me, TwoFactorBody>({
      query: (body) => ({ url: '/auth/login/2fa', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
      invalidatesTags: ['Me'],
    }),

    completeOAuth: build.mutation<Me, Schemas['CompleteOAuthDto']>({
      query: (body) => ({ url: '/auth/oauth/complete', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),

    forgotPassword: build.mutation<void, { login: string }>({
      query: (body) => ({ url: '/auth/password/forgot', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
    }),

    resetPassword: build.mutation<void, { token: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/password/reset', method: 'POST', body }),
      transformErrorResponse: keepRetryAfter,
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      // После выхода сбрасываем весь кэш: данные прошлого пользователя не должны остаться.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          return;
        }
        dispatch(baseApi.util.resetApiState());
      },
    }),
  }),
});

export const {
  useGetOAuthProvidersQuery,
  useCheckUserNameQuery,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendCodeMutation,
  useLoginMutation,
  useLoginTwoFactorMutation,
  useCompleteOAuthMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
} = authApi;
