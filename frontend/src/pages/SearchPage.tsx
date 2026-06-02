import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { printTag, searchProducts } from "../api";
import type { Batch, Product } from "../types";

interface SearchPageProps {
  batches: Batch[];
  selectedBatchId: number | null;
  onSelectedBatch: (batchId: number) => void;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function variantLabel(product: Product, corLabel: string, tamLabel: string): string {
  return [product.cor && `${corLabel} ${product.cor}`, product.tam && `${tamLabel} ${product.tam}`]
    .filter(Boolean)
    .join(" · ");
}

export function SearchPage(props: SearchPageProps) {
  const { batches, selectedBatchId, onSelectedBatch } = props;
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setResults([]);
      setSelectedProductId(null);
      setMessage(null);
      return;
    }
    if (!selectedBatchId) {
      setMessage(t("search.selectBatchFirst"));
      setResults([]);
      setSelectedProductId(null);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const timeout = setTimeout(async () => {
      setBusy(true);
      setMessage(null);
      setWarning(null);
      try {
        const found = await searchProducts(selectedBatchId, normalized);
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setResults(found);
        if (found.length === 0) {
          setSelectedProductId(null);
          setMessage(t("search.notFound"));
        } else {
          setSelectedProductId(found[0].id);
        }
      } catch (error) {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setMessage(error instanceof Error ? error.message : t("search.searchFailed"));
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setBusy(false);
        }
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [query, selectedBatchId]);

  const selectedProduct = useMemo(
    () => results.find((item) => item.id === selectedProductId) ?? null,
    [results, selectedProductId],
  );

  async function handlePrint() {
    if (!selectedProduct) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setWarning(null);
    try {
      const response = await printTag(selectedProduct.id, quantity);
      if (response.warning) {
        setWarning(response.warning);
      }
      setMessage(response.message);
      setQuery("");
      setResults([]);
      setSelectedProductId(null);
      setQuantity(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("search.printFailed"));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="panel search-panel">
      <div className="top-row">
        <label>
          {t("search.batchLabel")}
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
      </div>

      <div className="search-form">
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.inputPlaceholder")}
          autoComplete="off"
        />
      </div>

      {results.length > 1 && (
        <ul className="results-list">
          {results.map((item) => (
            <li key={item.id}>
              <button
                className={item.id === selectedProductId ? "choice active" : "choice"}
                type="button"
                onClick={() => setSelectedProductId(item.id)}
              >
                {item.referencia} — {item.descricao}
                {variantLabel(item, t("common.cor"), t("common.tam")) && (
                  <span className="choice-variant">
                    {" "}
                    {variantLabel(item, t("common.cor"), t("common.tam"))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedProduct && (
        <section className="product-card">
          <p className="ref-line">{t("common.ref")}: {selectedProduct.referencia}</p>
          <p className="discount">-{Math.round(selectedProduct.baixa_percent)}%</p>
          <p className="promo">{formatEuro(selectedProduct.pvp_promo)}</p>
          <p className="description">{selectedProduct.descricao}</p>
          {variantLabel(selectedProduct, t("common.cor"), t("common.tam")) && (
            <p className="variant-line">
              {variantLabel(selectedProduct, t("common.cor"), t("common.tam"))}
            </p>
          )}
          <p className="ean-line">{t("common.ean")}: {selectedProduct.ean}</p>
          <div className="print-row">
            <label className="qty-field">
              {t("search.quantity")}
              <input
                className="qty-input"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(event) => {
                  const n = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1);
                }}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button className="print-btn" type="button" onClick={handlePrint} disabled={busy}>
              {busy ? t("search.printingButton") : t("search.printButton")}
            </button>
          </div>
        </section>
      )}

      {warning && <p className="status warning">{warning}</p>}
      {message && (
        <p className={`status ${message.toLowerCase().includes("não encontrado") || message.toLowerCase().includes("not found") ? "error" : "ok"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
