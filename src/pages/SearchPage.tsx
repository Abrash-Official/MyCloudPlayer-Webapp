import { useCallback, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import SongCard from '../components/SongCard';
import { searchYouTube } from '../api/youtube';
import { downloadAndSaveToDrive } from '../api/downloadAndSave';
import { listSongs } from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import { searchLocalLibrary } from '../utils/localSearch';
import {
  driveFileToLibraryItem,
  libraryItemsToTracks,
} from '../utils/libraryItems';
import { buildPlayQueue } from '../utils/playerQueue';
import { playQueue } from '../utils/playback';
import LoadingState from '../components/LoadingState';
import type { DownloadState, LibraryItem, YouTubeSearchResult } from '../types';

export default function SearchPage() {
  const {
    youtubeApiKey,
    myCloudPlayerFolderId,
    isAuthenticated,
    songs,
    accessToken,
    addSong,
    setCurrentTrack,
    shuffleEnabled,
    repeatMode,
  } = useStore();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<YouTubeSearchResult | null>(null);
  const [driveResults, setDriveResults] = useState<LibraryItem[]>([]);
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
  });

  const canSearchYouTube = Boolean(youtubeApiKey);
  const canSearchDrive = isAuthenticated && songs.length > 0;
  const hasAnySource = canSearchYouTube || canSearchDrive;

  const searchHint = useMemo(() => {
    const parts: string[] = [];
    if (canSearchDrive) parts.push('Google Drive');
    if (canSearchYouTube) parts.push('YouTube');
    if (parts.length === 0) {
      return 'Connect Drive or add a YouTube API key in Settings';
    }
    return `Search ${parts.join(' & ')}`;
  }, [canSearchDrive, canSearchYouTube]);

  const playSearchResult = useCallback(
    async (song: LibraryItem, queue: LibraryItem[]) => {
      try {
        let token = accessToken;
        token = await getFreshAccessToken();
        const playQueueItems = buildPlayQueue(queue, song, shuffleEnabled);
        const tracks = libraryItemsToTracks(playQueueItems, token);
        await playQueue(tracks, { repeatMode, forceRestart: true });
        setCurrentTrack(tracks[0]);
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Playback error');
      }
    },
    [
      accessToken,
      shuffleEnabled,
      repeatMode,
      setCurrentTrack,
    ]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (!hasAnySource) {
      window.alert(searchHint);
      return;
    }

    setIsSearching(true);
    setResult(null);
    setDriveResults([]);
    setDownloadState({ status: 'idle', progress: 0 });

    try {
      if (canSearchDrive) {
        setDriveResults(
          searchLocalLibrary(songs.map(driveFileToLibraryItem), query)
        );
      }
      if (canSearchYouTube) {
        const res = await searchYouTube(query, youtubeApiKey);
        setResult(res);
      }
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Search error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async () => {
    if (!result || downloadState.status !== 'idle') return;
    if (!isAuthenticated || !myCloudPlayerFolderId) {
      window.alert(
        'Connect Google Drive in Settings first. Downloads are saved to Drive.'
      );
      return;
    }

    try {
      setDownloadState({ status: 'extracting', progress: 0 });

      const token = await getFreshAccessToken();
      const videoUrl = `https://youtu.be/${result.videoId}`;

      await downloadAndSaveToDrive({
        videoUrl,
        accessToken: token,
      });

      // Refresh list after server-side download/upload so the new song appears.
      const refreshedToken = await getFreshAccessToken();
      const latestSongs = await listSongs(
        myCloudPlayerFolderId,
        refreshedToken
      );
      const existingIds = new Set(songs.map((s) => s.id));
      for (const s of latestSongs) {
        if (!existingIds.has(s.id)) {
          existingIds.add(s.id);
          addSong(s);
        }
      }

      setDownloadState({ status: 'done', progress: 100 });
    } catch (err: unknown) {
      setDownloadState({
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Download failed',
      });
      window.alert(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const statusLabel =
    downloadState.status === 'extracting'
      ? 'Downloading & saving to Drive…'
      : downloadState.status === 'done'
        ? 'Saved to Google Drive'
        : downloadState.status === 'error'
          ? 'Failed'
          : null;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Search</h1>
          <p className="sub">{searchHint}</p>
        </div>
      </header>

      <div className="search-box">
        <input
          className="search-input"
          placeholder="Song name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={isSearching}
          onClick={() => void handleSearch()}
        >
          {isSearching ? <span className="spinner" /> : <Icons.search size={18} />}
          Search
        </button>
      </div>

      {driveResults.length > 0 ? (
        <section>
          <div
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            In your library
          </div>
          {driveResults.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              showPlayButton
              onPlay={() =>
                void playSearchResult(
                  song,
                  songs.map(driveFileToLibraryItem)
                )
              }
            />
          ))}
        </section>
      ) : null}

      {result ? (
        <div className="yt-card">
          <img src={result.thumbnail} alt="" />
          <div className="body">
            <div className="song-title" title={result.title}>
              {result.title}
            </div>
            <div className="song-sub">{result.channelTitle}</div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12, width: '100%' }}
              disabled={
                downloadState.status === 'extracting' ||
                downloadState.status === 'done'
              }
              onClick={() => {
                if (downloadState.status === 'error') {
                  setDownloadState({ status: 'idle', progress: 0 });
                }
                void handleDownload();
              }}
            >
              {downloadState.status === 'done'
                ? 'Added to Drive'
                : downloadState.status === 'idle' ||
                    downloadState.status === 'error'
                  ? 'Add to Drive'
                  : statusLabel}
            </button>
            {downloadState.status === 'extracting' ? (
              <div style={{ marginTop: 14 }}>
                <LoadingState label="Downloading & saving…" compact />
              </div>
            ) : null}
            {downloadState.status === 'done' ? (
              <p className="song-sub" style={{ marginTop: 8, color: 'var(--primary)' }}>
                Saved to Google Drive
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isSearching ? <LoadingState label="Searching…" rows={3} /> : null}

      {!isSearching &&
      !result &&
      driveResults.length === 0 &&
      query.trim() === '' ? (
        <div className="empty">
          <Icons.search size={64} />
          <h3>Search your music</h3>
          <p>{searchHint}</p>
        </div>
      ) : null}
    </div>
  );
}
