import { Icons } from './Icons';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { cycleRepeatMode } from '../utils/repeatMode';
import { formatTime } from './SongCard';

export default function PlayerModal() {
  const open = useStore((s) => s.isPlayerOpen);
  const setPlayerOpen = useStore((s) => s.setPlayerOpen);
  const setQueueOpen = useStore((s) => s.setQueueOpen);
  const track = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const isBuffering = useStore((s) => s.isBuffering);
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration);
  const shuffleEnabled = useStore((s) => s.shuffleEnabled);
  const repeatMode = useStore((s) => s.repeatMode);
  const setShuffleEnabled = useStore((s) => s.setShuffleEnabled);
  const setRepeatMode = useStore((s) => s.setRepeatMode);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setPlayerOpen(false)}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button type="button" className="icon-btn" onClick={() => setPlayerOpen(false)}>
            <Icons.chevronDown size={26} />
          </button>
          <h2>Now Playing</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setPlayerOpen(false);
              setQueueOpen(true);
            }}
          >
            <Icons.list size={22} />
          </button>
        </div>

        <div className="modal-body player-screen">
          <div className="player-art">
            <Icons.music size={80} />
          </div>
          <h3 className="player-title">{track?.title ?? 'No track loaded'}</h3>
          <p className="player-artist">
            {isBuffering ? 'Buffering…' : track?.artist ?? ''}
          </p>

          <div className="seek">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={position}
              onChange={(e) => void audioPlayer.seekTo(Number(e.target.value))}
            />
            <div className="time-row">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="secondary-controls">
            <button
              type="button"
              className="icon-btn"
              style={{ color: shuffleEnabled ? 'var(--primary)' : undefined }}
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
            >
              <Icons.shuffle />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{
                color: repeatMode !== 'off' ? 'var(--primary)' : undefined,
              }}
              onClick={() => setRepeatMode(cycleRepeatMode(repeatMode))}
            >
              <Icons.repeat />
              {repeatMode === 'one' ? <span style={{ fontSize: 10 }}>1</span> : null}
            </button>
          </div>

          <div className="player-controls">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void audioPlayer.skipToPrevious()}
            >
              <Icons.skipBack size={32} />
            </button>
            <button
              type="button"
              className="player-play"
              onClick={() => void audioPlayer.togglePlayPause()}
            >
              {isPlaying ? <Icons.pause size={34} /> : <Icons.play size={34} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => void audioPlayer.skipToNext()}
            >
              <Icons.skipForward size={32} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
