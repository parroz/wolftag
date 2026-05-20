import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_PATH: z
    .string()
    .default(path.join(process.cwd(), "data", "app.db")),
  PRINTER_IP: z.string().default("192.168.1.122"),
  PRINTER_PORT: z.coerce.number().default(9100),
  PRINTER_MODEL: z.string().default("PT-P750W"),
  LABEL_WIDTH_MM: z.coerce.number().default(12),
  PRINT_MODE: z
    .enum(["mock", "brother-raster", "system-driver"])
    .default("mock"),
});

export const env = envSchema.parse(process.env);
