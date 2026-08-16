import { audioPlayer } from '../audio/player';
import { useStore } from '../store/useStore';
import { shuffleQueue } from './playerQueue';
import type { PlayerTrack, RepeatModeSetting } from '../types';
import { getFreshAccessToken } from '../api/auth';
import { buildStreamUrl } from '../api/drive';

export type PlayQueueResult = 'playing' | 'paused' | 'restarted';

function refreshTrackTokens(
  tracks: PlayerTrack[],
  token: string
): PlayerTrack[] {
  return tracks.map((t) => ({
    ...t,
    url: buildStreamUrl(t.id),
    headers: { Authorization: `Bearer ${token}` },
  }));
}

export async function playQueue(
  tracks: PlayerTrack[],
  options: {
    repeatMode: RepeatModeSetting;
    forceRestart?: boolean;
    startIndex?: number;
  }
): Promise<PlayQueueResult> {
  if (tracks.length === 0) return 'paused';

  let token = useStore.getState().accessToken;
  try {
    token = await getFreshAccessToken();
  } catch {
    if (!token) throw new Error('Google Drive is not connected.');
  }

  const refreshed = refreshTrackTokens(tracks, token!);
  const startIndex = options.startIndex ?? 0;

  await audioPlayer.playQueue(refreshed, startIndex, {
    forceRestart: options.forceRestart,
  });

  return 'restarted';
}

export async function reshuffleActiveQueue(
  _repeatMode: RepeatModeSetting
): Promise<void> {
  const queue = audioPlayer.getQueue();
  const index = audioPlayer.getIndex();
  if (queue.length <= 1) return;

  const shuffled = shuffleQueue(queue, index);
  await playQueue(shuffled, {
    repeatMode: _repeatMode,
    forceRestart: true,
    startIndex: 0,
  });
}
