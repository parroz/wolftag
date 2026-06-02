import { db } from "../../db/database.js";

export interface Product {
  id: number;
  batch_id: number;
  referencia: string;
  descricao: string;
  cor: string;
  tam: string;
  ean: string;
  pvp_inicial: number;
  baixa_percent: number;
  pvp_promo: number;
  created_at: string;
}

export interface ImportProductRow {
  referencia: string;
  descricao: string;
  cor: string;
  tam: string;
  ean: string;
  pvp_inicial: number;
  baixa_percent: number;
  pvp_promo: number;
}

export function upsertProduct(batchId: number, row: ImportProductRow): void {
  // Keyed on (batch_id, ean): one reference spans many colour/size variants,
  // each with its own EAN. Re-importing the same file updates prices in place.
  db.prepare(
    `
      INSERT INTO products(batch_id, referencia, descricao, cor, tam, ean, pvp_inicial, baixa_percent, pvp_promo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(batch_id, ean) DO UPDATE SET
        referencia = excluded.referencia,
        descricao = excluded.descricao,
        cor = excluded.cor,
        tam = excluded.tam,
        pvp_inicial = excluded.pvp_inicial,
        baixa_percent = excluded.baixa_percent,
        pvp_promo = excluded.pvp_promo
    `,
  ).run(
    batchId,
    row.referencia.trim(),
    row.descricao.trim(),
    row.cor.trim(),
    row.tam.trim(),
    row.ean.trim(),
    row.pvp_inicial,
    row.baixa_percent,
    row.pvp_promo,
  );
}

export function searchProducts(batchId: number, query: string): Product[] {
  const q = query.trim();
  if (!q) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT
          id, batch_id, referencia, descricao, cor, tam, ean, pvp_inicial, baixa_percent, pvp_promo, created_at,
          CASE
            WHEN ean = @q THEN 0
            WHEN lower(referencia) = lower(@q) THEN 0
            WHEN ean LIKE @containsQ THEN 1
            WHEN lower(referencia) LIKE lower(@containsQ) THEN 1
            WHEN lower(descricao) LIKE lower(@containsQ) THEN 2
            ELSE 9
          END AS rank
        FROM products
        WHERE batch_id = @batchId
          AND (
            ean = @q
            OR ean LIKE @containsQ
            OR lower(referencia) = lower(@q)
            OR lower(referencia) LIKE lower(@containsQ)
            OR lower(descricao) LIKE lower(@containsQ)
          )
        ORDER BY rank ASC, referencia ASC, tam ASC
        LIMIT 50
      `,
    )
    .all({
      batchId,
      q,
      containsQ: `%${q}%`,
    }) as Product[];
}

export function getProductById(id: number): Product | undefined {
  return db
    .prepare(
      "SELECT id, batch_id, referencia, descricao, cor, tam, ean, pvp_inicial, baixa_percent, pvp_promo, created_at FROM products WHERE id = ?",
    )
    .get(id) as Product | undefined;
}
