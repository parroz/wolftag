import { Jimp, loadFont, measureText } from "jimp";
import { SANS_32_BLACK } from "jimp/fonts";
import type { Product } from "../products/productRepository.js";

export interface LabelBitmap {
  width: number;
  height: number;
  rgba: Buffer;
}

const BLACK = 0x000000ff;

function formatPercent(value: number): string {
  return `-${Math.round(value)}%`;
}

function formatPriceNumber(value: number): string {
  return value.toFixed(2); // e.g. "35.94" — the € glyph is drawn separately (font atlas lacks it)
}

function fillRect(image: InstanceType<typeof Jimp>, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(image.bitmap.width, Math.round(x + w));
  const y1 = Math.min(image.bitmap.height, Math.round(y + h));
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      image.setPixelColor(BLACK, xx, yy);
    }
  }
}

// The bundled jimp fonts have no usable euro glyph, so we render it from the
// font's "C" and overlay the two horizontal euro bars on top of it. This keeps
// the size and baseline perfectly matched to the price digits.
function drawEuro(
  image: InstanceType<typeof Jimp>,
  font: Awaited<ReturnType<typeof loadFont>>,
  x: number,
  y: number,
): void {
  const c = font.chars["C"];
  image.print({ font, x, y, text: "C" });
  const cTop = y + c.yoffset;
  const cLeft = x + c.xoffset;
  const barThickness = Math.max(2, Math.round(c.height * 0.13));
  const barWidth = Math.round(c.width * 0.82);
  const barX = cLeft - Math.round(c.width * 0.1);
  fillRect(image, barX, cTop + Math.round(c.height * 0.3), barWidth, barThickness);
  fillRect(image, barX, cTop + Math.round(c.height * 0.55), barWidth, barThickness);
}

export async function renderLabelBitmap(product: Product, labelWidthMm: number): Promise<LabelBitmap> {
  const font = await loadFont(SANS_32_BLACK);

  const discountText = formatPercent(product.baixa_percent);
  const priceNumber = formatPriceNumber(product.pvp_promo);

  const euroGap = 3;
  const euroWidth = font.chars["C"].xadvance;
  const discountWidth = measureText(font, discountText);
  const priceNumberWidth = measureText(font, priceNumber);
  const priceWidth = priceNumberWidth + euroGap + euroWidth;

  const padding = 16;
  const gap = 30; // space between the discount and the price
  const height = labelWidthMm === 12 ? 70 : 128;
  const width = padding + discountWidth + gap + priceWidth + padding;

  const image = new Jimp({ width, height, color: 0xffffffff });

  // Vertically centre using the digit glyph metrics.
  const digit = font.chars["5"];
  const y = Math.round((height - digit.height) / 2) - digit.yoffset;

  // Discount on the left.
  image.print({ font, x: padding, y, text: discountText });

  // Price (number + drawn euro) right-aligned.
  const priceX = width - padding - priceWidth;
  image.print({ font, x: priceX, y, text: priceNumber });
  drawEuro(image, font, priceX + priceNumberWidth + euroGap, y);

  return { width, height, rgba: Buffer.from(image.bitmap.data) };
}
