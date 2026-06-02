import type { PrintResult, PrintService, PrintTagPayload } from "./PrintService.js";

export class MockPrintService implements PrintService {
  async printTag(payload: PrintTagPayload): Promise<PrintResult> {
    return {
      ok: true,
      modeUsed: "mock",
      fallbackTriggered: false,
      message: `Impressão simulada para produto ${payload.product.referencia}.`,
    };
  }

  async cut(): Promise<PrintResult> {
    return {
      ok: true,
      modeUsed: "mock",
      fallbackTriggered: false,
      message: "Corte de fita simulado.",
    };
  }
}
