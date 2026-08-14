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
  const [, bump] = useState(0);

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

  const refresh = () => bump((n) => n + 1);

  return (
    <div className="modal-backdrop" onClick={() => setQueueOpen(false)}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button type="button" className="icon-btn" onClick={() => setQueueOpen(false)}>
            <Icons.chevronDown size={26} />
          </button>
          <h2>Queue</h2>
          <div style={{ width: 40 }} />
        </div>

        <div className="chips">
          <button
            type="button"
            className={`chip ${tab === 'upnext' ? 'active' : ''}`}
            onClick={() => setTab('upnext')}
          >
            Up next ({upcoming.length + (currentTrack ? 1 : 0)})
          </button>
          <button
            type="button"
            className={`chip ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            History ({previous.length})
          </button>
        </div>

        <div className="modal-body">
          {tab === 'upnext' ? (
            <>
              <div style={{ padding: '16px 16px 8px' }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  Now playing
                </div>
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

              <div
                style={{
                  padding: '16px 16px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                }}
              >
                Next in queue
              </div>

              {upcoming.length === 0 ? (
                <div className="empty">No upcoming tracks</div>
              ) : (
                upcoming.map((item) => (
                  <div className="song-row" key={`${item.queueIndex}-${item.track.id}`}>
                    <button
                      type="button"
                      className="song-text"
                      style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                      onClick={() => {
                        void audioPlayer.skipToIndex(item.queueIndex).then(refresh);
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
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        void audioPlayer.removeAt(item.queueIndex).then(refresh);
                      }}
                    >
                      <Icons.close size={18} />
                    </button>
                  </div>
                ))
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
                <button
                  type="button"
                  className="song-text"
                  style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                  onClick={() => {
                    void audioPlayer.skipToIndex(item.queueIndex).then(() => {
                      setTab('upnext');
                      refresh();
                    });
                  }}
                >
                  <div className="song-art">
                    <Icons.skipBack size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="song-title">{item.track.title}</div>
                    <div className="song-sub">{item.track.artist}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    void audioPlayer.skipToIndex(item.queueIndex).then(() => {
                      setTab('upnext');
                      refresh();
                    });
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
