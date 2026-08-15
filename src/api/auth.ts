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

/** Prevents parallel GIS token popups / races. */
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

export async function signIn(): Promise<AuthResult> {
  const { accessToken, expiresIn } = await requestAccessToken('consent');
  const userInfo = await fetchUserInfo(accessToken);
  const folderId = await ensureMyCloudPlayerFolder(accessToken);
  applyToken(accessToken, expiresIn);
  return { userInfo, accessToken, folderId };
}

/** Try silent token refresh (works if user previously consented in this browser). */
export async function silentSignIn(): Promise<AuthResult | null> {
  try {
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
  if (!savedEmail || !savedFolderId) return null;
  return silentSignIn();
}

function hasUsableToken(skewMs = 60_000): boolean {
  const { accessToken, tokenExpiresAt } = useStore.getState();
  return Boolean(
    accessToken && tokenExpiresAt && tokenExpiresAt > Date.now() + skewMs
  );
}

/**
 * Returns a valid access token. Uses persisted token when still fresh,
 * otherwise silently refreshes via Google Identity Services (no login UI).
 */
export async function getFreshAccessToken(): Promise<string> {
  if (hasUsableToken(60_000)) {
    return useStore.getState().accessToken!;
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const { accessToken: fresh, expiresIn } = await requestAccessToken('');
      applyToken(fresh, expiresIn);
      return fresh;
    } catch {
      // Last resort: if token only just expired, still return it for one more try
      // (Drive may accept briefly); otherwise mark session expired.
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

/** Keep the session alive while the app is open (Google tokens last ~1 hour). */
export function startTokenKeepAlive(): () => void {
  const refreshIfNeeded = () => {
    const { isAuthenticated, userEmail, myCloudPlayerFolderId } =
      useStore.getState();
    if (!isAuthenticated || !userEmail || !myCloudPlayerFolderId) return;

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
  const token = useStore.getState().accessToken;
  await waitForGis().catch(() => undefined);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => resolve());
      setTimeout(resolve, 1500);
    });
  }
}
