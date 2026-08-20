import { DOWNLOAD_AND_SAVE_API_URL } from '../constants/downloadAndSaveApi';

export async function downloadAndSaveToDrive(opts: {
  videoUrl: string;
  accessToken: string;
}): Promise<unknown> {
  const res = await fetch(DOWNLOAD_AND_SAVE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: opts.videoUrl,
      access_token: opts.accessToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Download & save failed (${res.status})${
        text ? `: ${text.slice(0, 400)}` : ''
      }`
    );
  }

  return res.json().catch(() => ({}));
}

