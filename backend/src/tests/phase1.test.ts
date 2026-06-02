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
  it("imports decimal values and reports skipped rows", () => {
    const batch = createBatchIfMissing("TEST-A");
    const csv = [
      "referencia;Designacao;Cor;Tam;EAN;PVP;Perc;PPromo",
      "ABC123;Produto A;1;M;1000007538963;29,99;40;19,99",
      "   ABC123   ; Produto A ;1; L ;1000007538970;59.90;10,5;53,91",
      "BAD;Missing EAN;1;M;;19.99;5;18.99",
    ].join("\n");

    const summary = importCsvToBatch(batch.id, csv);
    expect(summary.imported).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.errors.length).toBe(1);
  });

  it("keeps each EAN variant of a shared reference as a distinct row", () => {
    const batch = createBatchIfMissing("TEST-VARIANTS");
    const csv = [
      "referencia,Designacao,Cor,Tam,EAN,PVP,Perc,PPromo",
      "400532,SAIA ROBERTS,1,M,1000007538956,59.9,40,35.94",
      "400532,SAIA ROBERTS,1,L,1000007538963,59.9,40,35.94",
      "400532,SAIA ROBERTS,41,L,1000007539007,59.9,40,35.94",
    ].join("\n");

    const summary = importCsvToBatch(batch.id, csv);
    expect(summary.imported).toBe(3);

    const results = searchProducts(batch.id, "400532");
    expect(results.length).toBe(3);
    expect(new Set(results.map((r) => r.ean)).size).toBe(3);
  });
});

describe("search ranking", () => {
  it("prioritizes exact referencia over partial matches", () => {
    const batch = createBatchIfMissing("TEST-B");
    const csv = [
      "referencia,Designacao,Cor,Tam,EAN,PVP,Perc,PPromo",
      "ABC123,Produto Exato,1,M,1000000000001,39.99,20,31.99",
      "ABC1234,Produto Parcial,1,M,1000000000002,49.99,10,44.99",
      "ZX9,Descricao com ABC123,1,M,1000000000003,19.99,5,18.99",
    ].join("\n");
    importCsvToBatch(batch.id, csv);

    const results = searchProducts(batch.id, "ABC123");
    expect(results[0]?.referencia).toBe("ABC123");
  });

  it("finds a product by exact EAN scan", () => {
    const batch = createBatchIfMissing("TEST-EAN");
    const csv = [
      "referencia,Designacao,Cor,Tam,EAN,PVP,Perc,PPromo",
      "400532,SAIA ROBERTS,1,M,1000007538956,59.9,40,35.94",
      "400532,SAIA ROBERTS,1,L,1000007538963,59.9,40,35.94",
    ].join("\n");
    importCsvToBatch(batch.id, csv);

    const results = searchProducts(batch.id, "1000007538963");
    expect(results.length).toBe(1);
    expect(results[0]?.tam).toBe("L");
  });
});

describe("print fallback", () => {
  it("uses mock fallback when primary service throws", async () => {
    const failingPrimary: PrintService = {
      async printTag() {
        throw new Error("connection timeout");
      },
      async cut() {
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
        cor: "1",
        tam: "M",
        ean: "1000000000001",
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
      async cut() {
        return {
          ok: true,
          modeUsed: "brother-raster",
          fallbackTriggered: false,
          message: "cut",
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
        cor: "1",
        tam: "M",
        ean: "1000000000001",
        pvp_inicial: 10,
        baixa_percent: 10,
        pvp_promo: 9,
        created_at: new Date().toISOString(),
      },
    });

    expect(result.modeUsed).toBe("brother-raster");
    expect(result.fallbackTriggered).toBe(false);
  });

  it("falls back to mock when cut fails on the primary", async () => {
    const failingPrimary: PrintService = {
      async printTag() {
        throw new Error("should not be called");
      },
      async cut() {
        throw new Error("cutter offline");
      },
    };
    const service = new ResilientPrintService(failingPrimary, new MockPrintService());
    const result = await service.cut();

    expect(result.modeUsed).toBe("mock");
    expect(result.fallbackTriggered).toBe(true);
    expect(result.warning).toContain("cutter offline");
  });
});
