import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";

interface DropZoneProps {
  accept: string;
  value: File | null;
  onChange: (file: File | null) => void;
}

function UploadIcon() {
  return (
    <svg className="drop-zone__icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="drop-zone__check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function DropZone({ accept, value, onChange }: DropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onChange(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  const classes = [
    "drop-zone",
    dragging ? "drop-zone--active" : "",
    value ? "drop-zone--filled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="button"
      tabIndex={0}
      aria-label={t("import.dropZoneLabel")}
      onClick={() => !value && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !value && inputRef.current?.click()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{ display: "none" }}
        tabIndex={-1}
      />

      {value ? (
        <>
          <CheckIcon />
          <span className="drop-zone__filename">{value.name}</span>
          <button
            className="drop-zone__clear"
            type="button"
            onClick={handleClear}
            aria-label={t("import.dropZoneClear")}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <UploadIcon />
          <span className="drop-zone__label">{t("import.dropZoneLabel")}</span>
          <span className="drop-zone__hint">{t("import.dropZoneHint")}</span>
        </>
      )}
    </div>
  );
}
