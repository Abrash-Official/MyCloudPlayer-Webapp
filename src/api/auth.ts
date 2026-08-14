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
  return new Promise(async (resolve, reject) => {
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
  });
}

export async function signIn(): Promise<AuthResult> {
  const { accessToken, expiresIn } = await requestAccessToken('consent');
  const userInfo = await fetchUserInfo(accessToken);
  const folderId = await ensureMyCloudPlayerFolder(accessToken);
  useStore.getState().updateAccessToken(accessToken, expiresIn);
  return { userInfo, accessToken, folderId };
}

/** Try silent token refresh (works if user previously consented in this browser). */
export async function silentSignIn(): Promise<AuthResult | null> {
  try {
    const { accessToken, expiresIn } = await requestAccessToken('');
    const userInfo = await fetchUserInfo(accessToken);
    const folderId = await ensureMyCloudPlayerFolder(accessToken);
    useStore.getState().updateAccessToken(accessToken, expiresIn);
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

export async function getFreshAccessToken(): Promise<string> {
  const { accessToken, tokenExpiresAt } = useStore.getState();
  const stillValid =
    accessToken &&
    tokenExpiresAt &&
    tokenExpiresAt > Date.now() + 60_000;

  if (stillValid) return accessToken!;

  try {
    const { accessToken: fresh, expiresIn } = await requestAccessToken('');
    useStore.getState().updateAccessToken(fresh, expiresIn);
    return fresh;
  } catch {
    throw new Error('Google session expired. Connect again in Settings.');
  }
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
