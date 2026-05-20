export interface Batch {
  id: number;
  name: string;
  created_at: string;
}

export interface Product {
  id: number;
  batch_id: number;
  referencia: string;
  descricao: string;
  pvp_inicial: number;
  baixa_percent: number;
  pvp_promo: number;
  created_at: string;
}

export interface PrintResponse {
  ok: boolean;
  modeUsed: "mock" | "brother-raster" | "system-driver";
  fallbackTriggered: boolean;
  warning?: string;
  message: string;
}

export interface PrinterSettings {
  print_mode: "mock" | "brother-raster" | "system-driver";
  printer_ip: string;
  printer_port: number;
  printer_model: string;
  label_width_mm: number;
}
