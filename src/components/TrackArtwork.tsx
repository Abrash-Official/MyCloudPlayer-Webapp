import TrackArt from './TrackArt';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { getFreshAccessToken } from '../api/auth';
import { ensureArtwork, invalidateArtwork } from '../utils/artwork';

interface TrackArtworkProps {
  trackId: string;
  title?: string;
  className?: string;
  iconSize?: number;
  /** Only set for the actively playing row in queue. */
  isPlaying?: boolean;
  thumbnailLink?: string;
}

export default function TrackArtwork({
  trackId,
  title,
  className,
  iconSize,
  isPlaying = false,
  thumbnailLink,
}: TrackArtworkProps) {
  const artwork = useTrackArtwork(trackId, {
    mode: isPlaying ? 'playing' : 'none',
    thumbnailLink,
  });

  const retryArtwork = () => {
    invalidateArtwork(trackId);
    void getFreshAccessToken()
      .then((token) =>
        ensureArtwork(trackId, {
          accessToken: token,
          thumbnailLink,
          mode: isPlaying ? 'playing' : 'thumbnail',
        })
      )
      .catch(() => undefined);
  };

  return (
    <TrackArt
      artwork={artwork}
      title={title}
      className={className}
      iconSize={iconSize}
      onArtError={artwork ? retryArtwork : undefined}
    />
  );
}
