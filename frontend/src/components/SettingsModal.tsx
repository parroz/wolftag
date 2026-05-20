import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSettings, saveSettings } from "../api";
import type { PrinterSettings } from "../types";

interface SettingsModalProps {
  onClose: () => void;
}

const DEFAULTS: PrinterSettings = {
  print_mode: "mock",
  printer_ip: "192.168.1.122",
  printer_port: 9100,
  printer_model: "PT-P750W",
  label_width_mm: 12,
};

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PrinterSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(setForm)
      .catch(() => setError(t("settings.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(form);
      onClose();
    } catch {
      setError(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const brotherMode = form.print_mode === "brother-raster";

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">
            {t("settings.title")}
          </h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label={t("settings.close")}>
            ✕
          </button>
        </div>

        {loading ? (
          <p className="modal-loading">{t("settings.loading")}</p>
        ) : (
          <div className="modal-body">
            <label>
              {t("settings.printMode")}
              <select
                value={form.print_mode}
                onChange={(e) => set("print_mode", e.target.value as PrinterSettings["print_mode"])}
              >
                <option value="mock">{t("settings.modeMock")}</option>
                <option value="brother-raster">{t("settings.modeBrother")}</option>
                <option value="system-driver">{t("settings.modeSystem")}</option>
              </select>
            </label>

            <div className={`field-group${brotherMode ? "" : " field-group--dimmed"}`}>
              <p className="field-group-label">{t("settings.brotherSection")}</p>

              <label>
                {t("settings.printerIp")}
                <input
                  type="text"
                  value={form.printer_ip}
                  onChange={(e) => set("printer_ip", e.target.value)}
                  placeholder="192.168.1.122"
                  tabIndex={brotherMode ? undefined : -1}
                />
              </label>

              <div className="field-row">
                <label>
                  {t("settings.printerPort")}
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.printer_port}
                    onChange={(e) => set("printer_port", Number(e.target.value))}
                    tabIndex={brotherMode ? undefined : -1}
                  />
                </label>

                <label>
                  {t("settings.labelWidth")}
                  <select
                    value={form.label_width_mm}
                    onChange={(e) => set("label_width_mm", Number(e.target.value) as 12 | 24)}
                    tabIndex={brotherMode ? undefined : -1}
                  >
                    <option value={12}>12 mm</option>
                    <option value={24}>24 mm</option>
                  </select>
                </label>
              </div>

              <label>
                {t("settings.printerModel")}
                <input
                  type="text"
                  value={form.printer_model}
                  onChange={(e) => set("printer_model", e.target.value)}
                  placeholder="PT-P750W"
                  tabIndex={brotherMode ? undefined : -1}
                />
              </label>
            </div>
          </div>
        )}

        {error && <p className="status error" style={{ marginTop: "1rem" }}>{error}</p>}

        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>
            {t("settings.cancel")}
          </button>
          <button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
