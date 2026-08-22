export type ThemeMode = 'light' | 'dark' | 'system';
export type RepeatModeSetting = 'off' | 'one' | 'all';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  thumbnailLink?: string;
  parents?: string[];
  folderItemId?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  createdTime?: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  source: 'drive' | 'local';
  mimeType: string;
  size?: string;
  localPath?: string;
  thumbnailLink?: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
}

export interface CobaltResponse {
  status: 'stream' | 'tunnel' | 'redirect' | 'error' | 'picker';
  url?: string;
  filename?: string;
  error?: {
    code: string;
    context?: Record<string, string>;
  };
}

export interface PlayerTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  headers?: {
    Authorization: string;
  };
}

export interface AuthResult {
  userInfo: {
    id: string;
    email: string;
    name: string;
    photo?: string | null;
  };
  accessToken: string;
  folderId: string;
}

export type DownloadStatus =
  | 'idle'
  | 'extracting'
  | 'downloading'
  | 'uploading'
  | 'done'
  | 'error';

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
  error?: string;
}
