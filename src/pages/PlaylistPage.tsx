import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Icons } from '../components/Icons';
import SongCard from '../components/SongCard';
import {
  copySongToPlaylist,
  listPlaylistSongs,
  removeFromPlaylist,
} from '../api/drive';
import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import {
  driveFileToLibraryItem,
  libraryItemsToTracks,
} from '../utils/libraryItems';
import { buildPlayQueue } from '../utils/playerQueue';
import { playQueue, reshuffleActiveQueue } from '../utils/playback';
import { searchLocalLibrary } from '../utils/localSearch';
import { stripAudioExtension } from '../utils/filename';
import LoadingState from '../components/LoadingState';
import type { DriveFile, DriveFolder, LibraryItem } from '../types';

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const folderFromState = (location.state as { folder?: DriveFolder } | null)
    ?.folder;
  const storePlaylist = useStore((s) =>
    s.playlists.find((p) => p.id === id)
  );
  const folder: DriveFolder = folderFromState ??
    storePlaylist ?? { id: id ?? '', name: 'Playlist' };

  const {
    songs: librarySongs,
    accessToken,
    setCurrentTrack,
    shuffleEnabled,
    repeatMode,
    setShuffleEnabled,
    isPlaying,
  } = useStore();

  const [playlistSongs, setPlaylistSongs] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const libraryItems = useMemo(
    () => playlistSongs.map(driveFileToLibraryItem),
    [playlistSongs]
  );

  const searchResults = useMemo(
    () => searchLocalLibrary(libraryItems, query, 100),
    [libraryItems, query]
  );

  const loadSongs = useCallback(async () => {
    if (!folder.id) return;
    setLoading(true);
    try {
      const token = await getFreshAccessToken();
      const songs = await listPlaylistSongs(folder.id, token);
      setPlaylistSongs(songs);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  const playSong = async (song: DriveFile, shuffle?: boolean) => {
    try {
      const useShuffle = shuffle ?? shuffleEnabled;
      const items = libraryItems;
      const start = driveFileToLibraryItem(song);
      const queueItems = buildPlayQueue(items, start, useShuffle);
      let token = accessToken;
      token = await getFreshAccessToken();
      const tracks = libraryItemsToTracks(queueItems, token).map((t) => ({
        ...t,
        artist: folder.name,
      }));
      setCurrentTrack(tracks[0]);
      useStore.getState().setPlaybackSession(tracks, 0, tracks[0]);
      await playQueue(tracks, { repeatMode, forceRestart: true });
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Playback error');
    }
  };

  const handleRemove = async (song: DriveFile) => {
    try {
      const token = await getFreshAccessToken();
      await removeFromPlaylist(folder.id, song.id, token);
      setPlaylistSongs((prev) => prev.filter((s) => s.id !== song.id));
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const handleAdd = async (libSong: DriveFile) => {
    setAddingId(libSong.id);
    try {
      const token = await getFreshAccessToken();
      const entry = await copySongToPlaylist(libSong.id, folder.id, token);
      setPlaylistSongs((prev) => [
        entry,
        ...prev.filter((s) => s.id !== entry.id),
      ]);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setAddingId(null);
    }
  };

  const availableToAdd = librarySongs.filter(
    (ls) => !playlistSongs.some((ps) => ps.id === ls.id)
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <Link to="/" className="icon-btn" aria-label="Back">
            <Icons.chevronBack />
          </Link>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 20 }}>{folder.name}</h1>
            <p className="sub">{playlistSongs.length} songs</p>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSearchOpen(true)}
          >
            <Icons.search />
          </button>
          <button type="button" className="icon-btn" onClick={() => setAddOpen(true)}>
            <Icons.plus />
          </button>
        </div>
      </header>

      {loading && playlistSongs.length === 0 ? (
        <LoadingState label="Loading playlist…" rows={6} />
      ) : (
        <>
          {playlistSongs.length > 0 ? (
            <>
              <div className="hero-card">
                <div className="hero-art">
                  <Icons.albums size={42} />
                </div>
                <div className="hero-meta">
                  <div className="hero-kicker">PLAYLIST</div>
                  <h2 className="hero-title">{folder.name}</h2>
                  <p className="hero-sub">
                    {playlistSongs.length} songs · Google Drive
                  </p>
                </div>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="play-fab"
                  onClick={() => void playSong(playlistSongs[0], shuffleEnabled)}
                >
                  {isPlaying ? <Icons.pause size={28} /> : <Icons.play size={28} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    const next = !shuffleEnabled;
                    setShuffleEnabled(next);
                    if (next) {
                      if (useStore.getState().playbackQueue.length > 0) {
                        void reshuffleActiveQueue(repeatMode);
                      } else {
                        void playSong(playlistSongs[0], true);
                      }
                    }
                  }}
                >
                  <Icons.shuffle />
                </button>
              </div>
            </>
          ) : null}

          {playlistSongs.length === 0 ? (
            <div className="empty">
              <Icons.albums size={64} />
              <h3>Empty playlist</h3>
              <p>Tap + to add songs from your library</p>
            </div>
          ) : (
            playlistSongs.map((song, i) => (
              <SongCard
                key={song.folderItemId ?? song.id}
                song={driveFileToLibraryItem(song)}
                index={i + 1}
                onPlay={() => void playSong(song)}
                onDelete={() => void handleRemove(song)}
                deleteLabel="Remove"
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
                placeholder={`Search in ${folder.name}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-body">
              {searchResults.map((item: LibraryItem) => {
                const song = playlistSongs.find((s) => s.id === item.id);
                if (!song) return null;
                return (
                  <SongCard
                    key={item.id}
                    song={item}
                    showPlayButton
                    onPlay={() => {
                      setSearchOpen(false);
                      void playSong(song);
                    }}
                    onDelete={() => void handleRemove(song)}
                    deleteLabel="Remove"
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setAddOpen(false)}
              >
                <Icons.close />
              </button>
              <h2>Add to {folder.name}</h2>
              <div style={{ width: 40 }} />
            </div>
            <div className="modal-body">
              {availableToAdd.length === 0 ? (
                <div className="empty">
                  All library songs are already in this playlist.
                </div>
              ) : (
                availableToAdd.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="song-row"
                    disabled={addingId === item.id}
                    onClick={() => void handleAdd(item)}
                  >
                    <div className="song-art">
                      <Icons.music size={18} />
                    </div>
                    <div className="song-text">
                      <div className="song-title">
                        {stripAudioExtension(item.name)}
                      </div>
                    </div>
                    {addingId === item.id ? (
                      <span className="spinner" />
                    ) : (
                      <Icons.plus size={20} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
