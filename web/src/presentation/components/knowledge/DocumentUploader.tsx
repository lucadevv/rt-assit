"use client";

/**
 * DocumentUploader — 3-tab uploader (File / URL / Text) for the Knowledge
 * Base.
 *
 * - File tab: drag&drop + click-to-browse. Accepts PDF/DOCX/MD/TXT, max 10MB.
 *   Pre-flight validation surfaces errors before the network round-trip.
 * - URL tab: text input + submit; backend handles fetch + extraction.
 * - Text tab: title + textarea; ideal for portals that block scraping.
 *
 * Shared concerns:
 *  - DocTypeSelect picks the document type.
 *  - ScenarioScopeRadio decides global vs scenario-bound (FR-38).
 *  - Loading / error / success states surface inline (no toast lib in F3).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, DragEvent, JSX } from "react";
import { Card, Button, Input, Pill } from "@/design-system/primitives";
import { PlusIcon, CheckIcon, XIcon } from "@/design-system/icons";
import {
  type DocType,
  isGlobalOnlyDocType,
} from "@/domain/entities/document";
import { useDocumentUpload } from "@/presentation/hooks/use-document-upload";
import { DocTypeSelect } from "./DocTypeSelect";
import {
  ScenarioScopeRadio,
  type ScenarioScopeValue,
} from "./ScenarioScopeRadio";
import {
  ACCEPTED_FILE_EXTENSIONS,
  validateFileForUpload,
} from "./utils";

type Tab = "file" | "url" | "text";

interface DocumentUploaderProps {
  currentScenarioId: string | null;
  currentScenarioLabel?: string | null;
  onUploaded?: () => void;
}

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "10px 18px",
  borderRadius: 999,
  border: active ? "1px solid var(--color-text)" : "1px solid var(--color-border)",
  background: active ? "var(--color-text)" : "transparent",
  color: active ? "var(--color-bg)" : "var(--color-text)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "-0.1px",
});

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  color: "var(--color-text-mid)",
  marginBottom: 6,
  fontFamily: "var(--font-jet-brains-mono), ui-monospace, monospace",
};

export function DocumentUploader({
  currentScenarioId,
  currentScenarioLabel,
  onUploaded,
}: DocumentUploaderProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("file");
  const [docType, setDocType] = useState<DocType>("cv");
  const [scope, setScope] = useState<ScenarioScopeValue>("global");
  const [success, setSuccess] = useState<string | null>(null);

  // file state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // url state
  const [url, setUrl] = useState("");

  // text state
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");

  const { uploading, error, uploadFile, uploadUrl, uploadText, reset } =
    useDocumentUpload({
      onUploaded: () => {
        onUploaded?.();
      },
    });

  // Auto-fix scope if doc type forces it global.
  useEffect(() => {
    if (isGlobalOnlyDocType(docType)) {
      setScope("global");
    }
  }, [docType]);

  const resolvedScenario = useMemo<string | null>(() => {
    if (isGlobalOnlyDocType(docType)) return null;
    if (scope === "global") return null;
    return currentScenarioId;
  }, [docType, scope, currentScenarioId]);

  const switchTab = useCallback(
    (next: Tab) => {
      setTab(next);
      setSuccess(null);
      reset();
    },
    [reset],
  );

  const handleSelectFile = useCallback((next: File | null) => {
    setFile(next);
    setFileError(null);
    if (next) {
      const err = validateFileForUpload(next);
      if (err) {
        setFileError(err);
      }
    }
  }, []);

  const onFilePicked = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      handleSelectFile(f);
    },
    [handleSelectFile],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0] ?? null;
      handleSelectFile(f);
    },
    [handleSelectFile],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const submitFile = useCallback(async () => {
    if (!file) return;
    if (fileError) return;
    setSuccess(null);
    const result = await uploadFile({
      file,
      docType,
      scenario: resolvedScenario,
    });
    if (result) {
      setSuccess(`Listo: "${result.title}" se subió.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [file, fileError, uploadFile, docType, resolvedScenario]);

  const submitUrl = useCallback(async () => {
    if (!url.trim()) return;
    setSuccess(null);
    const result = await uploadUrl({
      url: url.trim(),
      docType,
      scenario: resolvedScenario,
    });
    if (result) {
      setSuccess(`Listo: "${result.title}" se importó desde la URL.`);
      setUrl("");
    }
  }, [url, uploadUrl, docType, resolvedScenario]);

  const submitText = useCallback(async () => {
    if (!textTitle.trim() || !textBody.trim()) return;
    setSuccess(null);
    const result = await uploadText({
      title: textTitle.trim(),
      text: textBody,
      docType,
      scenario: resolvedScenario,
    });
    if (result) {
      setSuccess(`Listo: "${result.title}" se guardó.`);
      setTextTitle("");
      setTextBody("");
    }
  }, [textTitle, textBody, uploadText, docType, resolvedScenario]);

  return (
    <Card padded={true}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Pill variant="lime">F3 · Knowledge Base</Pill>
          <h2
            style={{
              margin: "8px 0 0",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.4px",
            }}
          >
            Sumá un nuevo documento
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={tabButtonStyle(tab === "file")}
            onClick={() => switchTab("file")}
          >
            Archivo
          </button>
          <button
            type="button"
            style={tabButtonStyle(tab === "url")}
            onClick={() => switchTab("url")}
          >
            Desde URL
          </button>
          <button
            type="button"
            style={tabButtonStyle(tab === "text")}
            onClick={() => switchTab("text")}
          >
            Pegar texto
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {tab === "file" ? (
          <FilePanel
            file={file}
            fileError={fileError}
            dragOver={dragOver}
            inputRef={inputRef}
            onFilePicked={onFilePicked}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            clearFile={() => handleSelectFile(null)}
          />
        ) : null}

        {tab === "url" ? (
          <div>
            <label htmlFor="kb-url-input" style={fieldLabelStyle}>
              URL del documento
            </label>
            <Input
              id="kb-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… (LinkedIn job, Google Doc público, etc.)"
            />
          </div>
        ) : null}

        {tab === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label htmlFor="kb-text-title" style={fieldLabelStyle}>
                Título
              </label>
              <Input
                id="kb-text-title"
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Ej: Brief para reunión de cliente"
              />
            </div>
            <div>
              <label htmlFor="kb-text-body" style={fieldLabelStyle}>
                Contenido
              </label>
              <textarea
                id="kb-text-body"
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Pegá acá el contenido del documento…"
                rows={8}
                style={{
                  width: "100%",
                  fontFamily:
                    "var(--font-dm-sans), system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  outline: "none",
                  resize: "vertical",
                  minHeight: 160,
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr)",
            gap: 16,
          }}
        >
          <div>
            <label htmlFor="kb-doctype" style={fieldLabelStyle}>
              Tipo de documento
            </label>
            <DocTypeSelect
              id="kb-doctype"
              value={docType}
              onChange={setDocType}
              disabled={uploading}
            />
          </div>
          <ScenarioScopeRadio
            value={scope}
            onChange={setScope}
            docType={docType}
            currentScenarioId={currentScenarioId}
            currentScenarioLabel={currentScenarioLabel ?? null}
            idPrefix="kb-uploader"
          />
        </div>

        {error ? (
          <div
            role="alert"
            style={{
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.4)",
              borderRadius: 12,
              padding: "10px 14px",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            <strong>Hubo un problema:</strong> {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--color-bg-soft)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            <CheckIcon size={14} />
            {success}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {tab === "file" ? (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<PlusIcon size={14} />}
              disabled={!file || !!fileError || uploading}
              onClick={() => void submitFile()}
            >
              {uploading ? "Subiendo…" : "Subir archivo"}
            </Button>
          ) : null}
          {tab === "url" ? (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<PlusIcon size={14} />}
              disabled={!url.trim() || uploading}
              onClick={() => void submitUrl()}
            >
              {uploading ? "Importando…" : "Importar desde URL"}
            </Button>
          ) : null}
          {tab === "text" ? (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<PlusIcon size={14} />}
              disabled={!textTitle.trim() || !textBody.trim() || uploading}
              onClick={() => void submitText()}
            >
              {uploading ? "Guardando…" : "Guardar texto"}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

interface FilePanelProps {
  file: File | null;
  fileError: string | null;
  dragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilePicked: (e: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  clearFile: () => void;
}

function FilePanel({
  file,
  fileError,
  dragOver,
  inputRef,
  onFilePicked,
  onDrop,
  onDragOver,
  onDragLeave,
  clearFile,
}: FilePanelProps): JSX.Element {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label="Soltá un archivo o hacé click para seleccionar"
      style={{
        border: dragOver
          ? "2px dashed var(--color-text)"
          : "2px dashed var(--color-border)",
        borderRadius: 18,
        padding: 32,
        textAlign: "center",
        cursor: "pointer",
        background: dragOver ? "var(--color-bg-soft)" : "transparent",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_EXTENSIONS}
        onChange={onFilePicked}
        style={{ display: "none" }}
      />
      {!file ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <PlusIcon size={28} />
          <strong style={{ fontSize: 15 }}>
            Soltá un archivo o hacé click para elegir
          </strong>
          <span style={{ fontSize: 13, color: "var(--color-text-mid)" }}>
            Aceptamos PDF, DOCX, Markdown y TXT — hasta 10 MB.
          </span>
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            background: "var(--color-bg)",
            borderRadius: 14,
            border: "1px solid var(--color-border)",
            cursor: "default",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Quitar archivo"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: 999,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text)",
            }}
          >
            <XIcon size={14} />
          </button>
        </div>
      )}
      {fileError ? (
        <div
          role="alert"
          style={{
            marginTop: 12,
            color: "oklch(58% 0.22 25)",
            fontSize: 13,
          }}
        >
          {fileError}
        </div>
      ) : null}
    </div>
  );
}
