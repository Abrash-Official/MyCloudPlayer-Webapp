import { EXTRACT_API_URL } from '../constants/extractApi';
import { formatCobaltError, isCloudflareBlock } from './cobaltErrors';
import type { CobaltResponse } from '../types';

const COBALT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const;

const SUCCESS_STATUSES = new Set(['stream', 'tunnel', 'redirect']);
const EXTRACT_TIMEOUT_MS = 180_000;

const postExtract = async (videoId: string): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  try {
    return await fetch(EXTRACT_API_URL, {
      method: 'POST',
      headers: {
        ...COBALT_HEADERS,
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const parseExtractResponse = async (
  res: Response,
  videoId: string
): Promise<{ url: string; filename: string }> => {
  const raw = await res.text();

  if (isCloudflareBlock(raw)) {
    throw new Error('Extraction blocked by server protection. Try again shortly.');
  }

  let data: CobaltResponse;
  try {
    data = JSON.parse(raw) as CobaltResponse;
  } catch {
    throw new Error(formatCobaltError(res.status, raw));
  }

  if (!res.ok) throw new Error(formatCobaltError(res.status, raw));

  if (data.status === 'error') {
    throw new Error(`Extraction failed: ${data.error?.code ?? 'unknown_error'}`);
  }

  if (!SUCCESS_STATUSES.has(data.status) || !data.url) {
    throw new Error('Extraction server returned no download URL');
  }

  return { url: data.url, filename: data.filename ?? `${videoId}.mp3` };
};

export const extractAudioUrl = async (
  videoId: string
): Promise<{ url: string; filename: string }> => {
  const res = await postExtract(videoId);
  return parseExtractResponse(res, videoId);
};

/** Download remote audio into a Blob (web replacement for RNFS temp file). */
export const downloadToBlob = async (
  url: string,
  onProgress?: (percent: number) => void
): Promise<Blob> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);

  const total = Number(res.headers.get('Content-Length') ?? 0);
  if (!res.body || !total) {
    const blob = await res.blob();
    onProgress?.(100);
    return blob;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.round((received / total) * 100));
  }

  return new Blob(chunks as BlobPart[], {
    type: res.headers.get('Content-Type') ?? 'audio/mpeg',
  });
};
