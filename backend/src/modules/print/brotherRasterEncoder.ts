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

function encodePrintInformation(profile: TapeProfile, rasterLines: number): Buffer {
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
    0x00, // first page
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

export function encodeBrotherRaster(bitmap: LabelBitmap, mediaWidthMm: number): Buffer {
  const chunks: Buffer[] = [];
  const profile = getTapeProfile(mediaWidthMm);

  chunks.push(Buffer.alloc(200, 0x00)); // Invalidate preamble
  chunks.push(Buffer.from([0x1b, 0x40])); // Initialize
  chunks.push(Buffer.from([0x1b, 0x69, 0x61, 0x01])); // Enter raster mode
  chunks.push(encodePrintInformation(profile, bitmap.width));
  // Chain printing: do NOT feed or cut after each tag. Tags print back-to-back
  // with no per-tag tape waste; the operator cuts the strip on demand (encodeCut).
  chunks.push(Buffer.from([0x1b, 0x69, 0x4d, 0x00])); // Various mode: auto-cut OFF, no mirror
  chunks.push(Buffer.from([0x1b, 0x69, 0x4b, 0x00])); // Advanced mode: chain printing ON (no feed/cut after page)
  chunks.push(Buffer.from([0x1b, 0x69, 0x64, 0x00, 0x00])); // 0-dot margin so consecutive tags abut
  chunks.push(Buffer.from([0x4d, 0x00])); // No compression

  for (let x = 0; x < bitmap.width; x += 1) {
    const line = buildPrinterLineData(bitmap, x, profile);
    if (isZeroLine(line)) {
      chunks.push(Buffer.from([0x5a])); // Zero raster graphics
    } else {
      chunks.push(Buffer.from([0x47, profile.bytesPerRasterLine, 0x00]));
      chunks.push(line);
    }
  }

  chunks.push(Buffer.from([0x0c])); // Print command (no feed) — keeps the chain open
  return Buffer.concat(chunks);
}

// Feeds the chained strip out and cuts it once. The ~2.5 cm head-to-cutter
// dead zone is paid here (once per strip) instead of on every tag.
export function encodeCut(mediaWidthMm: number): Buffer {
  const profile = getTapeProfile(mediaWidthMm);
  const chunks: Buffer[] = [];

  chunks.push(Buffer.alloc(200, 0x00)); // Invalidate preamble
  chunks.push(Buffer.from([0x1b, 0x40])); // Initialize
  chunks.push(Buffer.from([0x1b, 0x69, 0x61, 0x01])); // Enter raster mode
  chunks.push(encodePrintInformation(profile, 1)); // single (blank) raster line
  chunks.push(Buffer.from([0x1b, 0x69, 0x4d, 0x40])); // Various mode: auto-cut ON
  chunks.push(Buffer.from([0x1b, 0x69, 0x4b, 0x08])); // Advanced mode: no chain printing (feed + cut)
  chunks.push(Buffer.from([0x1b, 0x69, 0x64, 0x00, 0x00])); // 0-dot margin
  chunks.push(Buffer.from([0x4d, 0x00])); // No compression
  chunks.push(Buffer.from([0x5a])); // one zero raster line
  chunks.push(Buffer.from([0x1a])); // Print and feed -> ejects strip and cuts

  return Buffer.concat(chunks);
}
