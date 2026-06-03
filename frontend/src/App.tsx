import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { clearToken, fetchAuthRequired, fetchBatches, getToken } from "./api";
import "./App.css";
import { SettingsModal } from "./components/SettingsModal";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { SearchPage } from "./pages/SearchPage";
import type { Batch } from "./types";

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function App() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authed, setAuthed] = useState(false);

  const reloadBatches = async () => {
    try {
      const list = await fetchBatches();
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
      if (list.length > 0 && selectedBatchId && !list.some((item) => item.id === selectedBatchId)) {
        setSelectedBatchId(list[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("app.loadError"));
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const required = await fetchAuthRequired();
        setAuthRequired(required);
        setAuthed(!required || Boolean(getToken()));
      } catch {
        setAuthed(Boolean(getToken()));
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (authed) {
      void reloadBatches();
    }
  }, [authed]);

  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  if (!authReady) {
    return null;
  }

  if (!authed) {
    return <LoginPage onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="app-logo" aria-label="WolfTag">
          <img src="/wolftag.png" alt="" className="app-logo-img" />
          <span className="app-logo-text">WolfTag</span>
        </a>
        <div className="header-right">
          <button
            className="settings-btn"
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t("settings.title")}
          >
            <GearIcon />
          </button>
          <nav className="app-nav">
            <NavLink to="/import">{t("nav.import")}</NavLink>
            <NavLink to="/search">{t("nav.search")}</NavLink>
          </nav>
          {authRequired && (
            <button className="logout-btn" type="button" onClick={handleLogout}>
              {t("app.logout")}
            </button>
          )}
        </div>
      </header>

      {error && <p className="status error">{error}</p>}

      <main>
        <Routes>
          <Route
            path="/import"
            element={
              <ImportPage
                batches={batches}
                selectedBatchId={selectedBatchId}
                onSelectedBatch={setSelectedBatchId}
                onBatchesReload={reloadBatches}
              />
            }
          />
          <Route
            path="/search"
            element={
              <SearchPage
                batches={batches}
                selectedBatchId={selectedBatchId}
                onSelectedBatch={setSelectedBatchId}
              />
            }
          />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default App;
