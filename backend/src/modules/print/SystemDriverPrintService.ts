import type { PrintResult, PrintService, PrintTagPayload } from "./PrintService.js";

export class SystemDriverPrintService implements PrintService {
  async printTag(_: PrintTagPayload): Promise<PrintResult> {
    return {
      ok: false,
      modeUsed: "system-driver",
      fallbackTriggered: false,
      message: "System driver print mode is scaffolded only in Phase 1.",
      warning: "Not implemented",
    };
  }
}
