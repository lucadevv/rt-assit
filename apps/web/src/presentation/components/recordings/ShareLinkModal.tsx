"use client";

/**
 * ShareLinkModal — Premium-gated dialog for creating + managing share
 * links on a session.
 *
 * Visual / UX:
 *  - Full-screen overlay with backdrop (ESC + click outside close).
 *  - alertdialog role + focus trap + body scroll lock (mirrors
 *    CancelConfirmModal for consistency).
 *  - Form: permissions select + expiration select + "Generar link" CTA.
 *  - Existing links list: copy URL + revoke. Revoked links show a ghost
 *    pill instead of an active actions bar.
 *
 * Tier gate: if `gateAvailable=false`, render the UpgradeBanner instead
 * of the form, but still allow the modal to be closed.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import type {
  ShareLink,
  SharePermissions,
} from "@/domain/entities/share-link";
import { isShareLinkActive } from "@/domain/entities/share-link";
import { UpgradeBanner } from "@/presentation/components/billing/UpgradeBanner";
import { FocusTrap } from "@/presentation/components/a11y/FocusTrap";
import type { RequiredTier } from "@/application/use-cases/check-feature-availability";
import { formatDateLong, permissionsLabel } from "./utils";

interface ShareLinkModalProps {
  open: boolean;
  links: ShareLink[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
  revoking: Record<string, boolean>;
  /** When false, renders the upgrade banner instead of the form. */
  gateAvailable: boolean;
  gateRequiredTier: RequiredTier | null;
  onCreate: (input: {
    permissions: SharePermissions;
    expiresInHours: number | null;
  }) => Promise<ShareLink | null>;
  onRevoke: (linkId: string) => Promise<boolean>;
  onClose: () => void;
}

const EXPIRY_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: "1 día", hours: 24 },
  { label: "7 días", hours: 24 * 7 },
  { label: "30 días", hours: 24 * 30 },
  { label: "Sin expiración", hours: null },
];

export function ShareLinkModal({
  open,
  links,
  loading,
  error,
  creating,
  createError,
  revoking,
  gateAvailable,
  gateRequiredTier,
  onCreate,
  onRevoke,
  onClose,
}: ShareLinkModalProps): JSX.Element | null {
  const [permissions, setPermissions] =
    useState<SharePermissions>("transcript_only");
  const [expiryIdx, setExpiryIdx] = useState(1); // default 7 días
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !creating) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, creating]);

  if (!open) return null;

  const handleCreate = async (): Promise<void> => {
    const exp = EXPIRY_OPTIONS[expiryIdx];
    if (!exp) return;
    await onCreate({ permissions, expiresInHours: exp.hours });
  };

  const handleCopy = async (link: ShareLink): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link.publicUrl);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard may be blocked in unsecured contexts — fall back to
      // selecting the URL text on the modal.
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 22, 0.65)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
      }}
    >
      <FocusTrap onEscape={creating ? undefined : onClose}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          boxShadow: "0 24px 60px rgba(8, 6, 22, 0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h2
            id="share-modal-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.4px",
            }}
          >
            Compartir grabación
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: creating ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              opacity: creating ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ padding: 20, overflow: "auto" }}>
          {!gateAvailable && gateRequiredTier ? (
            <UpgradeBanner
              feature="links públicos"
              requiredTier={gateRequiredTier}
              description="Generá links públicos sin login para compartir esta grabación."
            />
          ) : (
            <>
              <fieldset
                disabled={creating}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 16,
                  padding: 16,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <legend
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "0 8px",
                    color: "var(--color-text)",
                  }}
                >
                  Generar link nuevo
                </legend>

                <div>
                  <label style={fieldLabelStyle}>Permisos</label>
                  <div
                    role="radiogroup"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {(
                      [
                        "transcript_only",
                        "with_audio",
                        "edit",
                      ] as SharePermissions[]
                    ).map((p) => (
                      <label
                        key={p}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          border: `1px solid ${
                            permissions === p
                              ? "var(--color-lime)"
                              : "var(--color-border)"
                          }`,
                          borderRadius: 12,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="radio"
                          name="share-perms"
                          checked={permissions === p}
                          onChange={() => setPermissions(p)}
                        />
                        {permissionsLabel(p)}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={fieldLabelStyle} htmlFor="share-expiry">
                    Expira en
                  </label>
                  <select
                    id="share-expiry"
                    value={expiryIdx}
                    onChange={(e) => setExpiryIdx(Number(e.target.value))}
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                      fontSize: 14,
                      background: "var(--color-bg)",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      padding: "10px 14px",
                      width: "100%",
                    }}
                  >
                    {EXPIRY_OPTIONS.map((opt, idx) => (
                      <option key={opt.label} value={idx}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {createError ? (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--color-amber-ink)",
                      background: "var(--color-amber)",
                      padding: "8px 12px",
                      borderRadius: 12,
                    }}
                  >
                    {createError}
                  </p>
                ) : null}

                <Button
                  variant="primary"
                  size="md"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                >
                  {creating ? "Creando…" : "Generar link"}
                </Button>
              </fieldset>

              <section style={{ marginTop: 20 }}>
                <h3
                  style={{
                    margin: "0 0 10px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  Links existentes
                </h3>

                {error ? (
                  <p
                    role="alert"
                    style={{
                      margin: "0 0 10px",
                      fontSize: 12,
                      color: "var(--color-amber-ink)",
                      background: "var(--color-amber)",
                      padding: "6px 10px",
                      borderRadius: 10,
                    }}
                  >
                    {error}
                  </p>
                ) : null}

                {loading ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--color-text-mid)",
                    }}
                  >
                    Cargando links…
                  </p>
                ) : links.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--color-text-mid)",
                    }}
                  >
                    Todavía no creaste ningún link para esta grabación.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {links.map((link) => {
                      const active = isShareLinkActive(link);
                      const isRevoking = revoking[link.id] === true;
                      return (
                        <li
                          key={link.id}
                          style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: 14,
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            background: active
                              ? "var(--color-bg)"
                              : "var(--color-bg-soft)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <Pill variant={active ? "lime" : "ghost"}>
                              {active ? "Activo" : "Revocado"}
                            </Pill>
                            <Pill variant="ghost">
                              {permissionsLabel(link.permissions)}
                            </Pill>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--color-text-dim)",
                              }}
                            >
                              {link.viewCount} vistas
                            </span>
                            {link.expiresAt ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--color-text-dim)",
                                }}
                              >
                                expira {formatDateLong(link.expiresAt)}
                              </span>
                            ) : null}
                          </div>
                          <code
                            style={{
                              fontFamily:
                                "var(--font-jetbrains-mono), ui-monospace, monospace",
                              fontSize: 11,
                              color: "var(--color-text-mid)",
                              background: "var(--color-bg-soft)",
                              padding: "6px 8px",
                              borderRadius: 8,
                              wordBreak: "break-all",
                            }}
                          >
                            {link.publicUrl}
                          </code>
                          {active ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleCopy(link)}
                              >
                                {copiedId === link.id ? "¡Copiado!" : "Copiar"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isRevoking}
                                onClick={() => void onRevoke(link.id)}
                              >
                                {isRevoking ? "Revocando…" : "Revocar"}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

const fieldLabelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--color-text-mid)",
  margin: "0 0 6px",
  letterSpacing: "0.4px",
  textTransform: "uppercase" as const,
};
