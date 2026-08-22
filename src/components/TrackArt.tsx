import { Icons } from './Icons';

interface TrackArtProps {
  artwork?: string | null;
  title?: string;
  className?: string;
  iconSize?: number;
  onArtError?: () => void;
}

export default function TrackArt({
  artwork,
  title,
  className = 'song-art',
  iconSize = 18,
  onArtError,
}: TrackArtProps) {
  if (artwork) {
    return (
      <div className={className}>
        <img
          src={artwork}
          alt={title ? `${title} cover` : ''}
          loading="lazy"
          onError={onArtError}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <Icons.music size={iconSize} />
    </div>
  );
}
