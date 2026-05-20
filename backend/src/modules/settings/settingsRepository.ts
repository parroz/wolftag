import { db } from "../../db/database.js";
import { env } from "../../config/env.js";

export interface PrinterSettings {
  print_mode: "mock" | "brother-raster" | "system-driver";
  printer_ip: string;
  printer_port: number;
  printer_model: string;
  label_width_mm: number;
}

interface SettingsRow extends PrinterSettings {
  id: number;
  updated_at: string;
}

function envDefaults(): PrinterSettings {
  return {
    print_mode: env.PRINT_MODE,
    printer_ip: env.PRINTER_IP,
    printer_port: env.PRINTER_PORT,
    printer_model: env.PRINTER_MODEL,
    label_width_mm: env.LABEL_WIDTH_MM,
  };
}

export function getSettings(): PrinterSettings {
  try {
    const row = db
      .prepare("SELECT * FROM printer_settings WHERE id = 1")
      .get() as SettingsRow | undefined;
    if (!row) return envDefaults();
    return {
      print_mode: row.print_mode,
      printer_ip: row.printer_ip,
      printer_port: row.printer_port,
      printer_model: row.printer_model,
      label_width_mm: row.label_width_mm,
    };
  } catch {
    return envDefaults();
  }
}

export function updateSettings(patch: Partial<PrinterSettings>): PrinterSettings {
  const current = getSettings();
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE printer_settings SET
      print_mode    = ?,
      printer_ip    = ?,
      printer_port  = ?,
      printer_model = ?,
      label_width_mm = ?,
      updated_at    = CURRENT_TIMESTAMP
    WHERE id = 1`,
  ).run(
    next.print_mode,
    next.printer_ip,
    next.printer_port,
    next.printer_model,
    next.label_width_mm,
  );
  return next;
}
