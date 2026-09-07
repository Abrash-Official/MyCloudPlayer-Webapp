import { useCallback, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import SongCard from '../components/SongCard';
import ConfirmDialog from '../components/ConfirmDialog';
import { searchYouTube } from '../api/youtube';
import { downloadAndSaveToDrive } from '../api/downloadAndSave';
import { listSongs } from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import { searchLocalLibrary } from '../utils/localSearch';
import { findLibraryMatchByTitle } from '../utils/trackMatch';
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
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
  });
  const [confirmRedownload, setConfirmRedownload] = useState(false);

  const libraryItems = useMemo(
    () => songs.map(driveFileToLibraryItem),
    [songs]
  );

  // Local Drive matches update as you type — no YouTube API usage.
  const driveResults = useMemo(() => {
    if (!isAuthenticated || songs.length === 0) return [];
    return searchLocalLibrary(libraryItems, query);
  }, [isAuthenticated, songs.length, libraryItems, query]);

  const existingMatch = useMemo(() => {
    if (!result) return null;
    return findLibraryMatchByTitle(libraryItems, result.title);
  }, [result, libraryItems]);

  const librarySectionSongs = useMemo(() => {
    const byId = new Map(driveResults.map((s) => [s.id, s]));
    if (existingMatch) byId.set(existingMatch.id, existingMatch);
    return Array.from(byId.values());
  }, [driveResults, existingMatch]);

  const canSearchYouTube = Boolean(youtubeApiKey);
  const canSearchDrive = isAuthenticated && songs.length > 0;

  const searchHint = useMemo(() => {
    if (canSearchDrive && canSearchYouTube) {
      return 'Library matches as you type · Search button uses YouTube';
    }
    if (canSearchDrive) return 'Search your Google Drive library as you type';
    if (canSearchYouTube) {
      return 'Search YouTube (add songs to Drive from results)';
    }
    return 'Connect Drive or add a YouTube API key in Settings';
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
    [accessToken, shuffleEnabled, repeatMode, setCurrentTrack]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Drop stale YouTube card when the typed query changes.
    if (result) {
      setResult(null);
      setDownloadState({ status: 'idle', progress: 0 });
      setConfirmRedownload(false);
    }
  };

  /** YouTube only — library results already update from typing. */
  const handleYouTubeSearch = async () => {
    const q = query.trim();
    if (!q) return;

    if (!canSearchYouTube) {
      if (canSearchDrive) {
        window.alert(
          librarySectionSongs.length > 0
            ? 'Library matches are shown above. Add a YouTube API key in Settings to search YouTube.'
            : 'No library matches. Add a YouTube API key in Settings to search YouTube.'
        );
      } else {
        window.alert(searchHint);
      }
      return;
    }

    setIsSearching(true);
    setResult(null);
    setDownloadState({ status: 'idle', progress: 0 });
    setConfirmRedownload(false);

    try {
      const res = await searchYouTube(q, youtubeApiKey);
      setResult(res);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Search error');
    } finally {
      setIsSearching(false);
    }
  };

  const runDownload = async () => {
    if (!result) return;
    if (
      downloadState.status === 'extracting' ||
      downloadState.status === 'done'
    ) {
      return;
    }
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

  const requestDownload = () => {
    if (downloadState.status === 'error') {
      setDownloadState({ status: 'idle', progress: 0 });
    }
    if (existingMatch) {
      setConfirmRedownload(true);
      return;
    }
    void runDownload();
  };

  const statusLabel =
    downloadState.status === 'extracting'
      ? 'Downloading & saving to Drive…'
      : downloadState.status === 'done'
        ? 'Saved to Google Drive'
        : downloadState.status === 'error'
          ? 'Failed'
          : null;

  const downloadBusy =
    downloadState.status === 'extracting' || downloadState.status === 'done';

  const trimmedQuery = query.trim();

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
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleYouTubeSearch();
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={isSearching || !trimmedQuery}
          title={
            canSearchYouTube
              ? 'Search YouTube (uses API quota)'
              : 'YouTube search needs an API key in Settings'
          }
          onClick={() => void handleYouTubeSearch()}
        >
          {isSearching ? <span className="spinner" /> : <Icons.search size={18} />}
          {canSearchYouTube ? 'YouTube' : 'Search'}
        </button>
      </div>

      {librarySectionSongs.length > 0 ? (
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
            Already in your library
          </div>
          {librarySectionSongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              showPlayButton
              onPlay={() => void playSearchResult(song, libraryItems)}
            />
          ))}
        </section>
      ) : null}

      {result ? (
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
            YouTube
          </div>
          <div className="yt-card">
            <img src={result.thumbnail} alt="" />
            <div className="body">
              <div className="song-title" title={result.title}>
                {result.title}
              </div>
              <div className="song-sub">{result.channelTitle}</div>

              {existingMatch ? (
                <div className="yt-downloaded-badge" title={existingMatch.name}>
                  <Icons.check size={14} />
                  Already downloaded
                </div>
              ) : null}

              <button
                type="button"
                className={`btn ${existingMatch && !downloadBusy ? 'secondary' : ''}`}
                style={{ marginTop: 12, width: '100%' }}
                disabled={downloadBusy}
                onClick={requestDownload}
              >
                {downloadState.status === 'done'
                  ? 'Added to Drive'
                  : downloadState.status === 'idle' ||
                      downloadState.status === 'error'
                    ? existingMatch
                      ? 'Download again'
                      : 'Add to Drive'
                    : statusLabel}
              </button>
              {downloadState.status === 'extracting' ? (
                <div style={{ marginTop: 14 }}>
                  <LoadingState label="Downloading & saving…" compact />
                </div>
              ) : null}
              {downloadState.status === 'done' ? (
                <p
                  className="song-sub"
                  style={{ marginTop: 8, color: 'var(--primary)' }}
                >
                  Saved to Google Drive
                </p>
              ) : null}
              {existingMatch && downloadState.status === 'idle' ? (
                <p className="song-sub" style={{ marginTop: 8 }}>
                  This track is already in Liked Songs. You can still download it
                  again if you want.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {isSearching ? <LoadingState label="Searching YouTube…" rows={3} /> : null}

      {!isSearching &&
      !result &&
      librarySectionSongs.length === 0 &&
      trimmedQuery !== '' &&
      canSearchDrive ? (
        <div className="empty" style={{ paddingTop: 24 }}>
          <h3>Not in your library</h3>
          <p>
            {canSearchYouTube
              ? 'No Drive matches for that name. Tap YouTube if you want to download it.'
              : 'No Drive matches for that name.'}
          </p>
        </div>
      ) : null}

      {!isSearching &&
      !result &&
      librarySectionSongs.length === 0 &&
      trimmedQuery === '' ? (
        <div className="empty">
          <Icons.search size={64} />
          <h3>Search your music</h3>
          <p>{searchHint}</p>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRedownload}
        title="Already downloaded"
        message={
          existingMatch
            ? `"${existingMatch.name.replace(/\.[^.]+$/, '')}" is already in your Google Drive library. Download it again anyway?`
            : 'This song is already in your library. Download it again anyway?'
        }
        confirmLabel="Download again"
        cancelLabel="Cancel"
        busy={downloadState.status === 'extracting'}
        onCancel={() => setConfirmRedownload(false)}
        onConfirm={() => {
          setConfirmRedownload(false);
          void runDownload();
        }}
      />
    </div>
  );
}
