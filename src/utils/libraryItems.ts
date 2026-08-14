import { buildStreamUrl } from '../api/drive';
import type { DriveFile, LibraryItem, PlayerTrack } from '../types';
import { stripAudioExtension } from './filename';

export const driveFileToLibraryItem = (file: DriveFile): LibraryItem => ({
  id: file.id,
  name: file.name,
  source: 'drive',
  mimeType: file.mimeType,
  size: file.size,
});

export const toPlayerTrack = (
  item: LibraryItem,
  accessToken?: string | null
): PlayerTrack => {
  if (!accessToken) {
    throw new Error('Google Drive is not connected.');
  }

  return {
    id: item.id,
    url: buildStreamUrl(item.id),
    title: stripAudioExtension(item.name),
    artist: 'Google Drive',
    headers: { Authorization: `Bearer ${accessToken}` },
  };
};

export const libraryItemsToTracks = (
  items: LibraryItem[],
  accessToken?: string | null
): PlayerTrack[] => items.map((item) => toPlayerTrack(item, accessToken));
