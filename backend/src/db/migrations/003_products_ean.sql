-- Rebuild `products` for the EAN-based promo file.
-- New columns from the buying-team export: Referencia, Designacao, Cor, Tam, EAN, PVP, Perc, PPromo.
-- A single `referencia` now spans many colour/size variants (each with a distinct EAN),
-- so `referencia` is no longer unique — `ean` is the per-row key.
-- Destructive: existing promo data is dropped and must be re-imported from the new file.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  referencia TEXT NOT NULL,
  descricao TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '',
  tam TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL,
  pvp_inicial REAL NOT NULL,
  baixa_percent REAL NOT NULL,
  pvp_promo REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_id, ean),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_batch_id ON products(batch_id);
CREATE INDEX idx_products_batch_referencia ON products(batch_id, referencia);
CREATE INDEX idx_products_batch_ean ON products(batch_id, ean);
CREATE INDEX idx_products_batch_descricao ON products(batch_id, descricao);
