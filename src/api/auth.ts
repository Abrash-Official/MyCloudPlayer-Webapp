import type { AuthResult } from '../types';
import { ensureMyCloudPlayerFolder } from './drive';
import { useStore } from '../store/useStore';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'profile',
  'email',
].join(' ');

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (override?: { prompt?: string }) => void;
          };
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Prevents parallel token refreshes. */
let refreshInFlight: Promise<string> | null = null;

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id || id.includes('your-google')) {
    throw new Error(
      'Missing VITE_GOOGLE_CLIENT_ID. Copy .env.example to .env and set your Web client ID.'
    );
  }
  return id;
}

/** Netlify Functions base (same origin in production). */
export function authFunctionsBase(): string {
  const configured = import.meta.env.VITE_AUTH_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return '';
}

function authUrl(path: string): string {
  return `${authFunctionsBase()}${path}`;
}

/** Prefer long-session Netlify OAuth on deployed site (or when forced). */
export function useNetlifyAuth(): boolean {
  if (import.meta.env.VITE_USE_NETLIFY_AUTH === 'true') return true;
  if (import.meta.env.VITE_USE_NETLIFY_AUTH === 'false') return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('netlify.app') || Boolean(import.meta.env.PROD);
}

function waitForGis(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Google Identity Services failed to load. Check your network.'));
      }
    }, 50);
  });
}

async function fetchUserInfo(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load Google profile');
  const data = await res.json();
  return {
    id: String(data.sub),
    email: String(data.email ?? ''),
    name: String(data.name ?? data.email ?? 'User'),
    photo: (data.picture as string | undefined) ?? null,
  };
}

function requestAccessToken(prompt: '' | 'consent' = 'consent'): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        await waitForGis();
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: getClientId(),
          scope: SCOPES,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(
                new Error(
                  response.error_description ||
                    response.error ||
                    'Google sign-in was cancelled'
                )
              );
              return;
            }
            resolve({
              accessToken: response.access_token,
              expiresIn: Number(response.expires_in ?? 3600),
            });
          },
          error_callback: (error) => {
            reject(new Error(error.message || error.type || 'Google sign-in failed'));
          },
        });
        client.requestAccessToken({ prompt });
      } catch (err) {
        reject(err);
      }
    })();
  });
}

function applyToken(accessToken: string, expiresIn: number) {
  useStore.getState().updateAccessToken(accessToken, expiresIn);
  useStore.getState().setSessionExpired(false);
}

async function fetchNetlifyAccessToken(): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const res = await fetch(authUrl('/.netlify/functions/auth-token'), {
    method: 'GET',
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || 'Session expired');
  }
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in ?? 3600),
  };
}

/** Start Google login via Netlify (redirect). Page navigates away. */
export function startNetlifySignIn(): void {
  window.location.href = authUrl('/.netlify/functions/auth-login');
}

/**
 * After OAuth redirect (?auth=success), load access token + Drive folder.
 */
export async function completeNetlifySignIn(): Promise<AuthResult> {
  const { accessToken, expiresIn } = await fetchNetlifyAccessToken();
  applyToken(accessToken, expiresIn);
  const userInfo = await fetchUserInfo(accessToken);
  const folderId = await ensureMyCloudPlayerFolder(accessToken);
  return { userInfo, accessToken, folderId };
}

export async function signIn(): Promise<AuthResult> {
  if (useNetlifyAuth()) {
    startNetlifySignIn();
    // Navigation in progress
    return new Promise(() => undefined);
  }
  const { accessToken, expiresIn } = await requestAccessToken('consent');
  const userInfo = await fetchUserInfo(accessToken);
  const folderId = await ensureMyCloudPlayerFolder(accessToken);
  applyToken(accessToken, expiresIn);
  return { userInfo, accessToken, folderId };
}

export async function silentSignIn(): Promise<AuthResult | null> {
  try {
    if (useNetlifyAuth()) {
      return await completeNetlifySignIn();
    }
    const { accessToken, expiresIn } = await requestAccessToken('');
    const userInfo = await fetchUserInfo(accessToken);
    const folderId = await ensureMyCloudPlayerFolder(accessToken);
    applyToken(accessToken, expiresIn);
    return { userInfo, accessToken, folderId };
  } catch {
    return null;
  }
}

export async function restoreAuthSession(
  savedEmail: string | null,
  savedFolderId: string | null
): Promise<AuthResult | null> {
  // With Netlify cookie sessions we can restore even without saved email
  if (useNetlifyAuth()) {
    try {
      return await completeNetlifySignIn();
    } catch {
      if (!savedEmail || !savedFolderId) return null;
      return null;
    }
  }
  if (!savedEmail || !savedFolderId) return null;
  return silentSignIn();
}

function hasUsableToken(skewMs = 60_000): boolean {
  const { accessToken, tokenExpiresAt } = useStore.getState();
  return Boolean(
    accessToken && tokenExpiresAt && tokenExpiresAt > Date.now() + skewMs
  );
}

export async function getFreshAccessToken(): Promise<string> {
  if (hasUsableToken(60_000)) {
    return useStore.getState().accessToken!;
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      if (useNetlifyAuth()) {
        const { accessToken, expiresIn } = await fetchNetlifyAccessToken();
        applyToken(accessToken, expiresIn);
        return accessToken;
      }
      const { accessToken: fresh, expiresIn } = await requestAccessToken('');
      applyToken(fresh, expiresIn);
      return fresh;
    } catch {
      const { accessToken, tokenExpiresAt } = useStore.getState();
      if (
        accessToken &&
        tokenExpiresAt &&
        tokenExpiresAt > Date.now() - 120_000
      ) {
        return accessToken;
      }
      useStore.getState().setSessionExpired(true);
      throw new Error('Google session expired. Tap Reconnect to continue.');
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function startTokenKeepAlive(): () => void {
  const refreshIfNeeded = () => {
    const { isAuthenticated, userEmail, myCloudPlayerFolderId } =
      useStore.getState();
    if (!isAuthenticated && !useNetlifyAuth()) return;
    if (!isAuthenticated && !userEmail && !myCloudPlayerFolderId) {
      // Still try Netlify cookie refresh if we might have a session
      if (!useNetlifyAuth()) return;
    }

    if (hasUsableToken(5 * 60_000)) return;

    void getFreshAccessToken().catch(() => {
      /* banner handled via sessionExpired */
    });
  };

  refreshIfNeeded();
  const id = window.setInterval(refreshIfNeeded, 60_000);

  const onFocus = () => refreshIfNeeded();
  const onVis = () => {
    if (document.visibilityState === 'visible') refreshIfNeeded();
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVis);

  return () => {
    window.clearInterval(id);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export async function signOut(): Promise<void> {
  if (useNetlifyAuth()) {
    try {
      await fetch(authUrl('/.netlify/functions/auth-logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* ignore */
    }
  }

  const token = useStore.getState().accessToken;
  await waitForGis().catch(() => undefined);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => resolve());
      setTimeout(resolve, 1500);
    });
  }
}
