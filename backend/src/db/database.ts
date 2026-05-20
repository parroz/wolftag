import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "../config/env.js";

const dbDir = path.dirname(env.DB_PATH);
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(env.DB_PATH);
db.pragma("foreign_keys = ON");
