import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import { createBatch, createBatchIfMissing, getBatchById, listBatches } from "./modules/batches/batchRepository.js";
import { importCsvToBatch } from "./modules/import/csvImportService.js";
import { getProductById, searchProducts } from "./modules/products/productRepository.js";
import { getSettings, updateSettings } from "./modules/settings/settingsRepository.js";
import { createPrintService } from "./modules/print/printServiceFactory.js";

const upload = multer({ storage: multer.memoryStorage() });

export const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ── Batches ──────────────────────────────────────────────────────────────────

app.post("/api/batches", (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados do lote inválidos." });
  }
  try {
    const batch = createBatchIfMissing(parsed.data.name);
    return res.status(201).json(batch);
  } catch (error) {
    return res.status(500).json({ error: "Não foi possível criar o lote.", details: String(error) });
  }
});

app.get("/api/batches", (_req, res) => {
  return res.json({ items: listBatches() });
});

app.post("/api/batches/:batchId/import-csv", upload.single("file"), (req, res) => {
  const params = z.object({ batchId: z.string() }).safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: "ID de lote inválido." });
  }

  if (!req.file?.buffer) {
    return res.status(400).json({ error: "Ficheiro CSV obrigatório." });
  }

  let batchId = Number.parseInt(params.data.batchId, 10);
  if (!Number.isFinite(batchId)) {
    const body = z.object({ batchName: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "ID de lote inválido e nome em falta." });
    }
    batchId = createBatchIfMissing(body.data.batchName).id;
  }

  const batch = getBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: "Lote não encontrado." });
  }

  try {
    const csv = req.file.buffer.toString("utf-8");
    const summary = importCsvToBatch(batch.id, csv);
    return res.json({ batch, summary, defaultBatchId: batch.id });
  } catch (error) {
    return res.status(400).json({ error: "Erro ao importar CSV.", details: String(error) });
  }
});

// ── Products ─────────────────────────────────────────────────────────────────

app.get("/api/products/search", (req, res) => {
  const parsed = z
    .object({
      batchId: z.coerce.number().int().positive(),
      q: z.string().default(""),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Pesquisa inválida." });
  }

  return res.json({ items: searchProducts(parsed.data.batchId, parsed.data.q.trim()) });
});

app.get("/api/products/:id", (req, res) => {
  const parsed = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  const product = getProductById(parsed.data.id);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }
  return res.json(product);
});

// ── Print ─────────────────────────────────────────────────────────────────────

app.post("/api/print-tag", async (req, res) => {
  const schema = z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  const product = getProductById(parsed.data.product_id);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }

  const settings = getSettings();
  const printService = createPrintService(settings);
  const result = await printService.printTag({ product, copies: parsed.data.quantity });
  return res.status(result.ok ? 200 : 503).json(result);
});

// ── Settings ──────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  print_mode: z.enum(["mock", "brother-raster", "system-driver"]).optional(),
  printer_ip: z.string().min(1).optional(),
  printer_port: z.coerce.number().int().min(1).max(65535).optional(),
  printer_model: z.string().min(1).optional(),
  label_width_mm: z.coerce.number().int().refine((v) => v === 12 || v === 24).optional(),
});

app.get("/api/settings", (_req, res) => {
  return res.json(getSettings());
});

app.patch("/api/settings", (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Configurações inválidas.", details: parsed.error.format() });
  }
  try {
    const updated = updateSettings(parsed.data);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao guardar configurações.", details: String(error) });
  }
});
