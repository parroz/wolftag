import type { Batch, PrintResponse, PrinterSettings, Product } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const TOKEN_KEY = "wolftag_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Token missing/expired — drop it and bounce back to the login screen.
    clearToken();
    window.location.reload();
    throw new Error("Sessão expirada.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Pedido falhou.");
  }
  return (await response.json()) as T;
}

export async function fetchAuthRequired(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/auth/status`);
  const payload = await handleResponse<{ authRequired: boolean }>(response);
  return payload.authRequired;
}

export async function login(password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  // Don't route through handleResponse: a 401 here means "wrong password",
  // which should surface as an error, not trigger the reload/logout flow.
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Senha incorreta.");
  }
  const payload = (await response.json()) as { token: string };
  setToken(payload.token);
}

export async function fetchBatches(): Promise<Batch[]> {
  const response = await fetch(`${API_BASE}/api/batches`, { headers: authHeaders() });
  const payload = await handleResponse<{ items: Batch[] }>(response);
  return payload.items;
}

export async function createBatch(name: string): Promise<Batch> {
  const response = await fetch(`${API_BASE}/api/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
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
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(response);
}

export async function searchProducts(batchId: number, q: string): Promise<Product[]> {
  const params = new URLSearchParams({ batchId: String(batchId), q });
  const response = await fetch(`${API_BASE}/api/products/search?${params.toString()}`, {
    headers: authHeaders(),
  });
  const payload = await handleResponse<{ items: Product[] }>(response);
  return payload.items;
}

export async function printTag(productId: number, quantity = 1): Promise<PrintResponse> {
  const response = await fetch(`${API_BASE}/api/print-tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ product_id: productId, quantity }),
  });
  return handleResponse<PrintResponse>(response);
}

export async function fetchSettings(): Promise<PrinterSettings> {
  const response = await fetch(`${API_BASE}/api/settings`, { headers: authHeaders() });
  return handleResponse<PrinterSettings>(response);
}

export async function saveSettings(patch: Partial<PrinterSettings>): Promise<PrinterSettings> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return handleResponse<PrinterSettings>(response);
}
