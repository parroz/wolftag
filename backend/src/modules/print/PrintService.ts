import type { Product } from "../products/productRepository.js";

export interface PrintTagPayload {
  product: Product;
}

export interface PrintResult {
  ok: boolean;
  modeUsed: "mock" | "brother-raster" | "system-driver";
  fallbackTriggered: boolean;
  warning?: string;
  message: string;
}

export interface PrintService {
  printTag(payload: PrintTagPayload): Promise<PrintResult>;
  cut(): Promise<PrintResult>;
}
