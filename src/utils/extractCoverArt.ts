import jsmediatags from 'jsmediatags';

/** Extract embedded cover art (ID3 APIC / MP4 covr) using jsmediatags. */
export function extractCoverFromBlob(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    jsmediatags.read(blob, {
      onSuccess: (result) => {
        const pic = result.tags.picture;
        if (!pic?.data?.length) {
          resolve(null);
          return;
        }
        const mime = pic.format || 'image/jpeg';
        resolve(new Blob([new Uint8Array(pic.data)], { type: mime }));
      },
      onError: () => resolve(null),
    });
  });
}
