import type { LabelBitmap } from "./labelRenderer.js";

function bitFromPixel(r: number, g: number, b: number): 0 | 1 {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 170 ? 1 : 0;
}

interface TapeProfile {
  mediaWidthMm: number;
  mediaType: number; // 0x01 laminated tape
  leftMarginPins: number;
  printPins: number;
  rightMarginPins: number;
  bytesPerRasterLine: number;
}

function getTapeProfile(mediaWidthMm: number): TapeProfile {
  if (mediaWidthMm === 12) {
    return {
      mediaWidthMm: 12,
      mediaType: 0x01,
      leftMarginPins: 29,
      printPins: 70,
      rightMarginPins: 29,
      bytesPerRasterLine: 16,
    };
  }
  return {
    mediaWidthMm: 24,
    mediaType: 0x01,
    leftMarginPins: 0,
    printPins: 128,
    rightMarginPins: 0,
    bytesPerRasterLine: 16,
  };
}

function encodePrintInformation(profile: TapeProfile, rasterLines: number, isFirstPage = true): Buffer {
  const validFlag = 0x0e; // kind + width + length
  const n5 = rasterLines & 0xff;
  const n6 = (rasterLines >> 8) & 0xff;
  const n7 = (rasterLines >> 16) & 0xff;
  const n8 = (rasterLines >> 24) & 0xff;

  return Buffer.from([
    0x1b,
    0x69,
    0x7a,
    validFlag,
    profile.mediaType,
    profile.mediaWidthMm,
    0x00, // continuous-length tape
    n5,
    n6,
    n7,
    n8,
    isFirstPage ? 0x00 : 0x01, // starting page (0) vs subsequent page (1)
    0x00,
  ]);
}

function buildPrinterLineData(bitmap: LabelBitmap, x: number, profile: TapeProfile): Buffer {
  const bytes = Buffer.alloc(profile.bytesPerRasterLine, 0);
  const totalPins = profile.leftMarginPins + profile.printPins + profile.rightMarginPins;
  for (let y = 0; y < totalPins; y += 1) {
    if (y < profile.leftMarginPins || y >= profile.leftMarginPins + profile.printPins) {
      continue;
    }
    const printableY = y - profile.leftMarginPins;
    const sourceY = Math.floor((printableY / profile.printPins) * bitmap.height);
    const offset = (sourceY * bitmap.width + x) * 4;
    const on = bitFromPixel(bitmap.rgba[offset], bitmap.rgba[offset + 1], bitmap.rgba[offset + 2]);
    if (on) {
      const byteIndex = Math.floor(y / 8);
      const bitIndex = 7 - (y % 8);
      bytes[byteIndex] |= 1 << bitIndex;
    }
  }
  return bytes;
}

function isZeroLine(data: Buffer): boolean {
  for (const value of data) {
    if (value !== 0) {
      return false;
    }
  }
  return true;
}

export function encodeBrotherRaster(bitmap: LabelBitmap, mediaWidthMm: number, copies = 1): Buffer {
  const profile = getTapeProfile(mediaWidthMm);
  const pages = Math.max(1, Math.min(99, Math.floor(copies)));
  const chunks: Buffer[] = [];

  chunks.push(Buffer.alloc(200, 0x00)); // Invalidate preamble (once)
  chunks.push(Buffer.from([0x1b, 0x40])); // Initialize (once)
  chunks.push(Buffer.from([0x1b, 0x69, 0x61, 0x01])); // Enter raster mode (once)

  // The raster body is identical for every copy — build it once.
  const raster: Buffer[] = [];
  for (let x = 0; x < bitmap.width; x += 1) {
    const line = buildPrinterLineData(bitmap, x, profile);
    if (isZeroLine(line)) {
      raster.push(Buffer.from([0x5a])); // Zero raster graphics
    } else {
      raster.push(Buffer.from([0x47, profile.bytesPerRasterLine, 0x00]));
      raster.push(line);
    }
  }

  // Chain Printing + Auto Cut (mirrors the P-touch driver): all copies are sent
  // as one batch job, each auto-cut, chained to minimise waste between them.
  // Non-last pages end with 0C ("more pages"); only the last ends with 1A. 0C is
  // safe here because more page data always follows it within the same job.
  for (let page = 0; page < pages; page += 1) {
    chunks.push(encodePrintInformation(profile, bitmap.width, page === 0));
    chunks.push(Buffer.from([0x1b, 0x69, 0x4d, 0x40])); // Various mode: auto-cut ON, no mirror
    chunks.push(Buffer.from([0x1b, 0x69, 0x41, 0x01])); // Cut each 1 label
    chunks.push(Buffer.from([0x1b, 0x69, 0x4b, 0x00])); // Advanced mode: chain printing ON
    chunks.push(Buffer.from([0x1b, 0x69, 0x64, 0x0e, 0x00])); // 14-dot margin
    chunks.push(Buffer.from([0x4d, 0x00])); // No compression
    for (const chunk of raster) {
      chunks.push(chunk);
    }
    chunks.push(Buffer.from([page === pages - 1 ? 0x1a : 0x0c]));
  }

  return Buffer.concat(chunks);
}
