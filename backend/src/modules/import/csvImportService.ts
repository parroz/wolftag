import { parse } from "csv-parse/sync";
import { type ImportProductRow, upsertProduct } from "../products/productRepository.js";

const HEADER_ALIASES: Record<string, keyof ImportProductRow> = {
  referencia: "referencia",
  descrição: "descricao",
  descricao: "descricao",
  "pvp inicial": "pvp_inicial",
  "baixa %": "baixa_percent",
  "baixa percent": "baixa_percent",
  "pvp promo": "pvp_promo",
};
const REQUIRED_COLUMNS: (keyof ImportProductRow)[] = [
  "referencia",
  "descricao",
  "pvp_inicial",
  "baixa_percent",
  "pvp_promo",
];

export interface ImportErrorItem {
  row: number;
  message: string;
}

export interface CsvImportSummary {
  imported: number;
  skipped: number;
  errors: ImportErrorItem[];
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function parseDecimal(raw: unknown): number | null {
  if (typeof raw !== "string") {
    return null;
  }
  const cleaned = raw.replace(/[€%\s]/g, "").trim();
  if (!cleaned) {
    return null;
  }
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectDelimiter(csvContent: string): "," | ";" {
  const firstLine = csvContent.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function importCsvToBatch(batchId: number, csvContent: string): CsvImportSummary {
  const delimiter = detectDelimiter(csvContent);
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter,
    bom: true,
  }) as Record<string, string>[];

  const summary: CsvImportSummary = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const mapHeaders = new Map<string, string>();
  const firstRecord = records[0] ?? {};
  Object.keys(firstRecord).forEach((header) => {
    mapHeaders.set(normalizeHeader(header), header);
  });
  const aliasesByCanonical = REQUIRED_COLUMNS.reduce<Record<keyof ImportProductRow, string[]>>(
    (acc, canonical) => {
      acc[canonical] = Object.entries(HEADER_ALIASES)
        .filter(([, target]) => target === canonical)
        .map(([alias]) => alias);
      return acc;
    },
    {} as Record<keyof ImportProductRow, string[]>,
  );

  const missingColumns = REQUIRED_COLUMNS.filter((canonical) => {
    return aliasesByCanonical[canonical].every((alias) => !mapHeaders.has(alias));
  });
  if (missingColumns.length > 0) {
    throw new Error(`Colunas CSV obrigatórias em falta: ${missingColumns.join(", ")}`);
  }

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2;
    const source = records[i];
    const getValue = (canonical: keyof ImportProductRow): string => {
      for (const alias of aliasesByCanonical[canonical]) {
        const originalKey = mapHeaders.get(alias);
        if (originalKey) {
          return source[originalKey] ?? "";
        }
      }
      return "";
    };

    const referencia = getValue("referencia").trim();
    const descricao = getValue("descricao").trim();
    const pvpInicial = parseDecimal(getValue("pvp_inicial"));
    const baixaPercent = parseDecimal(getValue("baixa_percent"));
    const pvpPromo = parseDecimal(getValue("pvp_promo"));

    if (!referencia || !descricao || pvpInicial === null || baixaPercent === null || pvpPromo === null) {
      summary.skipped += 1;
      summary.errors.push({
        row: rowNumber,
        message: "Campos obrigatórios em falta ou inválidos.",
      });
      continue;
    }

    upsertProduct(batchId, {
      referencia,
      descricao,
      pvp_inicial: pvpInicial,
      baixa_percent: baixaPercent,
      pvp_promo: pvpPromo,
    });

    summary.imported += 1;
  }

  return summary;
}
