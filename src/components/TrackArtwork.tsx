import TrackArt from './TrackArt';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { getFreshAccessToken } from '../api/auth';
import { ensureArtwork, invalidateArtwork } from '../utils/artwork';

interface TrackArtworkProps {
  trackId: string;
  title?: string;
  className?: string;
  iconSize?: number;
}

export default function TrackArtwork({
  trackId,
  title,
  className,
  iconSize,
}: TrackArtworkProps) {
  const artwork = useTrackArtwork(trackId);

  const retryArtwork = () => {
    invalidateArtwork(trackId);
    void getFreshAccessToken()
      .then((token) => ensureArtwork(trackId, token))
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
