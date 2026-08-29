import { deflateSync } from 'node:zlib';

const GLYPH_W = 5;
const GLYPH_H = 8;

const GLYPH_MAP: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0, 0],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0, 0],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010, 0],
  '$': [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100, 0],
  '%': [0b11000, 0b11001, 0b00010, 0b00100, 0b01000, 0b10011, 0b00011, 0],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101, 0],
  "'": [0b00100, 0b00100, 0, 0, 0, 0, 0, 0],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010, 0],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000, 0],
  '*': [0, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0, 0],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0, 0],
  ',': [0, 0, 0, 0, 0, 0b00100, 0b01000, 0],
  '-': [0, 0, 0, 0b11111, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 0b00100, 0],
  '/': [0, 0, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110, 0],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111, 0],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110, 0],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010, 0],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110, 0],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110, 0],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110, 0],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100, 0],
  ':': [0, 0, 0b00100, 0, 0, 0b00100, 0, 0],
  ';': [0, 0, 0b00100, 0, 0, 0b00100, 0b01000, 0],
  '<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010, 0],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0, 0],
  '>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000, 0],
  '?': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0, 0b00100, 0],
  '@': [0b01110, 0b10001, 0b10111, 0b10101, 0b10110, 0b10000, 0b01110, 0],
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110, 0],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110, 0],
  'D': [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100, 0],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111, 0],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111, 0],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100, 0],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001, 0],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111, 0],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001, 0],
  'N': [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110, 0],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000, 0],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b01110, 0b00001, 0],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001, 0],
  'S': [0b01110, 0b10001, 0b10000, 0b01110, 0b00001, 0b10001, 0b01110, 0],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110, 0],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100, 0],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001, 0],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001, 0],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111, 0],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110, 0],
  '\\': [0b10000, 0b01000, 0b00100, 0b00010, 0b00001, 0, 0],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110, 0],
  '^': [0b00100, 0b01010, 0b10001, 0, 0, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 0b11111, 0],
  '`': [0b01000, 0b00100, 0, 0, 0, 0, 0, 0],
  'a': [0, 0, 0, 0b01110, 0b00001, 0b01111, 0b10001, 0],
  'b': [0b10000, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b11110, 0],
  'c': [0, 0, 0, 0b01110, 0b10000, 0b10000, 0b01110, 0],
  'd': [0b00001, 0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b01111, 0],
  'e': [0, 0, 0, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110, 0],
  'f': [0b00110, 0b01001, 0b01000, 0b11100, 0b01000, 0b01000, 0b01000, 0],
  'g': [0, 0, 0, 0b01111, 0b10001, 0b01111, 0b00001, 0b01110, 0],
  'h': [0b10000, 0b10000, 0b10000, 0b10110, 0b11001, 0b10001, 0b10001, 0],
  'i': [0b00100, 0, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  'j': [0b00010, 0, 0b00100, 0b00100, 0b00100, 0b00100, 0b10100, 0b01000, 0],
  'k': [0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0],
  'l': [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00110, 0],
  'm': [0, 0, 0, 0b11010, 0b10101, 0b10101, 0b10001, 0],
  'n': [0, 0, 0, 0b10110, 0b11001, 0b10001, 0b10001, 0],
  'o': [0, 0, 0, 0b01110, 0b10001, 0b10001, 0b01110, 0],
  'p': [0, 0, 0, 0b11110, 0b10001, 0b11110, 0b10000, 0b10000, 0],
  'q': [0, 0, 0, 0b01111, 0b10001, 0b01111, 0b00001, 0b00001, 0],
  'r': [0, 0, 0, 0b10110, 0b11001, 0b10000, 0b10000, 0],
  's': [0, 0, 0, 0b01110, 0b10000, 0b01110, 0b00001, 0b11110, 0],
  't': [0b01000, 0b01000, 0b11100, 0b01000, 0b01000, 0b01001, 0b00110, 0],
  'u': [0, 0, 0, 0b10001, 0b10001, 0b10011, 0b01101, 0],
  'v': [0, 0, 0, 0b10001, 0b10001, 0b01010, 0b00100, 0],
  'w': [0, 0, 0, 0b10001, 0b10101, 0b10101, 0b01010, 0],
  'x': [0, 0, 0, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0],
  'y': [0, 0, 0, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110, 0],
  'z': [0, 0, 0, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111, 0],
  '{': [0b00110, 0b00100, 0b00100, 0b01000, 0b00100, 0b00100, 0b00110, 0],
  '|': [0b00100, 0b00100, 0b00100, 0, 0b00100, 0b00100, 0b00100, 0],
  '}': [0b01100, 0b00100, 0b00100, 0b00010, 0b00100, 0b00100, 0b01100, 0],
  '~': [0, 0, 0b01000, 0b10101, 0b00010, 0, 0, 0],
};

interface PageResult {
  pngBase64: string;
  width: number;
  height: number;
  charColumns: number;
  charRows: number;
}

function createPng(pixels: Uint8Array, width: number, height: number): Buffer {
  const rawData = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rawData[y * width + x] = pixels[y * width + x] === 0 ? 0 : 1;
    }
  }

  function crc32(buf: Buffer): number {
    let c = 0xFFFFFFFF;
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
      t[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const deflated = deflateSync(rawData);
  const plte = Buffer.from([0xff, 0xff, 0xff, 0x00, 0x00, 0x00]);
  const trns = Buffer.from([0xff, 0x00]);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

export class BitmapTextRenderer {
  renderPng(text: string, maxColumns: number): Promise<{ pngBase64: string; width: number; height: number; charColumns: number; charRows: number }> {
    const pages = this.renderPages(text, maxColumns);
    const lastPage = pages[pages.length - 1];
    return Promise.resolve({
      pngBase64: lastPage.pngBase64,
      width: lastPage.width,
      height: lastPage.height,
      charColumns: lastPage.charColumns,
      charRows: lastPage.charRows,
    });
  }

  renderPages(text: string, maxColumns: number, linesPerPage = 90): PageResult[] {
    const lines = text.split('\n');
    const wrapped: string[] = [];
    for (const line of lines) {
      for (let i = 0; i < line.length; i += maxColumns) {
        wrapped.push(line.slice(i, i + maxColumns));
      }
    }
    if (wrapped.length === 0) wrapped.push('');

    const totalRows = wrapped.length;
    const pageCharRows = Math.min(linesPerPage, totalRows);
    const totalPages = Math.ceil(totalRows / pageCharRows);

    const results: PageResult[] = [];
    for (let p = 0; p < totalPages; p++) {
      const startRow = p * pageCharRows;
      const endRow = Math.min(startRow + pageCharRows, totalRows);
      const pageLines = wrapped.slice(startRow, endRow);
      const pageRows = pageLines.length;
      const pageCols = Math.max(...pageLines.map((l) => l.length), 1);
      const width = pageCols * GLYPH_W;
      const height = pageRows * GLYPH_H;
      const pixels = new Uint8Array(width * height).fill(255);

      for (let r = 0; r < pageLines.length; r++) {
        const line = pageLines[r];
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          const glyph = GLYPH_MAP[ch] ?? GLYPH_MAP[ch.toUpperCase()] ?? GLYPH_MAP['?'];
          if (!glyph) continue;
          for (let gy = 0; gy < GLYPH_H; gy++) {
            const rowBits = glyph[gy] ?? 0;
            for (let gx = 0; gx < GLYPH_W; gx++) {
              const bit = (rowBits >> (GLYPH_W - 1 - gx)) & 1;
              const px = c * GLYPH_W + gx;
              const py = r * GLYPH_H + gy;
              if (px < width && py < height && bit) {
                pixels[py * width + px] = 0;
              }
            }
          }
        }
      }

      const pngBuffer = createPng(pixels, width, height);
      results.push({
        pngBase64: pngBuffer.toString('base64'),
        width,
        height,
        charColumns: pageCols,
        charRows: pageRows,
      });
    }

    return results;
  }
}
