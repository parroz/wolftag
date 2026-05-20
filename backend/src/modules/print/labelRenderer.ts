import { Jimp, loadFont, measureText } from "jimp";
import { SANS_14_BLACK, SANS_16_BLACK, SANS_32_BLACK } from "jimp/fonts";
import type { Product } from "../products/productRepository.js";

export interface LabelBitmap {
  width: number;
  height: number;
  rgba: Buffer;
}

function formatPercent(value: number): string {
  return `-${Math.round(value)}%`;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export async function renderLabelBitmap(product: Product, labelWidthMm: number): Promise<LabelBitmap> {
  const font32 = await loadFont(SANS_32_BLACK);
  const font16 = await loadFont(SANS_16_BLACK);
  const font14 = await loadFont(SANS_14_BLACK);
  const discountText = formatPercent(product.baixa_percent);
  const priceText = formatEuro(product.pvp_promo);
  const refText = `REF: ${product.referencia}`;
  const descText = product.descricao.trim().slice(0, 22);

  let width = 620;
  const height = labelWidthMm === 12 ? 70 : 128;
  if (labelWidthMm === 12) {
    const padding = 10;
    const topGap = 14;
    const bottomGap = descText ? 10 : 0;
    const topWidth =
      padding +
      measureText(font32, discountText) +
      topGap +
      measureText(font32, priceText) +
      padding;
    const bottomWidth =
      padding +
      measureText(font16, refText) +
      bottomGap +
      (descText ? measureText(font14, descText) : 0) +
      padding;
    width = Math.min(420, Math.max(260, topWidth, bottomWidth));
  }

  const image = new Jimp({ width, height, color: 0xffffffff });
  const padding = 10;
  const priceX = Math.max(padding, width - padding - measureText(font32, priceText));

  image.print({ font: font32, x: padding, y: 0, text: discountText });
  image.print({ font: font32, x: priceX, y: 0, text: priceText });
  image.print({ font: font16, x: padding, y: 36, text: refText });

  if (descText) {
    const descWidth = measureText(font14, descText);
    const refEndX = padding + measureText(font16, refText);
    const descX = Math.max(refEndX + 10, width - padding - descWidth);
    image.print({ font: font14, x: descX, y: 42, text: descText });
  }

  return { width, height, rgba: Buffer.from(image.bitmap.data) };
}
