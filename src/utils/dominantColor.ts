/** Build a vivid Spotify-like backdrop palette from album art. */
export interface BackdropPalette {
  /** Strong dominant color for the upper area */
  dominant: string;
  /** Softened mid tone */
  mid: string;
  /** Deep near-black for the bottom */
  deep: string;
  /** CSS background value (layered gradients) */
  background: string;
}

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function rgb(r: number, g: number, b: number) {
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

export function sampleBackdropPalette(
  imageUrl: string,
  fallbackDominant = '#1e3a5f'
): Promise<BackdropPalette> {
  return new Promise((resolve) => {
    const fallback: BackdropPalette = {
      dominant: fallbackDominant,
      mid: '#0f1720',
      deep: '#050505',
      background: `linear-gradient(180deg, ${fallbackDominant} 0%, #0f1720 42%, #050505 100%)`,
    };

    const img = new Image();
    if (!imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const size = 64;
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
          if (lum < 22 || lum > 245) continue;
          // Heavily favor saturated pixels so the art color dominates
          const w = 0.35 + sat * 3.2 + (lum > 40 && lum < 200 ? 0.4 : 0);
          r += pr * w;
          g += pg * w;
          b += pb * w;
          weight += w;
        }

        if (weight < 1) {
          resolve(fallback);
          return;
        }

        r /= weight;
        g /= weight;
        b /= weight;

        // Boost saturation / presence (Spotify-like punch)
        const avg = (r + g + b) / 3;
        r = avg + (r - avg) * 1.35;
        g = avg + (g - avg) * 1.35;
        b = avg + (b - avg) * 1.35;

        // Keep it rich but still readable for white text
        const dominant = rgb(r * 0.72, g * 0.72, b * 0.72);
        const mid = rgb(r * 0.38, g * 0.38, b * 0.38);
        const deep = rgb(r * 0.08, g * 0.08, b * 0.08);

        resolve({
          dominant,
          mid,
          deep,
          background: [
            `radial-gradient(ellipse 90% 70% at 50% -10%, ${dominant} 0%, transparent 58%)`,
            `linear-gradient(180deg, ${dominant} 0%, ${mid} 38%, ${deep} 78%, #000 100%)`,
          ].join(', '),
        });
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });
}

/** @deprecated use sampleBackdropPalette */
export function sampleDominantColor(
  imageUrl: string,
  fallback = '#1a1a1a'
): Promise<string> {
  return sampleBackdropPalette(imageUrl, fallback).then((p) => p.dominant);
}
