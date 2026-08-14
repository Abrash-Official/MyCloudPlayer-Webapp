import type { LibraryItem } from '../types';

export function shuffleQueue<T>(items: T[], pinnedIndex?: number): T[] {
  if (items.length <= 1) return [...items];

  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  if (pinnedIndex == null || pinnedIndex < 0 || pinnedIndex >= items.length) {
    return copy;
  }

  const pinned = items[pinnedIndex];
  const withoutPinned = copy.filter((item) => item !== pinned);
  return [pinned, ...withoutPinned];
}

export function buildPlayQueue(
  songs: LibraryItem[],
  startSong: LibraryItem,
  shuffle: boolean
): LibraryItem[] {
  const startIndex = songs.findIndex((s) => s.id === startSong.id);
  if (startIndex < 0) return [...songs];

  if (shuffle) {
    return shuffleQueue(songs, startIndex);
  }

  return [...songs.slice(startIndex), ...songs.slice(0, startIndex)];
}
