export interface ExtractedPdfRow {
  referencia: string;
  descricao: string;
  pvp_inicial: number;
  baixa_percent: number;
  pvp_promo: number;
}

export async function extractRowsFromPdf(): Promise<ExtractedPdfRow[]> {
  throw new Error("PDF extraction is planned for Phase 2.");
}
