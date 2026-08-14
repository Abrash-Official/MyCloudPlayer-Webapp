import type { YouTubeSearchResult } from '../types';

const YT_API = 'https://www.googleapis.com/youtube/v3';

export const searchYouTube = async (
  query: string,
  apiKey: string
): Promise<YouTubeSearchResult | null> => {
  if (!apiKey) throw new Error('YouTube API key is not set. Add it in Settings.');
  if (!query.trim()) return null;

  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '1',
    q: query.trim(),
    type: 'video',
    videoCategoryId: '10',
    key: apiKey,
  });

  const res = await fetch(`${YT_API}/search?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`YouTube API error: ${reason}`);
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  const snippet = item.snippet;

  return {
    videoId: item.id.videoId as string,
    title: decodeHtmlEntities(snippet.title),
    channelTitle: snippet.channelTitle,
    thumbnail:
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url,
    publishedAt: snippet.publishedAt,
  };
};

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
