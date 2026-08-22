import { buildStreamUrl } from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { extractCoverFromBlob } from './extractCoverArt';

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

const SLICE_SIZES = [512 * 1024, 2 * 1024 * 1024, 5 * 1024 * 1024];

function notify(): void {
  listeners.forEach((fn) => fn());
}

async function isValidImageBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 32) return false;
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return true;
  }
  return false;
}

function storeArtwork(trackId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  cache.set(trackId, url);
  notify();
  return url;
}

export function getArtworkUrl(trackId: string): string | undefined {
  return cache.get(trackId);
}

export function invalidateArtwork(trackId: string): void {
  const existing = cache.get(trackId);
  if (existing) {
    URL.revokeObjectURL(existing);
    cache.delete(trackId);
    notify();
  }
}

export function subscribeArtwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchAudioSlice(
  fileId: string,
  accessToken: string,
  maxBytes: number
): Promise<Blob | null> {
  const url = buildStreamUrl(fileId);
  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Range: `bytes=0-${maxBytes - 1}`,
    },
  });

  if (!res.ok && res.status !== 206) {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  if (!res.ok) return null;
  return res.blob();
}

async function extractEmbeddedArt(
  fileId: string,
  accessToken: string,
  audioBlob?: Blob
): Promise<Blob | null> {
  if (audioBlob) {
    const art = await extractCoverFromBlob(audioBlob);
    if (art && (await isValidImageBlob(art))) return art;
  }

  for (const size of SLICE_SIZES) {
    try {
      const slice = await fetchAudioSlice(fileId, accessToken, size);
      if (!slice) continue;
      const art = await extractCoverFromBlob(slice);
      if (art && (await isValidImageBlob(art))) return art;
    } catch {
      /* try next slice size */
    }
  }

  return null;
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
  if (!(await isValidImageBlob(blob))) return null;
  return blob;
}

export async function ensureArtwork(
  trackId: string,
  accessToken?: string,
  audioBlob?: Blob
): Promise<string | null> {
  const cached = getArtworkUrl(trackId);
  if (cached) return cached;

  const pending = inflight.get(trackId);
  if (pending) return pending;

  const promise = (async () => {
    let token = accessToken;
    if (!token) {
      try {
        token = await getFreshAccessToken();
      } catch {
        return null;
      }
    }

    try {
      const embedded = await extractEmbeddedArt(trackId, token, audioBlob);
      if (embedded) return storeArtwork(trackId, embedded);
    } catch {
      /* fall through */
    }

    try {
      const thumb = await fetchDriveThumbnail(trackId, token);
      if (thumb) return storeArtwork(trackId, thumb);
    } catch {
      /* no art */
    }

    return null;
  })().finally(() => {
    inflight.delete(trackId);
  });

  inflight.set(trackId, promise);
  return promise;
}
