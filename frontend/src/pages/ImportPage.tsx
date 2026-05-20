import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { createBatch, importCsv } from "../api";
import { DropZone } from "../components/DropZone";
import type { Batch } from "../types";

interface ImportPageProps {
  batches: Batch[];
  selectedBatchId: number | null;
  onBatchesReload: () => Promise<void>;
  onSelectedBatch: (batchId: number) => void;
}

export function ImportPage(props: ImportPageProps) {
  const { batches, selectedBatchId, onBatchesReload, onSelectedBatch } = props;
  const { t } = useTranslation();
  const [newBatchName, setNewBatchName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateBatch(event: FormEvent) {
    event.preventDefault();
    if (!newBatchName.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const batch = await createBatch(newBatchName);
      await onBatchesReload();
      onSelectedBatch(batch.id);
      setNewBatchName("");
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : t("import.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault();
    if (!selectedBatchId || !selectedFile) {
      setError(t("import.selectFirst"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await importCsv(selectedBatchId, selectedFile);
      setSummary(result.summary);
      onSelectedBatch(result.defaultBatchId);
      await onBatchesReload();
      setSelectedFile(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : t("import.importFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel import-panel">
      <h2>{t("import.title")}</h2>

      <form className="stack" onSubmit={handleCreateBatch}>
        <label>
          {t("import.newBatchLabel")}
          <input
            value={newBatchName}
            onChange={(event) => setNewBatchName(event.target.value)}
            placeholder={t("import.newBatchPlaceholder")}
          />
        </label>
        <button type="submit" disabled={loading}>
          {t("import.createButton")}
        </button>
      </form>

      <hr className="divider" />

      <form className="stack" onSubmit={handleImport}>
        <label>
          {t("import.activeBatchLabel")}
          <select
            value={selectedBatchId ?? ""}
            onChange={(event) => onSelectedBatch(Number.parseInt(event.target.value, 10))}
          >
            <option value="" disabled>
              {t("common.selectBatch")}
            </option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("import.csvLabel")}
          <DropZone
            accept=".csv,text/csv"
            value={selectedFile}
            onChange={setSelectedFile}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? t("import.importingButton") : t("import.importButton")}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {summary && (
        <section className="summary">
          <p className="summary-heading">{t("import.summaryTitle")}</p>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{summary.imported}</span>
              <span className="stat-label">{t("import.summaryImported")}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{summary.skipped}</span>
              <span className="stat-label">{t("import.summarySkipped")}</span>
            </div>
            {summary.errors.length > 0 && (
              <div className="stat">
                <span className="stat-value" style={{ color: "var(--danger)" }}>
                  {summary.errors.length}
                </span>
                <span className="stat-label">{t("import.summaryErrors")}</span>
              </div>
            )}
          </div>
          {summary.errors.length > 0 && (
            <ul className="error-list">
              {summary.errors.slice(0, 10).map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  {t("import.summaryRow", { row: item.row, message: item.message })}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
