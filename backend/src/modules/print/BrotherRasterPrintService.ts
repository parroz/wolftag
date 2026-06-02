import net from "node:net";
import type { PrintResult, PrintService, PrintTagPayload } from "./PrintService.js";
import { encodeBrotherRaster, encodeCut } from "./brotherRasterEncoder.js";
import { renderLabelBitmap } from "./labelRenderer.js";

async function sendBufferToPrinter(host: string, port: number, payload: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const timeoutMs = 4000;

    socket.setTimeout(timeoutMs);
    socket.on("error", (error) => reject(error));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Tempo limite de ligação à impressora."));
    });

    socket.connect(port, host, () => {
      socket.write(payload, (error) => {
        if (error) {
          reject(error);
          return;
        }
        socket.end();
      });
    });

    socket.on("close", () => resolve());
  });
}

export class BrotherRasterPrintService implements PrintService {
  constructor(
    private readonly ip: string,
    private readonly port: number,
    private readonly model: string,
    private readonly labelWidthMm: number,
  ) {}

  async printTag(payload: PrintTagPayload): Promise<PrintResult> {
    const bitmap = await renderLabelBitmap(payload.product, this.labelWidthMm);
    const rasterPayload = encodeBrotherRaster(bitmap, this.labelWidthMm);
    await sendBufferToPrinter(this.ip, this.port, rasterPayload);
    return {
      ok: true,
      modeUsed: "brother-raster",
      fallbackTriggered: false,
      message: `Etiqueta enviada para a impressora Brother ${this.model} em ${this.ip}.`,
    };
  }

  async cut(): Promise<PrintResult> {
    const payload = encodeCut(this.labelWidthMm);
    await sendBufferToPrinter(this.ip, this.port, payload);
    return {
      ok: true,
      modeUsed: "brother-raster",
      fallbackTriggered: false,
      message: `Fita cortada na impressora Brother ${this.model}.`,
    };
  }
}
