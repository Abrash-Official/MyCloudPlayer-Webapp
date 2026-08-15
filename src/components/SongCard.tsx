import { Icons } from './Icons';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import type { LibraryItem } from '../types';
import { stripAudioExtension } from '../utils/filename';

interface SongCardProps {
  song: LibraryItem;
  index?: number;
  onPlay: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  showPlayButton?: boolean;
  onPrefetch?: () => void;
}

export default function SongCard({
  song,
  index,
  onPlay,
  onDelete,
  deleteLabel = 'Delete',
  showPlayButton = false,
  onPrefetch,
}: SongCardProps) {
  const currentTrack = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const isActive = currentTrack?.id === song.id;

  return (
    <div
      className={`song-row ${isActive ? 'active' : ''}`}
      onPointerEnter={() => onPrefetch?.()}
    >
      {index != null ? <span className="song-index">{index}</span> : null}
      <button type="button" className="song-art" onClick={onPlay} aria-label="Play">
        {isActive && isPlaying ? <Icons.music size={18} /> : <Icons.music size={18} />}
      </button>
      <button type="button" className="song-text" onClick={onPlay}>
        <div className="song-title">{stripAudioExtension(song.name)}</div>
        <div className="song-sub">
          {isActive ? (isPlaying ? 'Now playing' : 'Paused') : 'Google Drive'}
        </div>
      </button>
      {showPlayButton ? (
        <button type="button" className="icon-btn" onClick={onPlay} aria-label="Play">
          <Icons.play size={18} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="icon-btn"
          aria-label="More"
          onClick={() => {
            if (
              window.confirm(
                `${deleteLabel} "${stripAudioExtension(song.name)}"?`
              )
            ) {
              onDelete();
            }
          }}
        >
          <Icons.more size={18} />
        </button>
      ) : null}
    </div>
  );
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export { audioPlayer };
