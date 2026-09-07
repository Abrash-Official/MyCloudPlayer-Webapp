/** Build a vivid Spotify-like backdrop palette from album art. */
export interface BackdropPalette {
  /** Strong dominant color for the upper area */
  dominant: string;
  /** Softened mid tone */
  mid: string;
  /** Deep near-black for the bottom */
  deep: string;
  /** CSS background value (layered gradients from all sides) */
  background: string;
}

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function rgb(r: number, g: number, b: number) {
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

function buildAllSidesBackground(dominant: string, mid: string, deep: string) {
  return [
    `radial-gradient(ellipse 100% 70% at 50% -8%, ${dominant} 0%, transparent 62%)`,
    `radial-gradient(ellipse 100% 70% at 50% 108%, ${dominant} 0%, transparent 62%)`,
    `radial-gradient(ellipse 70% 100% at -8% 50%, ${mid} 0%, transparent 58%)`,
    `radial-gradient(ellipse 70% 100% at 108% 50%, ${mid} 0%, transparent 58%)`,
    `radial-gradient(ellipse 90% 90% at 50% 50%, ${mid} 0%, transparent 72%)`,
    `linear-gradient(180deg, ${deep} 0%, #000 100%)`,
  ].join(', ');
}

export function sampleBackdropPalette(
  imageUrl: string,
  fallbackDominant = '#1e3a5f'
): Promise<BackdropPalette> {
  return new Promise((resolve) => {
    const midFallback = '#0f1720';
    const deepFallback = '#050505';
    const fallback: BackdropPalette = {
      dominant: fallbackDominant,
      mid: midFallback,
      deep: deepFallback,
      background: buildAllSidesBackground(
        fallbackDominant,
        midFallback,
        deepFallback
      ),
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
        const mid = rgb(r * 0.42, g * 0.42, b * 0.42);
        const deep = rgb(r * 0.1, g * 0.1, b * 0.1);

        resolve({
          dominant,
          mid,
          deep,
          background: buildAllSidesBackground(dominant, mid, deep),
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
