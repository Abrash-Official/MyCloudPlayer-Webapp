import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import { getFreshAccessToken } from '../api/auth';
import {
  ensureArtwork,
  getCachedArtworkUrls,
  subscribeArtwork,
} from '../utils/artwork';
import type { LibraryItem } from '../types';

const ROTATE_MS = 15 * 60 * 1000;

interface PlaylistCollageProps {
  songs: LibraryItem[];
  /** When false, pause the 15‑minute rotation (other tab / background). */
  active: boolean;
  className?: string;
}

function uniqueUrls(urls: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

function padToFour(urls: string[]): string[] {
  if (urls.length === 0) return [];
  if (urls.length >= 4) return urls.slice(0, 4);
  const out = [...urls];
  while (out.length < 4) {
    out.push(urls[out.length % urls.length]);
  }
  return out;
}

function shuffleIds<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function PlaylistCollage({
  songs,
  active,
  className = 'hero-art',
}: PlaylistCollageProps) {
  const songKey = useMemo(() => songs.map((s) => s.id).join(','), [songs]);
  const [tiles, setTiles] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!songKey) {
      setTiles([]);
      return;
    }
    const list = songs;
    const ids = list.map((s) => s.id);

    // 1) Whatever is already cached
    let urls = uniqueUrls(await getCachedArtworkUrls(ids, 12), 4);

    // 2) If fewer than 4, lightly fetch Drive thumbnails for songs that have one
    if (urls.length < 4) {
      try {
        const token = await getFreshAccessToken();
        const candidates = shuffleIds(
          list.filter((s) => Boolean(s.thumbnailLink))
        ).slice(0, 8);

        for (const song of candidates) {
          if (urls.length >= 4) break;
          const url = await ensureArtwork(song.id, {
            accessToken: token,
            thumbnailLink: song.thumbnailLink,
            mode: 'thumbnail',
          });
          if (url && !urls.includes(url)) urls.push(url);
        }
      } catch {
        /* stay with cache-only tiles */
      }
    }

    urls = uniqueUrls(urls, 4);
    setTiles(padToFour(urls));
  }, [songKey, songs]);

  useEffect(() => {
    void refresh();
    return subscribeArtwork(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (!active) return;

    let timer: number | null = null;

    const clear = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      clear();
      if (document.visibilityState !== 'visible') return;
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refresh();
        }
      }, ROTATE_MS);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') start();
      else clear();
    };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, refresh]);

  if (tiles.length === 0) {
    return (
      <div className={className}>
        <Icons.music size={42} />
      </div>
    );
  }

  return (
    <div className={`${className} collage-art`} aria-hidden>
      {tiles.map((src, i) => (
        <div className="collage-cell" key={`tile-${i}-${src.slice(-12)}`}>
          <img src={src} alt="" />
        </div>
      ))}
    </div>
  );
}
