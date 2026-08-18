import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import ConfirmDialog from './ConfirmDialog';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { toPlayerTrack } from '../utils/libraryItems';
import { stripAudioExtension } from '../utils/filename';
import type { LibraryItem } from '../types';

interface SongCardProps {
  song: LibraryItem;
  index?: number;
  onPlay: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  showPlayButton?: boolean;
  onPrefetch?: () => void;
  /** Show Add to queue / Play next in the ⋮ menu (default true). */
  allowQueueActions?: boolean;
}

export default function SongCard({
  song,
  index,
  onPlay,
  onDelete,
  deleteLabel = 'Delete',
  showPlayButton = false,
  onPrefetch,
  allowQueueActions = true,
}: SongCardProps) {
  const currentTrack = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const isActive = currentTrack?.id === song.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const withTrack = (action: (track: ReturnType<typeof toPlayerTrack>) => Promise<void> | void) => {
    const token = useStore.getState().accessToken;
    if (!token) {
      useStore.getState().setSessionExpired(true);
      setToast('Reconnect Google to continue');
      return;
    }
    try {
      const track = toPlayerTrack(song, token);
      void Promise.resolve(action(track)).catch((err: unknown) => {
        setToast(err instanceof Error ? err.message : 'Action failed');
      });
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const showMenu = allowQueueActions || Boolean(onDelete);
  const displayName = stripAudioExtension(song.name);

  return (
    <div
      className={`song-row ${isActive ? 'active' : ''}`}
      onPointerEnter={() => onPrefetch?.()}
    >
      {index != null ? <span className="song-index">{index}</span> : null}
      <button type="button" className="song-art" onClick={onPlay} aria-label="Play">
        <Icons.music size={18} />
      </button>
      <button type="button" className="song-text" onClick={onPlay} title={displayName}>
        <div className="song-title">{displayName}</div>
        <div className="song-sub">
          {isActive ? (isPlaying ? 'Now playing' : 'Paused') : 'Google Drive'}
        </div>
      </button>
      {showPlayButton ? (
        <button type="button" className="icon-btn" onClick={onPlay} aria-label="Play">
          <Icons.play size={18} />
        </button>
      ) : null}
      {showMenu ? (
        <div className="song-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <Icons.more size={18} />
          </button>
          {menuOpen ? (
            <div className="song-menu" role="menu">
              {allowQueueActions ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="song-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      withTrack((track) =>
                        audioPlayer.addToQueue(track).then(() => {
                          setToast('Added to queue');
                        })
                      );
                    }}
                  >
                    <Icons.list size={16} />
                    Add to queue
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="song-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      withTrack((track) =>
                        audioPlayer.playNext(track).then(() => {
                          setToast('Playing next');
                        })
                      );
                    }}
                  >
                    <Icons.skipForward size={16} />
                    Play next
                  </button>
                </>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className="song-menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  <Icons.close size={16} />
                  {deleteLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {toast ? <div className="song-toast">{toast}</div> : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`${deleteLabel} song?`}
        message={`Remove “${stripAudioExtension(song.name)}” from your library? This can’t be undone.`}
        confirmLabel={deleteLabel}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete?.();
        }}
      />
    </div>
  );
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export { audioPlayer };
