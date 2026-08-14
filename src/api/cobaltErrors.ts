export const isCloudflareBlock = (body: string): boolean =>
  body.includes('<!DOCTYPE html>') ||
  body.includes('cf-error-details') ||
  body.includes('you have been blocked') ||
  body.includes('Attention Required! | Cloudflare');

export const formatCobaltError = (status: number, raw: string): string => {
  if (isCloudflareBlock(raw)) {
    return 'Download blocked by server protection. Please try again shortly.';
  }

  try {
    const data = JSON.parse(raw);
    const code = data?.error?.code;
    if (code) return `Download failed: ${code}`;
    const detail = data?.detail;
    if (typeof detail === 'string' && detail.length > 0) {
      return `Download failed: ${detail.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
    }
  } catch {
    /* not JSON */
  }

  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  return snippet
    ? `Download failed [${status}]: ${snippet}`
    : `Download failed [${status}]`;
};
