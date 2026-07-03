"use client";

/**
 * ShortcutsSection — read-only display of the global keyboard shortcuts.
 *
 * F6 ships them as static documentation. F-future will let users
 * override the bindings (the backend already persists
 * `keyboard_shortcuts` as a JSON map on UserPreferences, so the API
 * surface is ready when the feature lands).
 */

import type { JSX } from "react";
import { Pill } from "@/design-system/primitives";
import { SettingsSection } from "./SettingsSection";

interface ShortcutEntry {
  keys: readonly string[];
  description: string;
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: ["⌘", "⇧", "S"], description: "Mostrar / ocultar overlay PiP" },
  { keys: ["⌘", "K"], description: "Buscar en la base de conocimiento" },
  { keys: ["⌘", "."], description: "Iniciar / detener una sesión" },
  { keys: ["⌘", "↵"], description: "Pedir un hint al asistente" },
  { keys: ["ESC"], description: "Cerrar el modal abierto" },
];

function KeyCap({ children }: { children: string }): JSX.Element {
  return (
    <kbd
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        background: "var(--color-bg-soft)",
        color: "var(--color-text)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "3px 8px",
        minWidth: 24,
        textAlign: "center",
        display: "inline-block",
        lineHeight: 1.2,
      }}
    >
      {children}
    </kbd>
  );
}

export function ShortcutsSection(): JSX.Element {
  return (
    <SettingsSection
      title="Atajos de teclado"
      description="Los atajos globales que ya están activos en Susurra."
      trailing={<Pill variant="ghost">Pronto: editables</Pill>}
    >
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {SHORTCUTS.map((s) => (
          <li
            key={s.description}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span style={{ fontSize: 14, color: "var(--color-text)" }}>
              {s.description}
            </span>
            <span style={{ display: "inline-flex", gap: 6 }}>
              {s.keys.map((k, i) => (
                <KeyCap key={`${s.description}-${i}`}>{k}</KeyCap>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
