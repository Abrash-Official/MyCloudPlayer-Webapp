import { useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import TrackArt from './TrackArt';
import TrackArtwork from './TrackArtwork';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { cycleRepeatMode } from '../utils/repeatMode';
import { sampleBackdropPalette } from '../utils/dominantColor';
import { formatTime } from './SongCard';

type QueueTab = 'upnext' | 'history';

export default function PlayerModal() {
  const open = useStore((s) => s.isPlayerOpen);
  const setPlayerOpen = useStore((s) => s.setPlayerOpen);
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
  const [bg, setBg] = useState(
    'linear-gradient(180deg, #1e3a5f 0%, #0f1720 42%, #050505 100%)'
  );
  const [queueOpen, setQueueOpen] = useState(true);
  const [tab, setTab] = useState<QueueTab>('upnext');
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const previous = useMemo(
    () =>
      queue
        .slice(0, index)
        .map((t, i) => ({ track: t, queueIndex: i }))
        .reverse(),
    [queue, index]
  );

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
      setBg('linear-gradient(180deg, #1e3a5f 0%, #0f1720 42%, #050505 100%)');
      return;
    }
    let cancelled = false;
    void sampleBackdropPalette(artwork).then((palette) => {
      if (!cancelled) setBg(palette.background);
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

  const move = async (from: number, to: number) => {
    await audioPlayer.moveTrack(from, to);
  };

  return (
    <div className="fullscreen-player" style={{ background: bg }}>
      <div className="fullscreen-main">
        <div className="fullscreen-top">
          <button
            type="button"
            className="icon-btn fullscreen-close"
            aria-label="Close full screen"
            title="Close"
            onClick={() => setPlayerOpen(false)}
          >
            <Icons.chevronDown size={28} />
          </button>
          <div className="fullscreen-context">Liked Songs</div>
          <button
            type="button"
            className={`icon-btn fullscreen-queue-toggle ${queueOpen ? 'on' : ''}`}
            aria-label={queueOpen ? 'Hide queue' : 'Show queue'}
            title={queueOpen ? 'Hide queue' : 'Show queue'}
            onClick={() => setQueueOpen((v) => !v)}
          >
            <Icons.list size={22} />
          </button>
        </div>

        <div className="fullscreen-stage">
          {artwork ? (
            <div
              className="fullscreen-glow"
              style={{ backgroundImage: `url(${artwork})` }}
              aria-hidden
            />
          ) : null}
          <TrackArt
            artwork={artwork}
            title={track?.title}
            className="fullscreen-art"
            iconSize={96}
          />
        </div>

        <div className="fullscreen-bottom">
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
                onClick={() => setShuffleEnabled(!shuffleEnabled)}
              >
                <Icons.shuffle />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Previous"
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
                onClick={() => void audioPlayer.skipToNext()}
              >
                <Icons.skipForward size={32} />
              </button>
              <button
                type="button"
                className={`icon-btn control-toggle ${repeatMode !== 'off' ? 'on' : ''}`}
                aria-label="Repeat"
                onClick={() => setRepeatMode(cycleRepeatMode(repeatMode))}
              >
                <Icons.repeat />
                {repeatMode === 'one' ? (
                  <span className="repeat-badge">1</span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </div>

      {queueOpen ? (
        <aside className="fullscreen-queue" aria-label="Queue">
          <div className="fullscreen-queue-header">
            <h3>Queue</h3>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close queue"
              title="Close queue"
              onClick={() => setQueueOpen(false)}
            >
              <Icons.close size={20} />
            </button>
          </div>

          <div className="queue-tabs fullscreen-queue-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upnext'}
              className={`queue-tab ${tab === 'upnext' ? 'active' : ''}`}
              onClick={() => setTab('upnext')}
            >
              Up next ({upcoming.length + (track ? 1 : 0)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              className={`queue-tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => setTab('history')}
            >
              History ({previous.length})
            </button>
          </div>

          <div className="fullscreen-queue-body">
            {tab === 'upnext' ? (
              <>
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

                <div className="queue-section-label" style={{ marginTop: 12 }}>
                  Next in queue
                  {upcoming.length > 0 ? (
                    <span className="queue-hint"> Drag or use arrows</span>
                  ) : null}
                </div>

                <div className="fullscreen-queue-list">
                  {upcoming.length === 0 ? (
                    <div className="empty" style={{ padding: 12 }}>
                      No upcoming tracks
                    </div>
                  ) : (
                    upcoming.map((item, visualIndex) => {
                      const canMoveUp = visualIndex > 0;
                      const canMoveDown = visualIndex < upcoming.length - 1;
                      return (
                        <div
                          key={`${item.queueIndex}-${item.track.id}`}
                          className={`song-row queue-row ${
                            dragFrom === item.queueIndex ? 'dragging' : ''
                          }`}
                          draggable
                          onDragStart={() => setDragFrom(item.queueIndex)}
                          onDragEnd={() => setDragFrom(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (
                              dragFrom == null ||
                              dragFrom === item.queueIndex
                            ) {
                              return;
                            }
                            void move(dragFrom, item.queueIndex).then(() =>
                              setDragFrom(null)
                            );
                          }}
                        >
                          <span className="queue-grip" title="Drag to reorder">
                            <Icons.grip size={16} />
                          </span>
                          <button
                            type="button"
                            className="song-text"
                            style={{
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center',
                              minWidth: 0,
                              flex: 1,
                            }}
                            onClick={() =>
                              void audioPlayer.skipToIndex(item.queueIndex)
                            }
                          >
                            <TrackArtwork
                              trackId={item.track.id}
                              title={item.track.title}
                              className="song-art"
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                className="song-title"
                                title={item.track.title}
                              >
                                {item.track.title}
                              </div>
                              <div className="song-sub">
                                {item.track.artist}
                              </div>
                            </div>
                          </button>
                          <div className="queue-reorder">
                            <button
                              type="button"
                              className="icon-btn queue-move"
                              aria-label="Move up"
                              disabled={!canMoveUp}
                              onClick={() => {
                                if (!canMoveUp) return;
                                void move(
                                  item.queueIndex,
                                  item.queueIndex - 1
                                );
                              }}
                            >
                              <Icons.chevronUp size={18} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn queue-move"
                              aria-label="Move down"
                              disabled={!canMoveDown}
                              onClick={() => {
                                if (!canMoveDown) return;
                                void move(
                                  item.queueIndex,
                                  item.queueIndex + 1
                                );
                              }}
                            >
                              <Icons.chevronDown size={18} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Remove from queue"
                            onClick={() =>
                              void audioPlayer.removeAt(item.queueIndex)
                            }
                          >
                            <Icons.close size={18} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : previous.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>
                <h3>No history yet</h3>
                <p>Skip back while playing to build history</p>
              </div>
            ) : (
              <div className="fullscreen-queue-list">
                {previous.map((item) => (
                  <div
                    className="song-row"
                    key={`h-${item.queueIndex}-${item.track.id}`}
                  >
                    <TrackArtwork
                      trackId={item.track.id}
                      title={item.track.title}
                      className="song-art"
                      iconSize={16}
                    />
                    <div className="song-text" style={{ minWidth: 0, flex: 1 }}>
                      <div className="song-title" title={item.track.title}>
                        {item.track.title}
                      </div>
                      <div className="song-sub">{item.track.artist}</div>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Add to queue"
                      aria-label="Add to queue"
                      onClick={() => void audioPlayer.addToQueue(item.track)}
                    >
                      <Icons.list size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Play next"
                      aria-label="Play next"
                      onClick={() => {
                        void audioPlayer
                          .playNext(item.track)
                          .then(() => setTab('upnext'));
                      }}
                    >
                      <Icons.play size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
