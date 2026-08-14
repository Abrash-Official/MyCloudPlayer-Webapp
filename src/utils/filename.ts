/** Strip common audio/video extensions for display. */
export function stripAudioExtension(filename: string): string {
  return filename.replace(
    /\.(mp3|m4a|flac|wav|ogg|opus|aac|wma|webm|mp4|mpeg|mpga|mkv|3gp)$/i,
    ''
  );
}

export function buildSongFilename(title: string): string {
  const base = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  const safe = base || 'Unknown Track';
  return /\.(mp3|m4a|webm|opus|aac)$/i.test(safe) ? safe : `${safe}.mp3`;
}
