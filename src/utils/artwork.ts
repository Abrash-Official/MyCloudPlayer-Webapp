import { getFreshAccessToken } from '../api/auth';
import { extractAlbumArt } from './albumArt';

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function getArtworkUrl(trackId: string): string | undefined {
  return cache.get(trackId);
}

export function subscribeArtwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchDriveThumbnail(
  fileId: string,
  accessToken: string
): Promise<Blob | null> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) return null;

  const meta = (await metaRes.json()) as { thumbnailLink?: string };
  const link = meta.thumbnailLink?.replace(/=s\d+$/, '=s400');
  if (!link) return null;

  let res = await fetch(link, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    res = await fetch(link);
  }
  if (!res.ok) return null;

  const blob = await res.blob();
  if (blob.size < 200) return null;
  return blob;
}

export async function ensureArtwork(
  trackId: string,
  accessToken?: string,
  audioBlob?: Blob
): Promise<string | null> {
  const cached = cache.get(trackId);
  if (cached) return cached;

  const pending = inflight.get(trackId);
  if (pending) return pending;

  const promise = (async () => {
    let token = accessToken;
    if (!token) {
      try {
        token = await getFreshAccessToken();
      } catch {
        token = undefined;
      }
    }

    if (token) {
      try {
        const thumb = await fetchDriveThumbnail(trackId, token);
        if (thumb) {
          const url = URL.createObjectURL(thumb);
          cache.set(trackId, url);
          notify();
          return url;
        }
      } catch {
        /* try embedded art */
      }
    }

    if (audioBlob) {
      try {
        const embedded = await extractAlbumArt(audioBlob);
        if (embedded) {
          const url = URL.createObjectURL(embedded);
          cache.set(trackId, url);
          notify();
          return url;
        }
      } catch {
        /* no art */
      }
    }

    return null;
  })().finally(() => {
    inflight.delete(trackId);
  });

  inflight.set(trackId, promise);
  return promise;
}
