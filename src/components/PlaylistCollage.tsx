import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import {
  getCachedArtworkUrls,
  subscribeArtwork,
} from '../utils/artwork';

const ROTATE_MS = 15 * 60 * 1000;

interface PlaylistCollageProps {
  songIds: string[];
  /** When false, pause the 15‑minute rotation (other tab / background). */
  active: boolean;
  className?: string;
}

function pickFour(urls: string[]): string[] {
  if (urls.length === 0) return [];
  if (urls.length >= 4) return urls.slice(0, 4);
  const out = [...urls];
  while (out.length < 4) out.push(urls[out.length % urls.length]);
  return out;
}

export default function PlaylistCollage({
  songIds,
  active,
  className = 'hero-art',
}: PlaylistCollageProps) {
  const songIdsKey = useMemo(() => songIds.join(','), [songIds]);
  const [tiles, setTiles] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const ids = songIdsKey ? songIdsKey.split(',') : [];
    if (ids.length === 0) {
      setTiles([]);
      return;
    }
    const urls = await getCachedArtworkUrls(ids, 4);
    setTiles(pickFour(urls));
  }, [songIdsKey]);

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
        <img key={`${src}-${i}`} src={src} alt="" />
      ))}
    </div>
  );
}
