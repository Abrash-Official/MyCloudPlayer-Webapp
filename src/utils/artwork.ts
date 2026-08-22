import { buildStreamUrl } from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { extractCoverFromBlob } from './extractCoverArt';

const DB_NAME = 'mcp-artwork-v1';
const COVER_STORE = 'covers';
const MISS_STORE = 'no-cover';

/** Max parallel artwork network requests (keep playback fast). */
const MAX_CONCURRENT = 2;
const HEADER_BYTES = 256 * 1024;

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

type FetchMode = 'none' | 'thumbnail' | 'playing';

export interface ArtworkOptions {
  accessToken?: string;
  audioBlob?: Blob;
  thumbnailLink?: string;
  mode?: FetchMode;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let activeJobs = 0;
const jobQueue: Array<{ priority: number; run: () => Promise<void> }> = [];

function notify(): void {
  listeners.forEach((fn) => fn());
}

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(COVER_STORE)) {
          db.createObjectStore(COVER_STORE);
        }
        if (!db.objectStoreNames.contains(MISS_STORE)) {
          db.createObjectStore(MISS_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idbGetCover(trackId: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(COVER_STORE, 'readonly');
      const req = tx.objectStore(COVER_STORE).get(trackId);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbPutCover(trackId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(COVER_STORE, 'readwrite');
      tx.objectStore(COVER_STORE).put(blob, trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await idbClearMiss(trackId);
  } catch {
    /* ignore */
  }
}

async function idbHasMiss(trackId: string): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MISS_STORE, 'readonly');
      const req = tx.objectStore(MISS_STORE).get(trackId);
      req.onsuccess = () => resolve(req.result === 1);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function idbMarkMiss(trackId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MISS_STORE, 'readwrite');
      tx.objectStore(MISS_STORE).put(1, trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

async function idbClearMiss(trackId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MISS_STORE, 'readwrite');
      tx.objectStore(MISS_STORE).delete(trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
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

function storeInMemory(trackId: string, blob: Blob): string {
  const existing = memory.get(trackId);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(blob);
  memory.set(trackId, url);
  notify();
  return url;
}

export function getArtworkUrl(trackId: string): string | undefined {
  return memory.get(trackId);
}

export function invalidateArtwork(trackId: string): void {
  const existing = memory.get(trackId);
  if (existing) {
    URL.revokeObjectURL(existing);
    memory.delete(trackId);
    notify();
  }
}

export function subscribeArtwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load cached cover from IndexedDB into memory (no network). */
export async function hydrateArtwork(trackId: string): Promise<string | null> {
  const cached = memory.get(trackId);
  if (cached) return cached;
  const blob = await idbGetCover(trackId);
  if (!blob) return null;
  return storeInMemory(trackId, blob);
}

function enqueueJob(priority: number, job: () => Promise<void>): void {
  jobQueue.push({ priority, run: job });
  jobQueue.sort((a, b) => b.priority - a.priority);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  while (activeJobs < MAX_CONCURRENT && jobQueue.length > 0) {
    const next = jobQueue.shift();
    if (!next) break;
    activeJobs += 1;
    void next
      .run()
      .catch(() => undefined)
      .finally(() => {
        activeJobs -= 1;
        void drainQueue();
      });
  }
}

async function fetchThumbnailUrl(
  link: string,
  accessToken: string
): Promise<Blob | null> {
  const url = link.replace(/=s\d+$/, '=s220');
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!(await isValidImageBlob(blob))) return null;
  return blob;
}

async function fetchDriveThumbnailMeta(
  fileId: string,
  accessToken: string
): Promise<Blob | null> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { thumbnailLink?: string };
  if (!meta.thumbnailLink) return null;
  return fetchThumbnailUrl(meta.thumbnailLink, accessToken);
}

async function fetchAudioHeader(
  fileId: string,
  accessToken: string
): Promise<Blob | null> {
  const res = await fetch(buildStreamUrl(fileId), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Range: `bytes=0-${HEADER_BYTES - 1}`,
    },
  });
  if (!res.ok && res.status !== 206) return null;
  return res.blob();
}

async function resolveArtwork(
  trackId: string,
  token: string,
  options: ArtworkOptions
): Promise<string | null> {
  const hydrated = await hydrateArtwork(trackId);
  if (hydrated) return hydrated;
  if (await idbHasMiss(trackId)) return null;

  const mode = options.mode ?? 'none';
  if (mode === 'none') return null;

  let blob: Blob | null = null;

  if (options.audioBlob) {
    blob = await extractCoverFromBlob(options.audioBlob);
    if (blob && !(await isValidImageBlob(blob))) blob = null;
  }

  if (!blob && mode === 'thumbnail') {
    if (options.thumbnailLink) {
      blob = await fetchThumbnailUrl(options.thumbnailLink, token);
    } else {
      blob = await fetchDriveThumbnailMeta(trackId, token);
    }
  }

  if (!blob && mode === 'playing') {
    if (options.thumbnailLink) {
      blob = await fetchThumbnailUrl(options.thumbnailLink, token);
    }
    if (!blob) {
      blob = await fetchDriveThumbnailMeta(trackId, token);
    }
    if (!blob) {
      const header = await fetchAudioHeader(trackId, token);
      if (header) {
        const embedded = await extractCoverFromBlob(header);
        if (embedded && (await isValidImageBlob(embedded))) {
          blob = embedded;
        }
      }
    }
  }

  if (blob) {
    void idbPutCover(trackId, blob);
    return storeInMemory(trackId, blob);
  }

  await idbMarkMiss(trackId);
  return null;
}

/**
 * Fetch cover art without blocking playback.
 * - thumbnail: small Drive thumbnail only (library rows that have one)
 * - playing: for the active track (thumbnail, then one small audio header)
 * - none: cache only
 */
export function ensureArtwork(
  trackId: string,
  options: ArtworkOptions = {}
): Promise<string | null> {
  const cached = memory.get(trackId);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(trackId);
  if (pending) return pending;

  const mode = options.mode ?? 'none';
  if (mode === 'none') {
    return hydrateArtwork(trackId);
  }

  const priority = mode === 'playing' ? 10 : 1;

  const promise = new Promise<string | null>((resolve) => {
    enqueueJob(priority, async () => {
      let token = options.accessToken;
      if (!token) {
        try {
          token = await getFreshAccessToken();
        } catch {
          resolve(null);
          return;
        }
      }
      const url = await resolveArtwork(trackId, token, options);
      resolve(url);
    });
  }).finally(() => {
    inflight.delete(trackId);
  });

  inflight.set(trackId, promise);
  return promise;
}

/** After audio download — extract embedded art with zero extra network. */
export async function ensureArtworkFromAudioBlob(
  trackId: string,
  audioBlob: Blob
): Promise<string | null> {
  if (memory.has(trackId)) return memory.get(trackId)!;
  const existing = await idbGetCover(trackId);
  if (existing) return storeInMemory(trackId, existing);

  const embedded = await extractCoverFromBlob(audioBlob);
  if (!embedded || !(await isValidImageBlob(embedded))) {
    await idbMarkMiss(trackId);
    return null;
  }
  await idbPutCover(trackId, embedded);
  return storeInMemory(trackId, embedded);
}
