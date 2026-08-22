/** Read embedded cover art from MP3 (ID3 APIC) or M4A/MP4 (covr). */

function readSyncsafeInt(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] & 0x7f) << 21) |
    ((data[offset + 1] & 0x7f) << 14) |
    ((data[offset + 2] & 0x7f) << 7) |
    (data[offset + 3] & 0x7f)
  );
}

function isJpeg(data: Uint8Array, i: number): boolean {
  return data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff;
}

function isPng(data: Uint8Array, i: number): boolean {
  return (
    data[i] === 0x89 &&
    data[i + 1] === 0x50 &&
    data[i + 2] === 0x4e &&
    data[i + 3] === 0x47
  );
}

function sliceJpeg(data: Uint8Array, start: number): Uint8Array | null {
  for (let i = start + 2; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xd9) {
      return data.subarray(start, i + 2);
    }
  }
  return null;
}

function slicePng(data: Uint8Array, start: number): Uint8Array | null {
  if (start + 8 > data.length) return null;
  const len =
    (data[start + 8] << 24) |
    (data[start + 9] << 16) |
    (data[start + 10] << 8) |
    data[start + 11];
  const end = start + 8 + 4 + len + 4 + 4;
  if (end > data.length) return null;
  return data.subarray(start, end);
}

function sliceImageAt(data: Uint8Array, start: number): Uint8Array | null {
  if (isJpeg(data, start)) return sliceJpeg(data, start);
  if (isPng(data, start)) return slicePng(data, start);
  return null;
}

function skipNullTerminated(data: Uint8Array, start: number): number {
  let i = start;
  while (i < data.length && data[i] !== 0) i++;
  return i < data.length ? i + 1 : data.length;
}

function skipId3Text(data: Uint8Array, start: number, encoding: number): number {
  let i = start;
  if (encoding === 1 || encoding === 2) {
    while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) {
      i += 2;
    }
    return Math.min(i + 2, data.length);
  }
  return skipNullTerminated(data, start);
}

function parseApicFrame(frame: Uint8Array): Uint8Array | null {
  if (frame.length < 4) return null;
  const encoding = frame[0];
  let i = 1;
  i = skipNullTerminated(frame, i); // MIME
  if (i >= frame.length) return null;
  i += 1; // picture type
  i = skipId3Text(frame, i, encoding); // description
  if (i >= frame.length) return null;
  const image = frame.subarray(i);
  if (image.length < 16) return null;
  if (isJpeg(image, 0)) return sliceJpeg(image, 0);
  if (isPng(image, 0)) return slicePng(image, 0);
  return image;
}

function extractFromId3(data: Uint8Array): Uint8Array | null {
  if (data.length < 10 || data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) {
    return null;
  }

  const major = data[3];
  const tagSize = readSyncsafeInt(data, 6);
  let pos = 10;
  const end = Math.min(10 + tagSize, data.length);

  while (pos + 10 <= end) {
    const frameId = String.fromCharCode(
      data[pos],
      data[pos + 1],
      data[pos + 2],
      data[pos + 3]
    );
    const frameSize =
      major === 4
        ? readSyncsafeInt(data, pos + 4)
        : (data[pos + 4] << 24) |
          (data[pos + 5] << 16) |
          (data[pos + 6] << 8) |
          data[pos + 7];
    const frameStart = pos + 10;
    const frameEnd = frameStart + frameSize;
    if (frameEnd > data.length || frameSize <= 0) break;

    if (frameId === 'APIC') {
      const image = parseApicFrame(data.subarray(frameStart, frameEnd));
      if (image) return image;
    }

    pos = frameEnd;
  }

  return null;
}

function extractFromMp4(data: Uint8Array): Uint8Array | null {
  const covr = [0x63, 0x6f, 0x76, 0x72]; // covr
  for (let i = 0; i < data.length - 4; i++) {
    if (
      data[i] === covr[0] &&
      data[i + 1] === covr[1] &&
      data[i + 2] === covr[2] &&
      data[i + 3] === covr[3]
    ) {
      const searchEnd = Math.min(i + 512, data.length - 3);
      for (let j = i + 4; j < searchEnd; j++) {
        if (isJpeg(data, j) || isPng(data, j)) {
          const image = sliceImageAt(data, j);
          if (image) return image;
        }
      }
    }
  }
  return null;
}

function mimeForImage(data: Uint8Array): string {
  if (isPng(data, 0)) return 'image/png';
  return 'image/jpeg';
}

export async function extractAlbumArt(blob: Blob): Promise<Blob | null> {
  const maxScan = Math.min(blob.size, 5 * 1024 * 1024);
  const buf = await blob.slice(0, maxScan).arrayBuffer();
  const bytes = new Uint8Array(buf);

  const id3Image = extractFromId3(bytes);
  if (id3Image) {
    return new Blob([new Uint8Array(id3Image)], { type: mimeForImage(id3Image) });
  }

  const mp4Image = extractFromMp4(bytes);
  if (mp4Image) {
    return new Blob([new Uint8Array(mp4Image)], { type: mimeForImage(mp4Image) });
  }

  return null;
}
