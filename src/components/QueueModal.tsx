import { useMemo, useState } from 'react';
import { Icons } from './Icons';
import { useStore } from '../store/useStore';
import { audioPlayer } from '../audio/player';

type QueueTab = 'upnext' | 'history';

export default function QueueModal() {
  const open = useStore((s) => s.isQueueOpen);
  const setQueueOpen = useStore((s) => s.setQueueOpen);
  const queue = useStore((s) => s.playbackQueue);
  const index = useStore((s) => s.playbackIndex);
  const currentTrack = useStore((s) => s.currentTrack);
  const [tab, setTab] = useState<QueueTab>('upnext');
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const previous = useMemo(
    () =>
      queue
        .slice(0, index)
        .map((track, i) => ({ track, queueIndex: i }))
        .reverse(),
    [queue, index]
  );

  const upcoming = useMemo(
    () =>
      queue.slice(index + 1).map((track, i) => ({
        track,
        queueIndex: index + 1 + i,
      })),
    [queue, index]
  );

  if (!open) return null;

  const move = async (from: number, to: number) => {
    await audioPlayer.moveTrack(from, to);
  };

  return (
    <div className="modal-backdrop" onClick={() => setQueueOpen(false)}>
      <div className="modal-sheet queue-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button type="button" className="icon-btn" onClick={() => setQueueOpen(false)}>
            <Icons.chevronDown size={26} />
          </button>
          <h2>Queue</h2>
          <div style={{ width: 40 }} />
        </div>

        <div className="queue-tabs" role="tablist" aria-label="Queue views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upnext'}
            className={`queue-tab ${tab === 'upnext' ? 'active' : ''}`}
            onClick={() => setTab('upnext')}
          >
            Up next ({upcoming.length + (currentTrack ? 1 : 0)})
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

        <div className="modal-body">
          {tab === 'upnext' ? (
            <>
              <div style={{ padding: '16px 16px 8px' }}>
                <div className="queue-section-label">Now playing</div>
                {currentTrack ? (
                  <div
                    className="song-row active"
                    style={{ borderRadius: 12, background: 'var(--primary-container)' }}
                  >
                    <div className="song-art">
                      <Icons.music size={18} />
                    </div>
                    <div className="song-text">
                      <div className="song-title">{currentTrack.title}</div>
                      <div className="song-sub">{currentTrack.artist}</div>
                    </div>
                  </div>
                ) : (
                  <div className="empty">Nothing playing</div>
                )}
              </div>

              <div className="queue-section-label" style={{ padding: '16px 16px 8px' }}>
                Next in queue
                {upcoming.length > 0 ? (
                  <span className="queue-hint"> Drag or use arrows to reorder</span>
                ) : null}
              </div>

              {upcoming.length === 0 ? (
                <div className="empty">No upcoming tracks</div>
              ) : (
                upcoming.map((item, visualIndex) => {
                  const canMoveUp = visualIndex > 0;
                  const canMoveDown = visualIndex < upcoming.length - 1;
                  return (
                    <div
                      className={`song-row queue-row ${dragFrom === item.queueIndex ? 'dragging' : ''}`}
                      key={`${item.queueIndex}-${item.track.id}`}
                      draggable
                      onDragStart={() => setDragFrom(item.queueIndex)}
                      onDragEnd={() => setDragFrom(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom == null || dragFrom === item.queueIndex) return;
                        void move(dragFrom, item.queueIndex).then(() => setDragFrom(null));
                      }}
                    >
                      <span className="queue-grip" aria-hidden title="Drag to reorder">
                        <Icons.grip size={16} />
                      </span>
                      <button
                        type="button"
                        className="song-text"
                        style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                        onClick={() => {
                          void audioPlayer.skipToIndex(item.queueIndex);
                        }}
                      >
                        <div className="song-art">
                          <Icons.music size={18} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="song-title">{item.track.title}</div>
                          <div className="song-sub">{item.track.artist}</div>
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
                            void move(item.queueIndex, item.queueIndex - 1);
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
                            void move(item.queueIndex, item.queueIndex + 1);
                          }}
                        >
                          <Icons.chevronDown size={18} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Remove from queue"
                        onClick={() => {
                          void audioPlayer.removeAt(item.queueIndex);
                        }}
                      >
                        <Icons.close size={18} />
                      </button>
                    </div>
                  );
                })
              )}
            </>
          ) : previous.length === 0 ? (
            <div className="empty">
              <h3>No history yet</h3>
              <p>Skip back while playing to build history</p>
            </div>
          ) : (
            previous.map((item) => (
              <div className="song-row" key={`h-${item.queueIndex}-${item.track.id}`}>
                <div className="song-art">
                  <Icons.music size={16} />
                </div>
                <div className="song-text" style={{ minWidth: 0, flex: 1 }}>
                  <div className="song-title">{item.track.title}</div>
                  <div className="song-sub">{item.track.artist}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Add to queue"
                  aria-label="Add to queue"
                  onClick={() => {
                    void audioPlayer.addToQueue(item.track);
                  }}
                >
                  <Icons.list size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Play next"
                  aria-label="Play next"
                  onClick={() => {
                    void audioPlayer.playNext(item.track).then(() => setTab('upnext'));
                  }}
                >
                  <Icons.play size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
