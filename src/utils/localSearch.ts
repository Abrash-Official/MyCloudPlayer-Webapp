import type { LibraryItem } from '../types';
import { stripAudioExtension } from './filename';

export function searchLocalLibrary(
  items: LibraryItem[],
  query: string,
  limit = 40
): LibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return items
    .filter((item) => {
      const title = stripAudioExtension(item.name).toLowerCase();
      return title.includes(q);
    })
    .slice(0, limit);
}
