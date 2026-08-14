import { Link } from 'react-router-dom';
import { Icons } from './Icons';
import type { DriveFolder } from '../types';

interface PlaylistCardProps {
  playlist: DriveFolder;
  onDelete: () => void;
}

export default function PlaylistCard({ playlist, onDelete }: PlaylistCardProps) {
  return (
    <div className="playlist-row">
      <Link to={`/playlist/${playlist.id}`} className="playlist-art" state={{ folder: playlist }}>
        <Icons.albums size={24} />
      </Link>
      <Link
        to={`/playlist/${playlist.id}`}
        className="playlist-text"
        state={{ folder: playlist }}
      >
        <div className="playlist-name">{playlist.name}</div>
        <div className="playlist-meta">Playlist · Google Drive</div>
      </Link>
      <button
        type="button"
        className="icon-btn"
        aria-label="Delete playlist"
        onClick={() => {
          if (
            window.confirm(
              `Delete "${playlist.name}"?\nSongs inside will also be removed from Drive.`
            )
          ) {
            onDelete();
          }
        }}
      >
        <Icons.more size={18} />
      </button>
    </div>
  );
}
