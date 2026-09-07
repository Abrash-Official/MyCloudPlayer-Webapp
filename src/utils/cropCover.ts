/**
 * Crop cover art to a filled square, removing letterbox/pillarbox bars
 * that YouTube-style images often include.
 */
export async function cropToSquareCover(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    if (w < 8 || h < 8) return blob;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);

    const isDark = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return data[i] + data[i + 1] + data[i + 2] < 48;
    };

    const rowIsBar = (y: number) => {
      let dark = 0;
      const step = Math.max(1, Math.floor(w / 40));
      let samples = 0;
      for (let x = 0; x < w; x += step) {
        samples += 1;
        if (isDark(x, y)) dark += 1;
      }
      return dark / samples > 0.88;
    };

    const colIsBar = (x: number) => {
      let dark = 0;
      const step = Math.max(1, Math.floor(h / 40));
      let samples = 0;
      for (let y = 0; y < h; y += step) {
        samples += 1;
        if (isDark(x, y)) dark += 1;
      }
      return dark / samples > 0.88;
    };

    let top = 0;
    while (top < h / 3 && rowIsBar(top)) top += 1;
    let bottom = h - 1;
    while (bottom > (h * 2) / 3 && rowIsBar(bottom)) bottom -= 1;
    let left = 0;
    while (left < w / 3 && colIsBar(left)) left += 1;
    let right = w - 1;
    while (right > (w * 2) / 3 && colIsBar(right)) right -= 1;

    const contentW = Math.max(1, right - left + 1);
    const contentH = Math.max(1, bottom - top + 1);
    const side = Math.min(contentW, contentH);
    const sx = left + Math.floor((contentW - side) / 2);
    const sy = top + Math.floor((contentH - side) / 2);

    const outSize = Math.min(512, side);
    const out = document.createElement('canvas');
    out.width = outSize;
    out.height = outSize;
    const octx = out.getContext('2d');
    if (!octx) return blob;
    octx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSize, outSize);

    const cropped = await new Promise<Blob | null>((resolve) =>
      out.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );
    return cropped ?? blob;
  } finally {
    bitmap.close();
  }
}
