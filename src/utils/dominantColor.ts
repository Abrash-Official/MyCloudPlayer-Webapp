/** Average a few pixels from an image URL for a solid Spotify-like backdrop. */
export function sampleDominantColor(
  imageUrl: string,
  fallback = '#1a1a1a'
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
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
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        if (count === 0) {
          resolve(fallback);
          return;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        // Darken slightly so white text stays readable
        r = Math.round(r * 0.55);
        g = Math.round(g * 0.55);
        b = Math.round(b * 0.55);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });
}
