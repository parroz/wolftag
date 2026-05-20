import type { PrinterSettings } from "../settings/settingsRepository.js";
import { BrotherRasterPrintService } from "./BrotherRasterPrintService.js";
import { MockPrintService } from "./MockPrintService.js";
import type { PrintResult, PrintService, PrintTagPayload } from "./PrintService.js";
import { SystemDriverPrintService } from "./SystemDriverPrintService.js";

export class ResilientPrintService implements PrintService {
  constructor(
    private readonly primary: PrintService,
    private readonly fallback: MockPrintService,
  ) {}

  async printTag(payload: PrintTagPayload): Promise<PrintResult> {
    try {
      return await this.primary.printTag(payload);
    } catch (error) {
      const fallbackResult = await this.fallback.printTag(payload);
      return {
        ...fallbackResult,
        fallbackTriggered: true,
        warning: error instanceof Error ? error.message : "Falha na impressora Brother.",
        message: "Falha na impressora Brother; foi usada impressão simulada.",
      };
    }
  }
}

export function createPrintService(settings: PrinterSettings): PrintService {
  const mock = new MockPrintService();
  if (settings.print_mode === "mock") return mock;
  if (settings.print_mode === "brother-raster") {
    return new ResilientPrintService(
      new BrotherRasterPrintService(
        settings.printer_ip,
        settings.printer_port,
        settings.printer_model,
        settings.label_width_mm,
      ),
      mock,
    );
  }
  return new SystemDriverPrintService();
}
