"use client";

/**
 * useDocumentUpload — wraps the 3 upload use cases (file/url/text) with a
 * shared loading/error state so the DocumentUploader component can flip
 * between tabs without losing UX consistency.
 *
 * On success the hook adds the new document to the store optimistically
 * and triggers an external `onUploaded` callback so the parent can
 * trigger a refresh (to pick up enriched metadata like uploaded_at).
 */

import { useCallback, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useDocumentsStore } from "@/application/stores/documents.store";
import type {
  UploadFileRequest,
  UploadTextRequest,
  UploadUrlRequest,
} from "@/application/ports/documents-api.port";
import type { DocumentListItem } from "@/domain/entities/document";

interface UseDocumentUploadResult {
  uploading: boolean;
  error: string | null;
  uploadFile: (req: UploadFileRequest) => Promise<DocumentListItem | null>;
  uploadUrl: (req: UploadUrlRequest) => Promise<DocumentListItem | null>;
  uploadText: (req: UploadTextRequest) => Promise<DocumentListItem | null>;
  reset: () => void;
}

export function useDocumentUpload(opts?: {
  onUploaded?: (doc: DocumentListItem) => void;
}): UseDocumentUploadResult {
  const { uploadFileDocument, uploadUrlDocument, uploadTextDocument, analytics } =
    useContainer();
  const addDocument = useDocumentsStore((s) => s.addDocument);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (req: UploadFileRequest): Promise<DocumentListItem | null> => {
      setUploading(true);
      setError(null);
      try {
        const doc = await uploadFileDocument.execute(req);
        addDocument(doc);
        if (doc.docType === "cv") {
          analytics.track({ name: "cv_uploaded", method: "file" });
        }
        opts?.onUploaded?.(doc);
        return doc;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [addDocument, opts, uploadFileDocument, analytics],
  );

  const uploadUrl = useCallback(
    async (req: UploadUrlRequest): Promise<DocumentListItem | null> => {
      setUploading(true);
      setError(null);
      try {
        const doc = await uploadUrlDocument.execute(req);
        addDocument(doc);
        if (doc.docType === "cv") {
          analytics.track({ name: "cv_uploaded", method: "url" });
        }
        opts?.onUploaded?.(doc);
        return doc;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [addDocument, opts, uploadUrlDocument, analytics],
  );

  const uploadText = useCallback(
    async (req: UploadTextRequest): Promise<DocumentListItem | null> => {
      setUploading(true);
      setError(null);
      try {
        const doc = await uploadTextDocument.execute(req);
        addDocument(doc);
        if (doc.docType === "cv") {
          analytics.track({ name: "cv_uploaded", method: "text" });
        }
        opts?.onUploaded?.(doc);
        return doc;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [addDocument, opts, uploadTextDocument, analytics],
  );

  const reset = useCallback(() => {
    setError(null);
    setUploading(false);
  }, []);

  return { uploading, error, uploadFile, uploadUrl, uploadText, reset };
}
