import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./database.js";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

// Track applied migrations so each file runs exactly once. Without this, every
// .sql re-executes on every startup — fine for idempotent CREATE IF NOT EXISTS,
// but unsafe for destructive migrations (e.g. table rebuilds).
db.exec(
  `CREATE TABLE IF NOT EXISTS _migrations (
     name TEXT PRIMARY KEY,
     applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
);
const applied = new Set(
  (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((row) => row.name),
);
const record = db.prepare("INSERT INTO _migrations(name) VALUES (?)");

let count = 0;
for (const file of files) {
  if (applied.has(file)) {
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  db.transaction(() => {
    db.exec(sql);
    record.run(file);
  })();
  count += 1;
}

console.log(`Applied ${count} migration(s) (${files.length} total).`);
