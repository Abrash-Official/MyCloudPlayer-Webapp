import { useEffect, useState } from 'react';
import { getFreshAccessToken } from '../api/auth';
import {
  ensureArtwork,
  getArtworkUrl,
  subscribeArtwork,
} from '../utils/artwork';

export function useTrackArtwork(trackId: string | undefined): string | undefined {
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

    if (!getArtworkUrl(trackId)) {
      void getFreshAccessToken()
        .then((token) => ensureArtwork(trackId, token))
        .catch(() => undefined);
    }

    return unsub;
  }, [trackId]);

  return url;
}
