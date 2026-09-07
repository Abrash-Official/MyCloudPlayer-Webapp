import { useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import TrackArt from './TrackArt';
import TrackArtwork from './TrackArtwork';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { cycleRepeatMode } from '../utils/repeatMode';
import { sampleDominantColor } from '../utils/dominantColor';
import { formatTime } from './SongCard';

export default function PlayerModal() {
  const open = useStore((s) => s.isPlayerOpen);
  const setPlayerOpen = useStore((s) => s.setPlayerOpen);
  const setQueueOpen = useStore((s) => s.setQueueOpen);
  const track = useStore((s) => s.currentTrack);
  const queue = useStore((s) => s.playbackQueue);
  const index = useStore((s) => s.playbackIndex);
  const isPlaying = useStore((s) => s.isPlaying);
  const isBuffering = useStore((s) => s.isBuffering);
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration);
  const shuffleEnabled = useStore((s) => s.shuffleEnabled);
  const repeatMode = useStore((s) => s.repeatMode);
  const setShuffleEnabled = useStore((s) => s.setShuffleEnabled);
  const setRepeatMode = useStore((s) => s.setRepeatMode);

  const artwork = useTrackArtwork(track?.id, { mode: 'playing' });
  const [bg, setBg] = useState('#1a1a1a');

  const upcoming = useMemo(
    () =>
      queue.slice(index + 1).map((t, i) => ({
        track: t,
        queueIndex: index + 1 + i,
      })),
    [queue, index]
  );

  useEffect(() => {
    if (!artwork) {
      setBg('#1a1a1a');
      return;
    }
    let cancelled = false;
    void sampleDominantColor(artwork).then((color) => {
      if (!cancelled) setBg(color);
    });
    return () => {
      cancelled = true;
    };
  }, [artwork]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlayerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setPlayerOpen]);

  if (!open) return null;

  return (
    <div className="fullscreen-player" style={{ background: bg }}>
      <div className="fullscreen-main">
        <div className="fullscreen-top">
          <button
            type="button"
            className="icon-btn fullscreen-close"
            aria-label="Close full screen"
            onClick={() => setPlayerOpen(false)}
          >
            <Icons.chevronDown size={28} />
          </button>
          <button
            type="button"
            className="icon-btn fullscreen-queue-btn"
            aria-label="Open queue"
            onClick={() => setQueueOpen(true)}
          >
            <Icons.list size={22} />
          </button>
        </div>

        <div className="fullscreen-stage">
          <TrackArt
            artwork={artwork}
            title={track?.title}
            className="fullscreen-art"
            iconSize={96}
          />
        </div>

        <div className="fullscreen-meta">
          <h2 className="fullscreen-title" title={track?.title ?? undefined}>
            {track?.title ?? 'No track loaded'}
          </h2>
          <p className="fullscreen-artist">
            {isBuffering ? 'Buffering…' : track?.artist ?? ''}
          </p>
        </div>

        <div className="fullscreen-controls">
          <div className="seek">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={position}
              aria-label="Seek"
              onChange={(e) => void audioPlayer.seekTo(Number(e.target.value))}
            />
            <div className="time-row">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="fullscreen-transport">
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
              aria-label={isPlaying ? 'Pause' : 'Play'}
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
              onClick={() => setRepeatMode(cycleRepeatMode(repeatMode))}
            >
              <Icons.repeat />
              {repeatMode === 'one' ? <span className="repeat-badge">1</span> : null}
            </button>
          </div>
        </div>
      </div>

      <aside className="fullscreen-queue" aria-label="Queue">
        <h3>Queue</h3>
        <div className="queue-section-label">Now playing</div>
        {track ? (
          <div className="song-row active fullscreen-queue-now">
            <TrackArtwork
              trackId={track.id}
              title={track.title}
              className="song-art"
              isPlaying
            />
            <div className="song-text">
              <div className="song-title" title={track.title}>
                {track.title}
              </div>
              <div className="song-sub">{track.artist}</div>
            </div>
          </div>
        ) : (
          <div className="empty" style={{ padding: 12 }}>
            Nothing playing
          </div>
        )}

        <div className="queue-section-label" style={{ marginTop: 16 }}>
          Next in queue
        </div>
        <div className="fullscreen-queue-list">
          {upcoming.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              No upcoming tracks
            </div>
          ) : (
            upcoming.map((item) => (
              <button
                key={`${item.queueIndex}-${item.track.id}`}
                type="button"
                className="song-row"
                onClick={() => void audioPlayer.skipToIndex(item.queueIndex)}
              >
                <TrackArtwork
                  trackId={item.track.id}
                  title={item.track.title}
                  className="song-art"
                />
                <div className="song-text">
                  <div className="song-title" title={item.track.title}>
                    {item.track.title}
                  </div>
                  <div className="song-sub">{item.track.artist}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
