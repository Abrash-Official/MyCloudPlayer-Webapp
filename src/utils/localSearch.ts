import type { LibraryItem } from '../types';
import { stripAudioExtension } from './filename';
import { normalizeTrackTitle } from './trackMatch';

export function searchLocalLibrary(
  items: LibraryItem[],
  query: string,
  limit = 40
): LibraryItem[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const normalized = normalizeTrackTitle(query);

  return items
    .filter((item) => {
      const titleRaw = stripAudioExtension(item.name).toLowerCase();
      if (titleRaw.includes(raw)) return true;
      if (!normalized) return false;
      const titleNorm = normalizeTrackTitle(item.name);
      return titleNorm.includes(normalized);
    })
    .slice(0, limit);
}
