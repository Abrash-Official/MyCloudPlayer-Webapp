import { Icons } from './Icons';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';

export default function MiniPlayer() {
  const currentTrack = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const isBuffering = useStore((s) => s.isBuffering);
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration);
  const setPlayerOpen = useStore((s) => s.setPlayerOpen);

  if (!currentTrack) return null;

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="mini-player" onClick={() => setPlayerOpen(true)} role="button">
      <div className="mini-progress">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="mini-content">
        <div className="mini-art">
          <Icons.music size={20} />
        </div>
        <div className="mini-info">
          <div className="mini-title">{currentTrack.title}</div>
          <div className="mini-artist">
            {isBuffering ? 'Buffering…' : currentTrack.artist}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            void audioPlayer.togglePlayPause();
          }}
        >
          {isBuffering ? (
            <span className="spinner" />
          ) : isPlaying ? (
            <Icons.pause size={24} />
          ) : (
            <Icons.play size={24} />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            void audioPlayer.skipToNext();
          }}
        >
          <Icons.skipForward size={22} />
        </button>
      </div>
    </div>
  );
}
