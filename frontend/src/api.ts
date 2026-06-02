import type { Batch, PrintResponse, PrinterSettings, Product } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Pedido falhou.");
  }
  return (await response.json()) as T;
}

export async function fetchBatches(): Promise<Batch[]> {
  const response = await fetch(`${API_BASE}/api/batches`);
  const payload = await handleResponse<{ items: Batch[] }>(response);
  return payload.items;
}

export async function createBatch(name: string): Promise<Batch> {
  const response = await fetch(`${API_BASE}/api/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<Batch>(response);
}

export async function importCsv(batchId: number, file: File): Promise<{
  batch: Batch;
  summary: { imported: number; skipped: number; errors: { row: number; message: string }[] };
  defaultBatchId: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/api/batches/${batchId}/import-csv`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(response);
}

export async function searchProducts(batchId: number, q: string): Promise<Product[]> {
  const params = new URLSearchParams({ batchId: String(batchId), q });
  const response = await fetch(`${API_BASE}/api/products/search?${params.toString()}`);
  const payload = await handleResponse<{ items: Product[] }>(response);
  return payload.items;
}

export async function printTag(productId: number): Promise<PrintResponse> {
  const response = await fetch(`${API_BASE}/api/print-tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  });
  return handleResponse<PrintResponse>(response);
}

export async function cutTape(): Promise<PrintResponse> {
  const response = await fetch(`${API_BASE}/api/cut`, { method: "POST" });
  return handleResponse<PrintResponse>(response);
}

export async function fetchSettings(): Promise<PrinterSettings> {
  const response = await fetch(`${API_BASE}/api/settings`);
  return handleResponse<PrinterSettings>(response);
}

export async function saveSettings(patch: Partial<PrinterSettings>): Promise<PrinterSettings> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<PrinterSettings>(response);
}
