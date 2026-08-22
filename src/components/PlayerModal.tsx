import { Icons } from './Icons';
import TrackArt from './TrackArt';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
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

  const artwork = useTrackArtwork(track?.id);

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
          <TrackArt
            artwork={artwork}
            title={track?.title}
            className="player-art"
            iconSize={80}
          />
          <h3 className="player-title" title={track?.title ?? undefined}>
            {track?.title ?? 'No track loaded'}
          </h3>
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
              className={`icon-btn control-toggle ${shuffleEnabled ? 'on' : ''}`}
              aria-label={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
              title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
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

          <div className="player-controls">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous"
              title="Previous (Shift+P)"
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
              aria-label="Next"
              title="Next (Shift+N)"
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
