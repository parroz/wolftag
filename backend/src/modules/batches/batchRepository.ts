import { db } from "../../db/database.js";

export interface Batch {
  id: number;
  name: string;
  created_at: string;
}

export function createBatch(name: string): Batch {
  const trimmed = name.trim();
  const insert = db
    .prepare("INSERT INTO batches(name) VALUES (?) RETURNING id, name, created_at")
    .get(trimmed) as Batch;
  return insert;
}

export function getBatchById(batchId: number): Batch | undefined {
  return db
    .prepare("SELECT id, name, created_at FROM batches WHERE id = ?")
    .get(batchId) as Batch | undefined;
}

export function getBatchByName(name: string): Batch | undefined {
  return db
    .prepare("SELECT id, name, created_at FROM batches WHERE name = ?")
    .get(name.trim()) as Batch | undefined;
}

export function createBatchIfMissing(name: string): Batch {
  const existing = getBatchByName(name);
  if (existing) {
    return existing;
  }
  return createBatch(name);
}

export function listBatches(): Batch[] {
  return db
    .prepare("SELECT id, name, created_at FROM batches ORDER BY datetime(created_at) DESC, id DESC")
    .all() as Batch[];
}
