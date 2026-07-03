"use client";

/**
 * UserMenu — avatar with a dropdown menu (Settings + Sign out).
 *
 * F1 ships a minimal menu (just settings + sign out). Future phases add
 * profile, billing, language, etc. The Sign Out action uses the AuthPort
 * abstraction so it works for both Clerk and dev modes (dev is a no-op).
 */

import { useEffect, useRef, useState, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/design-system/primitives";
import { LogOutIcon, SettingsIcon } from "@/design-system/icons";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import { AUTH_MODE } from "@/infrastructure/auth/auth-factory";

function initialsOf(user: { name: string | null; email: string } | null): string {
  if (!user) return "?";
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    const joined = (first + second).toUpperCase();
    if (joined.length > 0) return joined.slice(0, 2);
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function UserMenu(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const { auth } = useContainer();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    // Adapter owns the full logout flow: custom-auth-adapter hits
    // /api/auth/logout (cookies cleared by server) and resets the store;
    // clerk adapter calls Clerk's signOut(); dev adapter is a no-op.
    await auth.signOut();
    if (AUTH_MODE !== "dev") {
      router.replace("/sign-in");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          borderRadius: 9999,
        }}
        title={user?.name ?? user?.email ?? "Cuenta"}
      >
        {user?.avatarUrl ? (
          <Avatar size={36} src={user.avatarUrl} alt={user.name ?? user.email} />
        ) : (
          <Avatar
            size={36}
            initials={initialsOf(user)}
            bg="var(--color-hero-h1)"
            fg="#ffffff"
            alt={user?.name ?? user?.email ?? "User"}
          />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 220,
            background: "var(--color-bg-warm)",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            padding: 6,
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "10px 12px 12px",
              borderBottom: "1px solid var(--color-border)",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {user?.name ?? "Sin nombre"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
              {user?.email ?? "—"}
            </div>
          </div>
          <Link
            href="/app/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--color-text)",
            }}
          >
            <SettingsIcon size={16} />
            Configuración
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--color-text)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <LogOutIcon size={16} />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
