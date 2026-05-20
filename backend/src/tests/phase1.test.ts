import { beforeEach, describe, expect, it } from "vitest";
import "../db/runMigrations.js";
import { db } from "../db/database.js";
import { createBatchIfMissing } from "../modules/batches/batchRepository.js";
import { importCsvToBatch } from "../modules/import/csvImportService.js";
import { type PrintResult, type PrintService } from "../modules/print/PrintService.js";
import { MockPrintService } from "../modules/print/MockPrintService.js";
import { ResilientPrintService } from "../modules/print/printServiceFactory.js";
import { searchProducts } from "../modules/products/productRepository.js";

beforeEach(() => {
  db.exec("DELETE FROM products");
  db.exec("DELETE FROM batches");
});

describe("csv import", () => {
  it("imports comma decimal values and reports skipped rows", () => {
    const batch = createBatchIfMissing("TEST-A");
    const csv = [
      "Referencia;Descricao;PVP Inicial;Baixa %;PVP Promo",
      "ABC123;Produto A;29,99;40,0;19,99",
      "   DEF999   ; Produto B ;59.90;10,5;53,91",
      "BAD;Missing Price;;;",
    ].join("\n");

    const summary = importCsvToBatch(batch.id, csv);
    expect(summary.imported).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.errors.length).toBe(1);
  });
});

describe("search ranking", () => {
  it("prioritizes exact referencia over partial matches", () => {
    const batch = createBatchIfMissing("TEST-B");
    const csv = [
      "Referencia,Descricao,PVP Inicial,Baixa %,PVP Promo",
      "ABC123,Produto Exato,39.99,20,31.99",
      "ABC1234,Produto Parcial,49.99,10,44.99",
      "ZX9,Descricao com ABC123,19.99,5,18.99",
    ].join("\n");
    importCsvToBatch(batch.id, csv);

    const results = searchProducts(batch.id, "ABC123");
    expect(results[0]?.referencia).toBe("ABC123");
  });
});

describe("print fallback", () => {
  it("uses mock fallback when primary service throws", async () => {
    const failingPrimary: PrintService = {
      async printTag() {
        throw new Error("connection timeout");
      },
    };
    const service = new ResilientPrintService(failingPrimary, new MockPrintService());
    const result = await service.printTag({
      product: {
        id: 1,
        batch_id: 1,
        referencia: "ABC",
        descricao: "Demo",
        pvp_inicial: 10,
        baixa_percent: 10,
        pvp_promo: 9,
        created_at: new Date().toISOString(),
      },
    });

    expect(result.modeUsed).toBe("mock");
    expect(result.fallbackTriggered).toBe(true);
    expect(result.warning).toContain("connection timeout");
  });

  it("returns primary result when printing succeeds", async () => {
    const primary: PrintService = {
      async printTag() {
        return {
          ok: true,
          modeUsed: "brother-raster",
          fallbackTriggered: false,
          message: "printed",
        } satisfies PrintResult;
      },
    };
    const service = new ResilientPrintService(primary, new MockPrintService());
    const result = await service.printTag({
      product: {
        id: 1,
        batch_id: 1,
        referencia: "ABC",
        descricao: "Demo",
        pvp_inicial: 10,
        baixa_percent: 10,
        pvp_promo: 9,
        created_at: new Date().toISOString(),
      },
    });

    expect(result.modeUsed).toBe("brother-raster");
    expect(result.fallbackTriggered).toBe(false);
  });
});
