import { useEffect, useState } from 'react';
import { getFreshAccessToken } from '../api/auth';
import {
  ensureArtwork,
  getArtworkUrl,
  hydrateArtwork,
  subscribeArtwork,
  type ArtworkOptions,
} from '../utils/artwork';

type FetchMode = ArtworkOptions['mode'];

export function useTrackArtwork(
  trackId: string | undefined,
  options?: {
    mode?: FetchMode;
    thumbnailLink?: string;
  }
): string | undefined {
  const mode = options?.mode ?? 'none';
  const thumbnailLink = options?.thumbnailLink;

  const [url, setUrl] = useState<string | undefined>(() =>
    trackId ? getArtworkUrl(trackId) : undefined
  );

  useEffect(() => {
    if (!trackId) {
      setUrl(undefined);
      return;
    }

    const sync = () => setUrl(getArtworkUrl(trackId));
    sync();

    const unsub = subscribeArtwork(sync);

    void hydrateArtwork(trackId).then(() => sync());

    if (mode !== 'none') {
      void getFreshAccessToken()
        .then((token) =>
          ensureArtwork(trackId, {
            accessToken: token,
            thumbnailLink,
            mode,
          })
        )
        .then(() => sync())
        .catch(() => undefined);
    }

    return unsub;
  }, [trackId, mode, thumbnailLink]);

  return url;
}
