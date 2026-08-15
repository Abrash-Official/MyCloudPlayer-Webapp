import { useEffect } from 'react';
import { audioPlayer } from '../audio/player';
import { useStore } from '../store/useStore';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * Space = play/pause (without activating focused buttons).
 * Media Session for headset / OS / Bluetooth next-prev-pause is wired in audioPlayer.
 */
export function usePlaybackControls(enabled: boolean) {
  const hasTrack = useStore((s) => Boolean(s.currentTrack));

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space' || e.key === ' ') {
        if (!hasTrack && useStore.getState().playbackQueue.length === 0) return;
        e.preventDefault();
        // Avoid Space activating a focused button (play FAB, song row, etc.)
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        void audioPlayer.togglePlayPause();
        return;
      }

      if (e.code === 'MediaPlayPause') {
        e.preventDefault();
        void audioPlayer.togglePlayPause();
        return;
      }
      if (e.code === 'MediaTrackNext') {
        e.preventDefault();
        void audioPlayer.skipToNext();
        return;
      }
      if (e.code === 'MediaTrackPrevious') {
        e.preventDefault();
        void audioPlayer.skipToPrevious();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled, hasTrack]);
}
