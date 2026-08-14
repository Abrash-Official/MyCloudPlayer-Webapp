import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import type { PlayerTrack, RepeatModeSetting } from '../types';

type Listener = () => void;

const PREFETCH_AHEAD = 2;
const CACHE_LIMIT = 12;

class WebAudioPlayer {
  private audio = new Audio();
  private blobCache = new Map<string, string>();
  private prefetching = new Set<string>();
  private queue: PlayerTrack[] = [];
  private index = 0;
  private listeners = new Set<Listener>();
  private progressTimer: number | null = null;
  /** Monotonic id so only the latest loadAndPlay applies audio. */
  private loadGeneration = 0;

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

  /**
   * After a page reload the store may still have a queue while this
   * in-memory player is empty — hydrate so skip/play keep working.
   */
  ensureQueueHydrated(): boolean {
    if (this.queue.length > 0) return true;
    const { playbackQueue, playbackIndex, currentTrack } = useStore.getState();
    if (playbackQueue.length === 0) return false;
    this.queue = playbackQueue;
    const byId = currentTrack
      ? playbackQueue.findIndex((t) => t.id === currentTrack.id)
      : -1;
    this.index =
      byId >= 0
        ? byId
        : Math.min(Math.max(0, playbackIndex), playbackQueue.length - 1);
    return true;
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
    // Warm the first upcoming tracks while current starts
    this.prefetchAround(this.index);
    await this.loadAndPlay(this.index);
  }

  async play(): Promise<void> {
    this.ensureQueueHydrated();
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
    this.ensureQueueHydrated();
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
    if (!this.ensureQueueHydrated()) return;
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
    if (!this.ensureQueueHydrated()) return;
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
    if (!this.ensureQueueHydrated()) return;
    if (index < 0 || index >= this.queue.length) return;
    await this.loadAndPlay(index);
  }

  async removeAt(index: number): Promise<void> {
    this.ensureQueueHydrated();
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
      this.stopAudioHard();
      useStore.getState().setCurrentTrack(null);
      useStore.getState().setPlaying(false);
    } else {
      this.prefetchAround(this.index);
    }
  }

  async moveTrack(from: number, to: number): Promise<void> {
    this.ensureQueueHydrated();
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
    this.prefetchAround(this.index);
  }

  private stopAudioHard(): void {
    this.loadGeneration += 1;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.stopProgressLoop();
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

  private keepIds(): Set<string> {
    const keep = new Set<string>();
    for (
      let i = Math.max(0, this.index - 1);
      i <= Math.min(this.queue.length - 1, this.index + PREFETCH_AHEAD);
      i++
    ) {
      const id = this.queue[i]?.id;
      if (id) keep.add(id);
    }
    return keep;
  }

  private trimCache() {
    const keep = this.keepIds();
    while (this.blobCache.size > CACHE_LIMIT) {
      let victim: string | undefined;
      for (const id of this.blobCache.keys()) {
        if (!keep.has(id)) {
          victim = id;
          break;
        }
      }
      if (!victim) {
        // All cached ids are nearby — drop oldest insertion order outside keep if possible
        victim = this.blobCache.keys().next().value;
        if (victim && keep.has(victim) && this.blobCache.size <= keep.size) break;
      }
      if (!victim) break;
      const url = this.blobCache.get(victim);
      if (url) URL.revokeObjectURL(url);
      this.blobCache.delete(victim);
    }
  }

  private async fetchBlobUrl(track: PlayerTrack): Promise<string> {
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
    const existing = this.blobCache.get(track.id);
    if (existing) return existing;

    const objectUrl = URL.createObjectURL(blob);
    this.blobCache.set(track.id, objectUrl);
    this.trimCache();
    return objectUrl;
  }

  /** Background-warm upcoming (and previous) tracks like Spotify. */
  private prefetchAround(centerIndex: number) {
    const targets: PlayerTrack[] = [];
    for (let offset = 1; offset <= PREFETCH_AHEAD; offset++) {
      const next = this.queue[centerIndex + offset];
      if (next) targets.push(next);
    }
    const prev = this.queue[centerIndex - 1];
    if (prev) targets.push(prev);

    for (const track of targets) {
      if (this.blobCache.has(track.id) || this.prefetching.has(track.id)) continue;
      this.prefetching.add(track.id);
      void this.fetchBlobUrl(track)
        .catch(() => {
          /* prefetch failures are non-fatal */
        })
        .finally(() => {
          this.prefetching.delete(track.id);
        });
    }
  }

  private async resolvePlayableUrl(
    track: PlayerTrack,
    generation: number
  ): Promise<string | null> {
    const cached = this.blobCache.get(track.id);
    if (cached) return cached;

    const url = await this.fetchBlobUrl(track);
    if (generation !== this.loadGeneration) return null;
    return url;
  }

  private async loadAndPlay(index: number): Promise<void> {
    const track = this.queue[index];
    if (!track) return;

    const generation = ++this.loadGeneration;
    this.index = index;

    const cached = this.blobCache.get(track.id);
    const wasCached = Boolean(cached);

    this.audio.pause();
    this.stopProgressLoop();
    useStore.getState().setProgress(0, 0);
    useStore.getState().setPlaying(false);
    // Only show buffering UI when we still need to download
    useStore.getState().setBuffering(!wasCached);
    useStore.getState().setPlaybackSession(this.queue, index, track);
    useStore.getState().setCurrentTrack(track);
    this.emit();

    // Start warming neighbors as soon as we commit to this track
    this.prefetchAround(index);

    try {
      const url = wasCached
        ? cached!
        : await this.resolvePlayableUrl(track, generation);
      if (generation !== this.loadGeneration || !url) return;

      this.audio.src = url;
      await this.audio.play();
      if (generation !== this.loadGeneration) {
        this.audio.pause();
        return;
      }
      useStore.getState().setBuffering(false);
      // Keep prefetching while this track plays
      this.prefetchAround(index);
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      useStore.getState().setBuffering(false);
      useStore.getState().setPlaying(false);
      this.emit();
      throw err;
    }
  }
}

export const audioPlayer = new WebAudioPlayer();
