import { getFreshAccessToken } from '../api/auth';
import { useStore } from '../store/useStore';
import type { PlayerTrack, RepeatModeSetting } from '../types';
import { shuffleQueue } from '../utils/playerQueue';
import { ensureArtwork } from '../utils/artwork';

type Listener = () => void;

const PREFETCH_AHEAD = 2;
const CACHE_LIMIT = 12;
/** Start playback once this many bytes are buffered (first play feels much faster). */
const EARLY_PLAY_BYTES = 256 * 1024;
/** Give up on a hung load so the UI doesn't spin forever. */
const LOAD_TIMEOUT_MS = 45_000;

class WebAudioPlayer {
  private audio = new Audio();
  private blobCache = new Map<string, string>();
  private inFlight = new Map<string, Promise<string>>();
  private prefetching = new Set<string>();
  private queue: PlayerTrack[] = [];
  private index = 0;
  private listeners = new Set<Listener>();
  private progressTimer: number | null = null;
  /** Monotonic id so only the latest loadAndPlay applies audio. */
  private loadGeneration = 0;
  /** Track id whose blob is currently assigned to <audio> (never revoke while active). */
  private activeBlobTrackId: string | null = null;
  private playLock: Promise<void> = Promise.resolve();

  constructor() {
    this.audio.preload = 'auto';
    this.setupMediaSession();

    this.audio.addEventListener('play', () => {
      useStore.getState().setPlaying(true);
      useStore.getState().setBuffering(false);
      this.setMediaPlaybackState('playing');
      this.startProgressLoop();
      this.emit();
    });

    this.audio.addEventListener('pause', () => {
      useStore.getState().setPlaying(false);
      this.setMediaPlaybackState('paused');
      this.stopProgressLoop();
      this.emit();
    });

    this.audio.addEventListener('waiting', () => {
      useStore.getState().setBuffering(true);
      this.emit();
    });

    this.audio.addEventListener('playing', () => {
      useStore.getState().setBuffering(false);
      useStore.getState().setPlaying(true);
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
      const badId = this.activeBlobTrackId;
      this.activeBlobTrackId = null;
      if (badId) {
        const url = this.blobCache.get(badId);
        if (url) {
          URL.revokeObjectURL(url);
          this.blobCache.delete(badId);
        }
      }
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
      this.updateMediaPositionState();
    }, 250);
  }

  private stopProgressLoop() {
    if (this.progressTimer != null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /** True when <audio> has a real blob/http src (not the page URL after clear). */
  private hasPlayableSrc(): boolean {
    const attr = this.audio.getAttribute('src');
    if (!attr) return false;
    return (
      attr.startsWith('blob:') ||
      attr.startsWith('http://') ||
      attr.startsWith('https://')
    );
  }

  private setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    const bind = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* older browsers may reject some actions */
      }
    };

    bind('play', () => {
      void this.play();
    });
    bind('pause', () => {
      this.pause();
    });
    bind('stop', () => {
      this.pause();
      void this.seekTo(0);
    });
    bind('previoustrack', () => {
      void this.skipToPrevious();
    });
    bind('nexttrack', () => {
      void this.skipToNext();
    });
    bind('seekbackward', (details) => {
      const offset = details.seekOffset ?? 10;
      void this.seekTo(Math.max(0, this.audio.currentTime - offset));
    });
    bind('seekforward', (details) => {
      const offset = details.seekOffset ?? 10;
      const dur = this.audio.duration || 0;
      void this.seekTo(
        Math.min(dur || Number.MAX_SAFE_INTEGER, this.audio.currentTime + offset)
      );
    });
    bind('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        void this.seekTo(details.seekTime);
      }
    });
  }

  private setMediaPlaybackState(state: MediaSessionPlaybackState) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      /* ignore */
    }
  }

  private updateMediaSessionMetadata(track: PlayerTrack) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    try {
      const metadata: MediaMetadataInit = {
        title: track.title || 'Unknown track',
        artist: track.artist || 'MyCloudPlayer',
        album: 'MyCloudPlayer',
      };
      if (track.artwork) {
        metadata.artwork = [
          { src: track.artwork, sizes: '512x512', type: 'image/jpeg' },
        ];
      }
      navigator.mediaSession.metadata = new MediaMetadata(metadata);
    } catch {
      /* ignore */
    }
  }

  private updateMediaPositionState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const duration = this.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.audio.playbackRate || 1,
        position: Math.min(this.audio.currentTime || 0, duration),
      });
    } catch {
      /* ignore */
    }
  }

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

  warmTrack(track: PlayerTrack): void {
    this.prefetchArtwork(track);
    if (this.blobCache.has(track.id) || this.inFlight.has(track.id)) return;
    void this.fetchBlobUrl(track).catch(() => {
      /* warm failures are non-fatal */
    });
  }

  warmTracks(tracks: PlayerTrack[]): void {
    for (const track of tracks.slice(0, 3)) {
      this.warmTrack(track);
    }
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

    if (sameQueue && useStore.getState().isPlaying && this.hasPlayableSrc()) {
      this.pause();
      return;
    }

    this.queue = tracks;
    this.index = Math.min(Math.max(0, startIndex), tracks.length - 1);
    useStore
      .getState()
      .setPlaybackSession(tracks, this.index, tracks[this.index]);
    this.prefetchAround(this.index);
    await this.loadAndPlay(this.index);
  }

  /** Safe play: recover from dead/revoked blob src by reloading the track. */
  async play(): Promise<void> {
    this.ensureQueueHydrated();
    const track = this.getActiveTrack();
    if (!track) return;

    if (!this.hasPlayableSrc() || this.audio.error) {
      await this.loadAndPlay(this.index, { forceReload: true });
      return;
    }

    try {
      useStore.getState().setBuffering(true);
      await this.audio.play();
      useStore.getState().setBuffering(false);
    } catch {
      // Revoked blob, network glitch, or NotAllowed — force a clean reload once
      await this.loadAndPlay(this.index, { forceReload: true });
    }
  }

  pause(): void {
    this.audio.pause();
  }

  async togglePlayPause(): Promise<void> {
    // Serialize rapid clicks so we don't start overlapping loads
    this.playLock = this.playLock
      .then(async () => {
        this.ensureQueueHydrated();
        if (this.audio.paused || !this.hasPlayableSrc() || this.audio.error) {
          await this.play();
        } else {
          this.pause();
        }
      })
      .catch(() => {
        useStore.getState().setBuffering(false);
        useStore.getState().setPlaying(false);
      });
    await this.playLock;
  }

  async seekTo(seconds: number): Promise<void> {
    if (!this.hasPlayableSrc()) return;
    try {
      this.audio.currentTime = Math.max(0, seconds);
      useStore
        .getState()
        .setProgress(this.audio.currentTime, this.audio.duration || 0);
    } catch {
      /* ignore */
    }
  }

  async skipToNext(): Promise<void> {
    if (!this.ensureQueueHydrated()) return;
    const next = this.index + 1;
    if (next >= this.queue.length) {
      await this.wrapQueueAndContinue();
      return;
    }
    await this.loadAndPlay(next);
  }

  async skipToPrevious(): Promise<void> {
    if (!this.ensureQueueHydrated()) return;
    if (this.hasPlayableSrc() && this.audio.currentTime > 3) {
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

  async addToQueue(track: PlayerTrack): Promise<void> {
    this.ensureQueueHydrated();
    if (this.queue.length === 0) {
      await this.playQueue([track], 0, { forceRestart: true });
      return;
    }
    const insertAt = this.index + 1;
    const next = [...this.queue];
    next.splice(insertAt, 0, track);
    this.queue = next;
    useStore
      .getState()
      .setPlaybackSession(this.queue, this.index, this.queue[this.index]);
    this.prefetchAround(this.index);
  }

  async playNext(track: PlayerTrack): Promise<void> {
    this.ensureQueueHydrated();
    if (this.queue.length === 0) {
      await this.playQueue([track], 0, { forceRestart: true });
      return;
    }
    const insertAt = this.index + 1;
    const next = [...this.queue];
    next.splice(insertAt, 0, track);
    this.queue = next;
    useStore.getState().setPlaybackSession(this.queue, this.index, this.queue[this.index]);
    await this.loadAndPlay(insertAt);
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
      await this.loadAndPlay(this.index, { forceReload: true });
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

  private clearAudioElement(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.activeBlobTrackId = null;
    this.stopProgressLoop();
  }

  private stopAudioHard(): void {
    this.loadGeneration += 1;
    this.clearAudioElement();
  }

  private dropCachedBlob(trackId: string) {
    const url = this.blobCache.get(trackId);
    if (!url) return;
    // Never revoke while still assigned to the element
    if (this.activeBlobTrackId === trackId) return;
    URL.revokeObjectURL(url);
    this.blobCache.delete(trackId);
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
    // End of queue: keep playing forever with the same song count.
    // Shuffle on → fresh reshuffle; shuffle off → restart current order.
    await this.wrapQueueAndContinue();
  }

  /**
   * Start another lap of the current queue without growing it.
   * With shuffle, builds a new random order so each cycle feels fresh.
   */
  private async wrapQueueAndContinue(): Promise<void> {
    if (this.queue.length === 0) return;

    const shuffleOn = useStore.getState().shuffleEnabled;
    if (shuffleOn && this.queue.length > 1) {
      const justEndedId = this.queue[this.index]?.id;
      let nextQueue = shuffleQueue(this.queue);

      // Prefer not starting the new lap on the song that just finished.
      if (nextQueue[0]?.id === justEndedId) {
        nextQueue = shuffleQueue(this.queue);
        if (nextQueue[0]?.id === justEndedId && nextQueue.length > 1) {
          const swapWith = 1 + Math.floor(Math.random() * (nextQueue.length - 1));
          [nextQueue[0], nextQueue[swapWith]] = [
            nextQueue[swapWith],
            nextQueue[0],
          ];
        }
      }

      this.queue = nextQueue;
      this.index = 0;
      useStore
        .getState()
        .setPlaybackSession(this.queue, 0, this.queue[0]);
      this.emit();
      await this.loadAndPlay(0);
      return;
    }

    await this.loadAndPlay(0);
  }

  private keepIds(): Set<string> {
    const keep = new Set<string>();
    if (this.activeBlobTrackId) keep.add(this.activeBlobTrackId);
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
        victim = this.blobCache.keys().next().value;
        if (victim && keep.has(victim) && this.blobCache.size <= keep.size) break;
      }
      if (!victim) break;
      if (victim === this.activeBlobTrackId) {
        // Skip active; try next round
        const keys = [...this.blobCache.keys()].filter((k) => k !== victim);
        if (keys.length === 0) break;
        victim = keys[0];
        if (keep.has(victim)) break;
      }
      const url = this.blobCache.get(victim);
      if (url) URL.revokeObjectURL(url);
      this.blobCache.delete(victim);
    }
  }

  private async getAccessToken(track: PlayerTrack, force = false): Promise<string> {
    try {
      return await getFreshAccessToken({ force });
    } catch {
      if (force) throw new Error('Google session expired. Tap Reconnect to continue.');
      const fallback = track.headers?.Authorization?.replace(/^Bearer\s+/i, '');
      if (!fallback) throw new Error('Google session expired.');
      return fallback;
    }
  }

  /** Drive media fetch with one forced token refresh on 401. */
  private async fetchDriveMedia(
    track: PlayerTrack,
    forceToken = false
  ): Promise<Response> {
    const token = await this.getAccessToken(track, forceToken);
    const res = await fetch(track.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && !forceToken) {
      return this.fetchDriveMedia(track, true);
    }
    return res;
  }

  private storeBlobUrl(trackId: string, blob: Blob): string {
    const existing = this.blobCache.get(trackId);
    // Only revoke old URL if it's not currently playing
    if (existing && this.activeBlobTrackId !== trackId) {
      URL.revokeObjectURL(existing);
    }
    const objectUrl = URL.createObjectURL(blob);
    this.blobCache.set(trackId, objectUrl);
    this.trimCache();
    void this.cacheArtworkFromBlob(trackId, blob);
    return objectUrl;
  }

  private cacheArtworkFromBlob(trackId: string, blob: Blob): void {
    const track = this.queue.find((t) => t.id === trackId);
    const token = track?.headers?.Authorization?.replace(/^Bearer\s+/i, '');
    void ensureArtwork(trackId, token, blob).then((url) => {
      if (url) this.applyArtworkToTrack(trackId, url);
    });
  }

  private applyArtworkToTrack(trackId: string, artworkUrl: string): void {
    this.queue = this.queue.map((t) =>
      t.id === trackId ? { ...t, artwork: artworkUrl } : t
    );
    const { currentTrack, playbackIndex } = useStore.getState();
    useStore
      .getState()
      .setPlaybackSession(
        this.queue,
        playbackIndex,
        currentTrack?.id === trackId
          ? { ...currentTrack, artwork: artworkUrl }
          : currentTrack
      );
    if (currentTrack?.id === trackId) {
      this.updateMediaSessionMetadata({ ...currentTrack, artwork: artworkUrl });
      this.emit();
    }
  }

  private prefetchArtwork(track: PlayerTrack): void {
    const token = track.headers?.Authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return;
    void ensureArtwork(track.id, token).then((url) => {
      if (url) this.applyArtworkToTrack(track.id, url);
    });
  }

  private async assignAndPlay(
    trackId: string,
    url: string,
    generation: number
  ): Promise<void> {
    if (generation !== this.loadGeneration) return;
    this.audio.src = url;
    this.activeBlobTrackId = trackId;
    try {
      await this.audio.play();
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      throw err;
    }
  }

  private fetchBlobUrl(track: PlayerTrack): Promise<string> {
    const cached = this.blobCache.get(track.id);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(track.id);
    if (pending) return pending;

    const promise = (async () => {
      const res = await this.fetchDriveMedia(track);
      if (!res.ok) {
        throw new Error(`Stream failed (${res.status})`);
      }
      const blob = await res.blob();
      const existing = this.blobCache.get(track.id);
      if (existing) return existing;
      return this.storeBlobUrl(track.id, blob);
    })().finally(() => {
      this.inFlight.delete(track.id);
    });

    this.inFlight.set(track.id, promise);
    return promise;
  }

  private async loadTrackProgressive(
    track: PlayerTrack,
    generation: number
  ): Promise<void> {
    const cached = this.blobCache.get(track.id);
    if (cached) {
      await this.assignAndPlay(track.id, cached, generation);
      return;
    }

    const pending = this.inFlight.get(track.id);
    if (pending) {
      try {
        const url = await pending;
        if (generation !== this.loadGeneration) return;
        await this.assignAndPlay(track.id, url, generation);
        return;
      } catch {
        // Prefetch failed — fall through to a fresh download
      }
    }

    if (generation !== this.loadGeneration) return;

    const res = await this.fetchDriveMedia(track);
    if (!res.ok) {
      throw new Error(`Stream failed (${res.status})`);
    }
    if (generation !== this.loadGeneration) return;

    const mime = res.headers.get('content-type') || 'audio/mpeg';
    const reader = res.body?.getReader();

    if (!reader) {
      const blob = await res.blob();
      if (generation !== this.loadGeneration) return;
      const url = this.storeBlobUrl(track.id, blob);
      await this.assignAndPlay(track.id, url, generation);
      return;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    let started = false;
    let earlyUrl: string | null = null;

    const finishPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (generation !== this.loadGeneration) {
            await reader.cancel().catch(() => undefined);
            break;
          }
          chunks.push(value);
          received += value.byteLength;

          if (!started && received >= EARLY_PLAY_BYTES) {
            const partial = new Blob(chunks as BlobPart[], { type: mime });
            earlyUrl = URL.createObjectURL(partial);
            await this.assignAndPlay(track.id, earlyUrl, generation);
            started = true;
            useStore.getState().setBuffering(false);
          }
        }

        if (generation !== this.loadGeneration) {
          if (earlyUrl && this.audio.getAttribute('src') !== earlyUrl) {
            URL.revokeObjectURL(earlyUrl);
          }
          throw new Error('aborted');
        }

        const fullBlob = new Blob(chunks as BlobPart[], { type: mime });
        const fullUrl = this.storeBlobUrl(track.id, fullBlob);

        if (started && earlyUrl) {
          const t = this.audio.currentTime || 0;
          const wasPaused = this.audio.paused;
          this.audio.src = fullUrl;
          this.activeBlobTrackId = track.id;
          await new Promise<void>((resolve) => {
            const onMeta = () => {
              this.audio.removeEventListener('loadedmetadata', onMeta);
              resolve();
            };
            this.audio.addEventListener('loadedmetadata', onMeta);
            // Fallback if metadata already ready or never fires
            window.setTimeout(resolve, 800);
          });
          try {
            this.audio.currentTime = t;
          } catch {
            /* ignore */
          }
          if (!wasPaused && generation === this.loadGeneration) {
            await this.audio.play().catch(() => undefined);
          }
          URL.revokeObjectURL(earlyUrl);
        } else {
          await this.assignAndPlay(track.id, fullUrl, generation);
        }

        return fullUrl;
      } finally {
        this.inFlight.delete(track.id);
      }
    })();

    this.inFlight.set(track.id, finishPromise);
    await finishPromise;
  }

  private prefetchAround(centerIndex: number) {
    const targets: PlayerTrack[] = [];
    for (let offset = 1; offset <= PREFETCH_AHEAD; offset++) {
      const next = this.queue[centerIndex + offset];
      if (next) targets.push(next);
    }
    const prev = this.queue[centerIndex - 1];
    if (prev) targets.push(prev);

    for (const track of targets) {
      this.prefetchArtwork(track);
      if (
        this.blobCache.has(track.id) ||
        this.inFlight.has(track.id) ||
        this.prefetching.has(track.id)
      ) {
        continue;
      }
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

  private async loadAndPlay(
    index: number,
    options?: { forceReload?: boolean }
  ): Promise<void> {
    const track = this.queue[index];
    if (!track) return;

    const generation = ++this.loadGeneration;
    this.index = index;

    if (options?.forceReload) {
      if (this.activeBlobTrackId === track.id) {
        this.clearAudioElement();
      }
      const stale = this.blobCache.get(track.id);
      if (stale) {
        URL.revokeObjectURL(stale);
        this.blobCache.delete(track.id);
      }
      this.inFlight.delete(track.id);
    }

    const cached = this.blobCache.get(track.id);
    const wasCached = Boolean(cached);

    this.audio.pause();
    this.stopProgressLoop();
    useStore.getState().setProgress(0, 0);
    useStore.getState().setPlaying(false);
    useStore.getState().setBuffering(!wasCached);
    useStore.getState().setPlaybackSession(this.queue, index, track);
    useStore.getState().setCurrentTrack(track);
    this.updateMediaSessionMetadata(track);
    this.emit();

    this.prefetchArtwork(track);
    this.prefetchAround(index);

    const timeout = window.setTimeout(() => {
      if (generation !== this.loadGeneration) return;
      if (!useStore.getState().isPlaying) {
        useStore.getState().setBuffering(false);
        this.emit();
      }
    }, LOAD_TIMEOUT_MS);

    try {
      if (wasCached && cached) {
        await this.assignAndPlay(track.id, cached, generation);
      } else {
        await this.loadTrackProgressive(track, generation);
      }
      if (generation !== this.loadGeneration) {
        this.audio.pause();
        return;
      }
      useStore.getState().setBuffering(false);
      this.prefetchAround(index);
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      if (err instanceof Error && err.message === 'aborted') return;
      this.dropCachedBlob(track.id);
      this.clearAudioElement();
      useStore.getState().setBuffering(false);
      useStore.getState().setPlaying(false);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('session expired')) {
        useStore.getState().setSessionExpired(true);
      }
      this.emit();
      throw err;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export const audioPlayer = new WebAudioPlayer();
