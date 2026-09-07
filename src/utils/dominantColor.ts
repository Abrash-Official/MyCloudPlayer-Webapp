/** Sample a vivid backdrop color from album art (works with blob: URLs). */
export function sampleDominantColor(
  imageUrl: string,
  fallback = '#1a1a1a'
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    // Don't set crossOrigin for blob: URLs — it can break canvas reads.
    if (!imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (pr + pg + pb) / 3;
          // Prefer colorful mid-tones; skip near-black letterbox pixels
          if (lum < 18 || lum > 240) continue;
          const w = 0.4 + sat * 1.6;
          r += pr * w;
          g += pg * w;
          b += pb * w;
          weight += w;
        }

        if (weight < 1) {
          resolve(fallback);
          return;
        }

        r = Math.round(r / weight);
        g = Math.round(g / weight);
        b = Math.round(b / weight);
        // Darken for readable white text
        r = Math.round(r * 0.45);
        g = Math.round(g * 0.45);
        b = Math.round(b * 0.45);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });
}
