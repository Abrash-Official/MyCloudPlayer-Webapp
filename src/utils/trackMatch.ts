import { stripAudioExtension } from './filename';
import type { LibraryItem } from '../types';

/** Normalize titles for fuzzy “already in library” matching. */
export function normalizeTrackTitle(title: string): string {
  return stripAudioExtension(title)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(
      /\b(official|video|audio|lyrics?|hd|4k|mv|music\s*video|visualizer|prod\.?|ft\.?|feat\.?)\b/gi,
      ' '
    )
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titlesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeTrackTitle(a);
  const nb = normalizeTrackTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length < 8) return false;
  return longer.includes(shorter);
}

/** Best Drive library match for a YouTube (or other) title, if any. */
export function findLibraryMatchByTitle(
  items: LibraryItem[],
  title: string
): LibraryItem | null {
  const needle = normalizeTrackTitle(title);
  if (!needle) return null;

  let best: LibraryItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const candidate = normalizeTrackTitle(item.name);
    if (!candidate) continue;

    let score = 0;
    if (candidate === needle) score = 100;
    else if (
      candidate.includes(needle) ||
      needle.includes(candidate)
    ) {
      const shorter = Math.min(candidate.length, needle.length);
      if (shorter < 8) continue;
      score = 40 + Math.min(shorter, 40);
    } else {
      continue;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}
