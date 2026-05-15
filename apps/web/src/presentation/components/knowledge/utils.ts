import type { DocType } from "@/domain/entities/document";

/**
 * Map a doc type to a Pill variant (Susurra brand colors). Keeps the visual
 * scenario-color convention consistent: cyan = interview, amber =
 * client/sales, lavender = oral/exam, lime = personal/global.
 */
export function pillVariantForDocType(t: DocType): "cyan" | "amber" | "lavender" | "lime" | "ghost" {
  switch (t) {
    case "cv":
    case "profile":
    case "reference":
      return "lime";
    case "job_offer":
      return "amber";
    case "meeting_brief":
      return "cyan";
    case "exam_syllabus":
    case "persona":
      return "lavender";
    case "other":
    default:
      return "ghost";
  }
}

/** Format a byte/char count to a short human-readable string. */
export function formatSize(chars: number): string {
  if (chars < 1000) return `${chars} c`;
  if (chars < 1_000_000) return `${(chars / 1000).toFixed(1)}k c`;
  return `${(chars / 1_000_000).toFixed(2)}M c`;
}

/** Format an ISO timestamp as a short Spanish-locale relative date. */
export function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

export const ACCEPTED_FILE_EXTENSIONS = ".pdf,.docx,.md,.markdown,.txt";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Pre-flight check before kicking off the upload. Mirrors backend. */
export function validateFileForUpload(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `El archivo supera el límite de 10 MB (pesa ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  const name = file.name.toLowerCase();
  const allowed = [".pdf", ".docx", ".md", ".markdown", ".txt"];
  if (!allowed.some((ext) => name.endsWith(ext))) {
    return "Formato no soportado. Usá PDF, DOCX, Markdown o TXT.";
  }
  return null;
}
