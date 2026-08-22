import TrackArt from './TrackArt';
import { useTrackArtwork } from '../hooks/useTrackArtwork';

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
  return (
    <TrackArt
      artwork={artwork}
      title={title}
      className={className}
      iconSize={iconSize}
    />
  );
}
