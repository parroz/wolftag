PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  referencia TEXT NOT NULL,
  descricao TEXT NOT NULL,
  pvp_inicial REAL NOT NULL,
  baixa_percent REAL NOT NULL,
  pvp_promo REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_id, referencia),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_batch_referencia ON products(batch_id, referencia);
CREATE INDEX IF NOT EXISTS idx_products_batch_descricao ON products(batch_id, descricao);
