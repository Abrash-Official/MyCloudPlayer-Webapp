import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../components/Icons';
import SongCard from '../components/SongCard';
import PlaylistCard from '../components/PlaylistCard';
import {
  createPlaylistFolder,
  deleteSong,
  listPlaylists,
  listSongs,
} from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import {
  driveFileToLibraryItem,
  libraryItemsToTracks,
  toPlayerTrack,
} from '../utils/libraryItems';
import { buildPlayQueue } from '../utils/playerQueue';
import { playQueue, reshuffleActiveQueue } from '../utils/playback';
import { searchLocalLibrary } from '../utils/localSearch';
import { cycleRepeatMode } from '../utils/repeatMode';
import LoadingState from '../components/LoadingState';
import { audioPlayer } from '../audio/player';
import type { LibraryItem } from '../types';

type LibTab = 'songs' | 'playlists';

export default function LibraryPage() {
  const {
    songs,
    playlists,
    isLoadingLibrary,
    isAuthenticated,
    myCloudPlayerFolderId,
    accessToken,
    setSongs,
    setPlaylists,
    setLoadingLibrary,
    setLibraryError,
    removeSong,
    addPlaylist,
    removePlaylist,
    setCurrentTrack,
    shuffleEnabled,
    repeatMode,
    setShuffleEnabled,
    setRepeatMode,
    isPlaying,
    setQueueOpen,
  } = useStore();

  const [tab, setTab] = useState<LibTab>('songs');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const loaded = useRef(false);

  const displaySongs = useMemo(
    () => songs.map(driveFileToLibraryItem),
    [songs]
  );

  const searchResults = useMemo(
    () => searchLocalLibrary(displaySongs, query, 100),
    [displaySongs, query]
  );

  const loadLibrary = useCallback(
    async (force = false) => {
      if (!isAuthenticated || !myCloudPlayerFolderId) {
        setSongs([]);
        setPlaylists([]);
        return;
      }

      if (!force && songs.length > 0) {
        /* keep cached */
      } else {
        setLoadingLibrary(true);
      }

      try {
        const token = await getFreshAccessToken();
        const [fetchedSongs, fetchedPlaylists] = await Promise.all([
          listSongs(myCloudPlayerFolderId, token),
          listPlaylists(myCloudPlayerFolderId, token),
        ]);
        setSongs(fetchedSongs);
        setPlaylists(fetchedPlaylists);
        setLibraryError(null);

        // Warm first few tracks so the first play starts faster
        if (fetchedSongs.length > 0) {
          const warmItems = fetchedSongs.slice(0, 3).map(driveFileToLibraryItem);
          try {
            audioPlayer.warmTracks(libraryItemsToTracks(warmItems, token));
          } catch {
            /* ignore warm errors */
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Library error';
        setLibraryError(message);
        if (songs.length === 0) window.alert(message);
      } finally {
        setLoadingLibrary(false);
      }
    },
    [
      isAuthenticated,
      myCloudPlayerFolderId,
      songs.length,
      setSongs,
      setPlaylists,
      setLoadingLibrary,
      setLibraryError,
    ]
  );

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void loadLibrary(false);
  }, [loadLibrary]);

  const playSong = useCallback(
    async (song: LibraryItem, queue: LibraryItem[], shuffle?: boolean) => {
      try {
        const useShuffle = shuffle ?? shuffleEnabled;
        const items = buildPlayQueue(queue, song, useShuffle);
        let token = accessToken;
        token = await getFreshAccessToken();
        const tracks = libraryItemsToTracks(items, token);
        setCurrentTrack(tracks[0]);
        useStore.getState().setPlaybackSession(tracks, 0, tracks[0]);
        await playQueue(tracks, { repeatMode, forceRestart: true });
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

  const handlePlayAll = () => {
    if (displaySongs.length === 0) return;
    void playSong(displaySongs[0], displaySongs, shuffleEnabled);
  };

  const handleShuffleToggle = async () => {
    const next = !shuffleEnabled;
    setShuffleEnabled(next);
    if (!next) return;
    try {
      if (audioHasQueue()) {
        await reshuffleActiveQueue(repeatMode);
        return;
      }
      if (displaySongs.length === 0) return;
      await playSong(displaySongs[0], displaySongs, true);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Playback error');
    }
  };

  const handleDeleteSong = async (song: LibraryItem) => {
    try {
      const token = await getFreshAccessToken();
      await deleteSong(song.id, token);
      removeSong(song.id);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !myCloudPlayerFolderId) {
      window.alert('Connect Google Drive in Settings to create playlists.');
      return;
    }
    setCreating(true);
    try {
      const token = await getFreshAccessToken();
      const folder = await createPlaylistFolder(
        newPlaylistName.trim(),
        myCloudPlayerFolderId,
        token
      );
      addPlaylist(folder);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      const token = await getFreshAccessToken();
      await deleteSong(id, token);
      removePlaylist(id);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Your Library</h1>
          <p className="sub">
            {tab === 'songs'
              ? `${displaySongs.length} songs`
              : `${playlists.length} playlists`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Icons.search />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Queue"
            onClick={() => setQueueOpen(true)}
          >
            <Icons.list size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh library"
            onClick={() => void loadLibrary(true)}
          >
            <Icons.refresh size={20} />
          </button>
        </div>
      </header>

      <div className="chips">
        <button
          type="button"
          className={`chip ${tab === 'songs' ? 'active' : ''}`}
          onClick={() => setTab('songs')}
        >
          Songs ({displaySongs.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'playlists' ? 'active' : ''}`}
          onClick={() => setTab('playlists')}
        >
          Playlists ({playlists.length})
        </button>
      </div>

      {tab === 'songs' ? (
        <>
          {displaySongs.length > 0 ? (
            <>
              <div className="hero-card">
                <div className="hero-art">
                  <Icons.music size={42} />
                </div>
                <div className="hero-meta">
                  <div className="hero-kicker">PLAYLIST</div>
                  <h2 className="hero-title">Liked Songs</h2>
                  <p className="hero-sub">{displaySongs.length} songs</p>
                </div>
              </div>
              <div className="hero-actions">
                <button type="button" className="play-fab" onClick={handlePlayAll}>
                  {isPlaying ? <Icons.pause size={28} /> : <Icons.play size={28} />}
                </button>
                <button
                  type="button"
                  className={`icon-btn control-toggle ${shuffleEnabled ? 'on' : ''}`}
                  aria-label={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
                  title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
                  onClick={() => void handleShuffleToggle()}
                >
                  <Icons.shuffle />
                </button>
                <button
                  type="button"
                  className={`icon-btn control-toggle ${repeatMode !== 'off' ? 'on' : ''}`}
                  aria-label={
                    repeatMode === 'off'
                      ? 'Repeat off'
                      : repeatMode === 'all'
                        ? 'Repeat all'
                        : 'Repeat one'
                  }
                  title={
                    repeatMode === 'off'
                      ? 'Repeat off — click for Repeat all'
                      : repeatMode === 'all'
                        ? 'Repeat all — click for Repeat one'
                        : 'Repeat one — click to turn off'
                  }
                  onClick={() => setRepeatMode(cycleRepeatMode(repeatMode))}
                >
                  <Icons.repeat />
                  {repeatMode === 'one' ? <span className="repeat-badge">1</span> : null}
                </button>
              </div>
            </>
          ) : null}

          {isLoadingLibrary && displaySongs.length === 0 ? (
            <LoadingState label="Syncing your library…" rows={6} />
          ) : displaySongs.length === 0 ? (
            <div className="empty">
              <Icons.music size={64} />
              <h3>No songs yet</h3>
              <p>
                {isAuthenticated
                  ? 'Upload songs to your MyCloudPlayer Drive folder, then refresh.'
                  : 'Connect Google Drive in Settings to sync your library.'}
              </p>
            </div>
          ) : (
            displaySongs.map((song, i) => (
              <SongCard
                key={song.id}
                song={song}
                index={i + 1}
                onPlay={() => void playSong(song, displaySongs)}
                onDelete={() => void handleDeleteSong(song)}
                onPrefetch={() => {
                  const token = useStore.getState().accessToken;
                  if (!token) return;
                  try {
                    audioPlayer.warmTrack(toPlayerTrack(song, token));
                  } catch {
                    /* ignore */
                  }
                }}
              />
            ))
          )}
        </>
      ) : (
        <>
          {isAuthenticated ? (
            <div style={{ padding: 16 }}>
              {showNewPlaylist ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="search-input"
                    placeholder="Playlist name…"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreatePlaylist();
                    }}
                    autoFocus
                  />
                  {creating ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <button type="button" className="btn" onClick={() => void handleCreatePlaylist()}>
                        Create
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setShowNewPlaylist(false)}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: '100%' }}
                  onClick={() => setShowNewPlaylist(true)}
                >
                  <Icons.plus size={18} /> Create playlist
                </button>
              )}
            </div>
          ) : (
            <div className="empty">
              <p>Connect Google Drive in Settings to use playlists.</p>
            </div>
          )}

          {playlists.length === 0 && isAuthenticated ? (
            <div className="empty">
              <Icons.albums size={64} />
              <h3>No playlists yet</h3>
            </div>
          ) : (
            playlists.map((p) => (
              <PlaylistCard
                key={p.id}
                playlist={p}
                onDelete={() => void handleDeletePlaylist(p.id)}
              />
            ))
          )}
        </>
      )}

      {searchOpen ? (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSearchOpen(false)}
              >
                <Icons.chevronDown />
              </button>
              <h2>Search</h2>
              <div style={{ width: 40 }} />
            </div>
            <div style={{ padding: 16 }}>
              <input
                className="search-input"
                placeholder="Search songs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-body">
              {!query.trim() ? (
                <div className="empty">
                  <Icons.search size={48} />
                  <h3>Find songs quickly</h3>
                  <p>Type a song name to filter your library</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="empty">
                  <h3>No matches</h3>
                </div>
              ) : (
                searchResults.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    showPlayButton
                    onPlay={() => {
                      setSearchOpen(false);
                      void playSong(song, displaySongs);
                    }}
                    onDelete={() => void handleDeleteSong(song)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function audioHasQueue(): boolean {
  return useStore.getState().playbackQueue.length > 0;
}
