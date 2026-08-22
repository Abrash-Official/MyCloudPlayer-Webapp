import { Icons } from './Icons';
import TrackArt from './TrackArt';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { cycleRepeatMode } from '../utils/repeatMode';
import { formatTime } from './SongCard';

function repeatLabel(mode: 'off' | 'all' | 'one') {
  if (mode === 'all') return 'Repeat all';
  if (mode === 'one') return 'Repeat one';
  return 'Repeat off';
}

export default function MiniPlayer() {
  const currentTrack = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const isBuffering = useStore((s) => s.isBuffering);
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration);
  const shuffleEnabled = useStore((s) => s.shuffleEnabled);
  const repeatMode = useStore((s) => s.repeatMode);
  const setShuffleEnabled = useStore((s) => s.setShuffleEnabled);
  const setRepeatMode = useStore((s) => s.setRepeatMode);
  const setPlayerOpen = useStore((s) => s.setPlayerOpen);
  const setQueueOpen = useStore((s) => s.setQueueOpen);

  const artwork = useTrackArtwork(currentTrack?.id) ?? currentTrack?.artwork;

  if (!currentTrack) return null;

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="mini-player">
      <div className="mini-progress mobile-only">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>

      {/* Mobile compact bar */}
      <div
        className="mini-content mini-mobile"
        onClick={() => setPlayerOpen(true)}
        role="button"
      >
        <TrackArt
          artwork={artwork}
          title={currentTrack.title}
          className="mini-art"
          iconSize={20}
        />
        <div className="mini-info">
          <div className="mini-title" title={currentTrack.title}>
            {currentTrack.title}
          </div>
          <div className="mini-artist">
            {isBuffering ? 'Loading…' : currentTrack.artist}
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
          aria-label="Next"
          title="Next (Shift+N)"
          onClick={(e) => {
            e.stopPropagation();
            void audioPlayer.skipToNext();
          }}
        >
          <Icons.skipForward size={22} />
        </button>
      </div>

      {/* Desktop Spotify-style bar */}
      <div className="mini-desktop">
        <button
          type="button"
          className="mini-desktop-left"
          onClick={() => setPlayerOpen(true)}
        >
          <TrackArt
            artwork={artwork}
            title={currentTrack.title}
            className="mini-art"
            iconSize={22}
          />
          <div className="mini-info">
            <div className="mini-title" title={currentTrack.title}>
              {currentTrack.title}
            </div>
            <div className="mini-artist">
              {isBuffering ? 'Loading…' : currentTrack.artist}
            </div>
          </div>
        </button>

        <div className="mini-desktop-center">
          <div className="mini-desktop-controls">
            <button
              type="button"
              className={`icon-btn control-toggle ${shuffleEnabled ? 'on' : ''}`}
              aria-label={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
              title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
            >
              <Icons.shuffle size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous"
              title="Previous (Shift+P)"
              onClick={() => void audioPlayer.skipToPrevious()}
            >
              <Icons.skipBack size={20} />
            </button>
            <button
              type="button"
              className="mini-play-btn"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => void audioPlayer.togglePlayPause()}
            >
              {isBuffering ? (
                <span className="spinner" />
              ) : isPlaying ? (
                <Icons.pause size={20} />
              ) : (
                <Icons.play size={20} />
              )}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next"
              title="Next (Shift+N)"
              onClick={() => void audioPlayer.skipToNext()}
            >
              <Icons.skipForward size={20} />
            </button>
            <button
              type="button"
              className={`icon-btn control-toggle ${repeatMode !== 'off' ? 'on' : ''}`}
              aria-label={repeatLabel(repeatMode)}
              title={`${repeatLabel(repeatMode)} — click to change`}
              onClick={() => setRepeatMode(cycleRepeatMode(repeatMode))}
            >
              <Icons.repeat size={18} />
              {repeatMode === 'one' ? <span className="repeat-badge">1</span> : null}
            </button>
          </div>
          <div className="mini-desktop-seek">
            <span className="mini-time">{formatTime(position)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={position}
              aria-label="Seek"
              onChange={(e) => void audioPlayer.seekTo(Number(e.target.value))}
            />
            <span className="mini-time">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="mini-desktop-right">
          <button
            type="button"
            className="icon-btn"
            aria-label="Open queue"
            title="Queue"
            onClick={() => setQueueOpen(true)}
          >
            <Icons.list size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Expand player"
            onClick={() => setPlayerOpen(true)}
          >
            <Icons.chevronUp size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
