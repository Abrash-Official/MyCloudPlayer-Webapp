import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icons } from './Icons';
import ConfirmDialog from './ConfirmDialog';
import type { DriveFolder } from '../types';

interface PlaylistCardProps {
  playlist: DriveFolder;
  onDelete: () => void;
}

export default function PlaylistCard({ playlist, onDelete }: PlaylistCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        <div className="playlist-name" title={playlist.name}>
          {playlist.name}
        </div>
        <div className="playlist-meta">Playlist · Google Drive</div>
      </Link>
      <button
        type="button"
        className="icon-btn"
        aria-label="Delete playlist"
        onClick={() => setConfirmOpen(true)}
      >
        <Icons.more size={18} />
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete playlist?"
        message={`Delete “${playlist.name}”? Songs inside will also be removed from Drive.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete();
        }}
      />
    </div>
  );
}
