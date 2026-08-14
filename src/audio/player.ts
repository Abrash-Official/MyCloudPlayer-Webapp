import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import type { PlayerTrack, RepeatModeSetting } from '../types';

type Listener = () => void;

class WebAudioPlayer {
  private audio = new Audio();
  private blobCache = new Map<string, string>();
  private queue: PlayerTrack[] = [];
  private index = 0;
  private listeners = new Set<Listener>();
  private progressTimer: number | null = null;

  constructor() {
    this.audio.preload = 'auto';

    this.audio.addEventListener('play', () => {
      useStore.getState().setPlaying(true);
      useStore.getState().setBuffering(false);
      this.startProgressLoop();
      this.emit();
    });

    this.audio.addEventListener('pause', () => {
      useStore.getState().setPlaying(false);
      this.stopProgressLoop();
      this.emit();
    });

    this.audio.addEventListener('waiting', () => {
      useStore.getState().setBuffering(true);
      this.emit();
    });

    this.audio.addEventListener('canplay', () => {
      useStore.getState().setBuffering(false);
      this.emit();
    });

    this.audio.addEventListener('ended', () => {
      void this.handleEnded();
    });

    this.audio.addEventListener('error', () => {
      useStore.getState().setBuffering(false);
      useStore.getState().setPlaying(false);
      this.emit();
    });

    this.audio.addEventListener('timeupdate', () => {
      useStore
        .getState()
        .setProgress(this.audio.currentTime || 0, this.audio.duration || 0);
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private startProgressLoop() {
    this.stopProgressLoop();
    this.progressTimer = window.setInterval(() => {
      useStore
        .getState()
        .setProgress(this.audio.currentTime || 0, this.audio.duration || 0);
    }, 250);
  }

  private stopProgressLoop() {
    if (this.progressTimer != null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  getQueue() {
    return this.queue;
  }

  getIndex() {
    return this.index;
  }

  getActiveTrack(): PlayerTrack | null {
    return this.queue[this.index] ?? null;
  }

  async playQueue(
    tracks: PlayerTrack[],
    startIndex = 0,
    options?: { forceRestart?: boolean }
  ): Promise<void> {
    if (tracks.length === 0) return;

    const sameQueue =
      !options?.forceRestart &&
      this.queue.length === tracks.length &&
      this.queue.every((t, i) => t.id === tracks[i].id);

    if (sameQueue && useStore.getState().isPlaying) {
      this.pause();
      return;
    }

    this.queue = tracks;
    this.index = Math.min(Math.max(0, startIndex), tracks.length - 1);
    useStore
      .getState()
      .setPlaybackSession(tracks, this.index, tracks[this.index]);
    await this.loadAndPlay(this.index);
  }

  async play(): Promise<void> {
    if (!this.audio.src) {
      const track = this.getActiveTrack();
      if (track) {
        await this.loadAndPlay(this.index);
        return;
      }
      return;
    }
    try {
      await this.audio.play();
    } catch {
      /* autoplay blocked — user gesture required */
    }
  }

  pause(): void {
    this.audio.pause();
  }

  async togglePlayPause(): Promise<void> {
    if (this.audio.paused) {
      await this.play();
    } else {
      this.pause();
    }
  }

  async seekTo(seconds: number): Promise<void> {
    this.audio.currentTime = Math.max(0, seconds);
    useStore
      .getState()
      .setProgress(this.audio.currentTime, this.audio.duration || 0);
  }

  async skipToNext(): Promise<void> {
    if (this.queue.length === 0) return;
    const next = this.index + 1;
    if (next >= this.queue.length) {
      const repeat = useStore.getState().repeatMode;
      if (repeat === 'all') {
        await this.loadAndPlay(0);
      }
      return;
    }
    await this.loadAndPlay(next);
  }

  async skipToPrevious(): Promise<void> {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      await this.seekTo(0);
      return;
    }
    if (this.index <= 0) {
      await this.seekTo(0);
      return;
    }
    await this.loadAndPlay(this.index - 1);
  }

  async skipToIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;
    await this.loadAndPlay(index);
  }

  async removeAt(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;
    const wasActive = index === this.index;
    this.queue = this.queue.filter((_, i) => i !== index);
    if (this.index > index) this.index -= 1;
    if (this.index >= this.queue.length) {
      this.index = Math.max(0, this.queue.length - 1);
    }
    useStore
      .getState()
      .setPlaybackSession(
        this.queue,
        this.index,
        this.queue[this.index] ?? null
      );
    if (wasActive && this.queue.length > 0) {
      await this.loadAndPlay(this.index);
    } else if (this.queue.length === 0) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      useStore.getState().setCurrentTrack(null);
      useStore.getState().setPlaying(false);
    }
  }

  async moveTrack(from: number, to: number): Promise<void> {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= this.queue.length ||
      to >= this.queue.length
    ) {
      return;
    }
    const next = [...this.queue];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const activeId = this.queue[this.index]?.id;
    this.queue = next;
    this.index = Math.max(
      0,
      next.findIndex((t) => t.id === activeId)
    );
    useStore
      .getState()
      .setPlaybackSession(this.queue, this.index, this.queue[this.index]);
  }

  private async handleEnded(): Promise<void> {
    const repeat: RepeatModeSetting = useStore.getState().repeatMode;
    if (repeat === 'one') {
      await this.seekTo(0);
      await this.play();
      return;
    }
    if (this.index < this.queue.length - 1) {
      await this.skipToNext();
      return;
    }
    if (repeat === 'all') {
      await this.loadAndPlay(0);
      return;
    }
    useStore.getState().setPlaying(false);
    await this.seekTo(0);
  }

  private async resolvePlayableUrl(track: PlayerTrack): Promise<string> {
    const cached = this.blobCache.get(track.id);
    if (cached) return cached;

    let token = track.headers?.Authorization?.replace(/^Bearer\s+/i, '');
    try {
      token = await getFreshAccessToken();
      useStore.getState().updateAccessToken(token);
    } catch {
      if (!token) throw new Error('Google session expired.');
    }

    const res = await fetch(track.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Stream failed (${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    this.blobCache.set(track.id, objectUrl);

    // Cap cache size
    if (this.blobCache.size > 8) {
      const first = this.blobCache.keys().next().value;
      if (first && first !== track.id) {
        const old = this.blobCache.get(first);
        if (old) URL.revokeObjectURL(old);
        this.blobCache.delete(first);
      }
    }

    return objectUrl;
  }

  private async loadAndPlay(index: number): Promise<void> {
    const track = this.queue[index];
    if (!track) return;

    this.index = index;
    useStore.getState().setBuffering(true);
    useStore.getState().setPlaybackSession(this.queue, index, track);
    useStore.getState().setCurrentTrack(track);
    this.emit();

    try {
      const url = await this.resolvePlayableUrl(track);
      this.audio.src = url;
      await this.audio.play();
    } catch (err) {
      useStore.getState().setBuffering(false);
      useStore.getState().setPlaying(false);
      this.emit();
      throw err;
    }
  }
}

export const audioPlayer = new WebAudioPlayer();
