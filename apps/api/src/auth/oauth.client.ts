import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';

export type OAuthProviderName = 'google' | 'facebook';
export const OAUTH_PROVIDERS: OAuthProviderName[] = ['google', 'facebook'];

// Профиль, который вернул провайдер. emailVerified = true, только если провайдер подтверждает владение адресом.
export interface ExternalProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
}

interface Keys {
  id: string;
  secret: string;
}

// Все внешние запросы к Google и Facebook — только здесь (в e2e-тестах класс подменяется через overrideProvider).
// Поток: Authorization Code + PKCE (ADR 0014). Токены провайдера дальше этого класса не уходят.
@Injectable()
export class OAuthClient {
  private readonly keys: Record<OAuthProviderName, Keys | null>;
  private readonly webOrigin: string;

  constructor(config: ConfigService<Env, true>) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    const pair = (id?: string, secret?: string): Keys | null =>
      id && secret ? { id, secret } : null;
    this.keys = {
      google: pair(
        config.get('GOOGLE_CLIENT_ID', { infer: true }),
        config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      ),
      facebook: pair(
        config.get('FACEBOOK_APP_ID', { infer: true }),
        config.get('FACEBOOK_APP_SECRET', { infer: true }),
      ),
    };
  }

  isEnabled(provider: OAuthProviderName): boolean {
    return this.keys[provider] !== null;
  }

  // Адрес, который зарегистрирован у провайдера: через same-origin прокси, чтобы cookie ставилась на домен сайта.
  redirectUri(provider: OAuthProviderName): string {
    return `${this.webOrigin}/api/v1/auth/oauth/${provider}/callback`;
  }

  authorizeUrl(provider: OAuthProviderName, state: string, codeChallenge: string): string {
    const keys = this.requireKeys(provider);
    const params = new URLSearchParams({
      client_id: keys.id,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: provider === 'google' ? 'openid email profile' : 'public_profile,email',
    });
    const base =
      provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://www.facebook.com/v19.0/dialog/oauth';
    return `${base}?${params.toString()}`;
  }

  // Меняет code на токен и запрашивает профиль. Любая ошибка — исключение (контроллер редиректит на error=oauth).
  async fetchProfile(
    provider: OAuthProviderName,
    code: string,
    codeVerifier: string,
  ): Promise<ExternalProfile> {
    const keys = this.requireKeys(provider);
    const body = new URLSearchParams({
      client_id: keys.id,
      client_secret: keys.secret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.redirectUri(provider),
      grant_type: 'authorization_code',
    });
    if (provider === 'google') {
      const token = await postForm('https://oauth2.googleapis.com/token', body);
      const info = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
      const sub = str(info.sub);
      if (!sub) throw new Error('google: no sub');
      return {
        providerUserId: sub,
        email: str(info.email)?.toLowerCase() ?? null,
        emailVerified: info.email_verified === true,
        name: str(info.name) ?? '',
      };
    }
    const token = await postForm('https://graph.facebook.com/v19.0/oauth/access_token', body);
    const info = await getJson('https://graph.facebook.com/v19.0/me?fields=id,name,email', token);
    const id = str(info.id);
    if (!id) throw new Error('facebook: no id');
    // Facebook отдаёт только адрес, подтверждённый у них.
    const email = str(info.email)?.toLowerCase() ?? null;
    return { providerUserId: id, email, emailVerified: email !== null, name: str(info.name) ?? '' };
  }

  private requireKeys(provider: OAuthProviderName): Keys {
    const keys = this.keys[provider];
    if (!keys) throw new Error(`${provider}: not configured`);
    return keys;
  }
}

const TIMEOUT_MS = 8000;

async function postForm(url: string, body: URLSearchParams): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`token endpoint: ${response.status}`);
  const json = (await response.json()) as { access_token?: unknown };
  const token = str(json.access_token);
  if (!token) throw new Error('token endpoint: no access_token');
  return token;
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`profile endpoint: ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
