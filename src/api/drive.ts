import type { DriveFile, DriveFolder } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'MyCloudPlayer';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PLAYLIST_JSON = 'playlist.json';

interface PlaylistData {
  version: 1;
  songIds: string[];
}

const emptyPlaylist = (): PlaylistData => ({ version: 1, songIds: [] });
const AUDIO_MIME = 'audio/mpeg';
const FILE_FIELDS = 'id,name,mimeType,size,createdTime,thumbnailLink';

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.aac',
  '.wma',
  '.webm',
  '.mp4',
  '.mpeg',
  '.mpga',
  '.mkv',
  '.3gp',
]);

export const isPlayableAudio = (file: DriveFile): boolean => {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));
  if (AUDIO_EXTENSIONS.has(ext)) return true;
  if (file.mimeType.startsWith('audio/')) return true;
  if (file.mimeType === 'application/octet-stream' && ext.length > 1) {
    return AUDIO_EXTENSIONS.has(ext);
  }
  return false;
};

export const ensureMyCloudPlayerFolder = async (
  token: string
): Promise<string> => {
  const query = encodeURIComponent(
    `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`
  );
  const res = await driveGet(
    `/files?q=${query}&fields=files(id,name)&pageSize=10`,
    token
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id as string;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: authHeaders(token, 'application/json'),
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const folder = await createRes.json();
  return folder.id as string;
};

export const createPlaylistFolder = async (
  name: string,
  parentFolderId: string,
  token: string
): Promise<DriveFolder> => {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: authHeaders(token, 'application/json'),
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentFolderId],
    }),
  });
  assertOk(res, 'Create playlist folder');
  const data = await res.json();
  const folder: DriveFolder = {
    id: data.id,
    name: data.name,
    createdTime: data.createdTime,
  };
  await writePlaylistData(folder.id, token, emptyPlaylist());
  return folder;
};

export const listPlaylists = async (
  rootFolderId: string,
  token: string
): Promise<DriveFolder[]> => {
  const query = encodeURIComponent(
    `mimeType='${FOLDER_MIME}' and '${rootFolderId}' in parents and trashed=false`
  );
  const res = await driveGet(
    `/files?q=${query}&fields=files(id,name,createdTime)&orderBy=name&pageSize=200`,
    token
  );
  const data = await res.json();
  return (data.files ?? []) as DriveFolder[];
};

export const listSongs = async (
  folderId: string,
  token: string
): Promise<DriveFile[]> => {
  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`
  );

  const all: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : '';
    const res = await driveGet(
      `/files?q=${query}&fields=nextPageToken,files(${FILE_FIELDS})&orderBy=createdTime desc&pageSize=200${pageParam}`,
      token
    );
    assertOk(res, 'List songs');
    const data = await res.json();
    all.push(...((data.files ?? []) as DriveFile[]));
    pageToken = data.nextPageToken as string | undefined;
  } while (pageToken);

  return all.filter(isPlayableAudio);
};

/** Upload a Blob/File to Drive (web replacement for RNFS path upload). */
export const uploadSongBlobToDrive = async (
  blob: Blob,
  filename: string,
  folderId: string,
  token: string,
  onProgress?: (percent: number) => void
): Promise<DriveFile> => {
  const initRes = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token, 'application/json'),
        'X-Upload-Content-Type': AUDIO_MIME,
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify({
        name: filename,
        mimeType: AUDIO_MIME,
        parents: [folderId],
      }),
    }
  );

  assertOk(initRes, 'Drive resumable upload init');
  const sessionUri = initRes.headers.get('Location');
  if (!sessionUri) throw new Error('No session URI in Drive upload response');

  onProgress?.(50);

  const uploadRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Type': AUDIO_MIME,
      'Content-Length': String(blob.size),
    },
    body: blob,
  });

  assertOk(uploadRes, 'Drive resumable upload PUT');
  onProgress?.(100);
  return (await uploadRes.json()) as DriveFile;
};

export const copySongToPlaylist = async (
  fileId: string,
  playlistFolderId: string,
  token: string
): Promise<DriveFile> => {
  const data = await readPlaylistData(playlistFolderId, token);
  if (!data.songIds.includes(fileId)) {
    data.songIds.push(fileId);
    await writePlaylistData(playlistFolderId, token, data);
  }
  const target = await getDriveFile(fileId, token);
  return { ...target, folderItemId: fileId };
};

export const listPlaylistSongs = async (
  folderId: string,
  token: string
): Promise<DriveFile[]> => {
  try {
    const data = await readPlaylistData(folderId, token);
    const resolved: DriveFile[] = [];
    for (const songId of data.songIds) {
      try {
        const file = await getDriveFile(songId, token);
        if (isPlayableAudio(file)) {
          resolved.push({ ...file, folderItemId: songId });
        }
      } catch {
        /* song removed */
      }
    }
    if (resolved.length > 0) return resolved;
  } catch {
    /* fall through */
  }

  return listLegacyPlaylistFiles(folderId, token);
};

export const removeFromPlaylist = async (
  playlistFolderId: string,
  songId: string,
  token: string
): Promise<void> => {
  const data = await readPlaylistData(playlistFolderId, token);
  data.songIds = data.songIds.filter((id) => id !== songId);
  await writePlaylistData(playlistFolderId, token, data);
};

export const deleteSong = async (
  fileId: string,
  token: string
): Promise<void> => {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed: ${res.status}`);
  }
};

export const buildStreamUrl = (fileId: string): string =>
  `${DRIVE_API}/files/${fileId}?alt=media`;

async function findFileInFolder(
  folderId: string,
  fileName: string,
  token: string
): Promise<string | null> {
  const query = encodeURIComponent(
    `name='${fileName}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveGet(
    `/files?q=${query}&fields=files(id)&pageSize=1`,
    token
  );
  assertOk(res, 'Find playlist file');
  const data = await res.json();
  const files = data.files ?? [];
  return files.length > 0 ? (files[0].id as string) : null;
}

async function readPlaylistData(
  folderId: string,
  token: string
): Promise<PlaylistData> {
  let jsonFileId = await findFileInFolder(folderId, PLAYLIST_JSON, token);
  if (!jsonFileId) {
    await writePlaylistData(folderId, token, emptyPlaylist());
    jsonFileId = await findFileInFolder(folderId, PLAYLIST_JSON, token);
  }
  if (!jsonFileId) return emptyPlaylist();

  const res = await fetch(`${DRIVE_API}/files/${jsonFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertOk(res, 'Read playlist.json');
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as PlaylistData;
    return {
      version: 1,
      songIds: Array.isArray(parsed.songIds) ? parsed.songIds : [],
    };
  } catch {
    return emptyPlaylist();
  }
}

async function writePlaylistData(
  folderId: string,
  token: string,
  data: PlaylistData
): Promise<void> {
  const body = JSON.stringify(data);
  const existingId = await findFileInFolder(folderId, PLAYLIST_JSON, token);

  if (existingId) {
    const res = await fetch(
      `${DRIVE_UPLOAD_API}/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    assertOk(res, 'Update playlist.json');
    return;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: authHeaders(token, 'application/json'),
    body: JSON.stringify({
      name: PLAYLIST_JSON,
      mimeType: 'application/json',
      parents: [folderId],
    }),
  });
  assertOk(createRes, 'Create playlist.json');
  const created = await createRes.json();

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_API}/files/${created.id}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    }
  );
  assertOk(uploadRes, 'Upload playlist.json');
}

async function listLegacyPlaylistFiles(
  folderId: string,
  token: string
): Promise<DriveFile[]> {
  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}' and name!='${PLAYLIST_JSON}'`
  );
  const res = await driveGet(
    `/files?q=${query}&fields=files(${FILE_FIELDS})&pageSize=200`,
    token
  );
  assertOk(res, 'List legacy playlist files');
  const data = await res.json();
  return ((data.files ?? []) as DriveFile[]).filter(isPlayableAudio);
}

async function getDriveFile(fileId: string, token: string): Promise<DriveFile> {
  const res = await driveGet(`/files/${fileId}?fields=${FILE_FIELDS}`, token);
  assertOk(res, 'Get Drive file');
  return (await res.json()) as DriveFile;
}

const authHeaders = (
  token: string,
  contentType?: string
): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(contentType ? { 'Content-Type': contentType } : {}),
});

const driveGet = (path: string, token: string) =>
  fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

const assertOk = (res: Response, label: string): void => {
  if (!res.ok) {
    throw new Error(`${label} failed with status ${res.status}`);
  }
};
