"use client";

/**
 * ThemeToggle — cycles theme through light → dark → system → light.
 *
 * Uses the F0 `useTheme` hook directly so persistence (localStorage) and
 * media-query subscription stay owned by the design system (where the
 * primitive lives). This component is a thin presentation binding.
 */

import type { JSX } from "react";
import { useTheme, type Theme } from "@/design-system/theme/ThemeProvider";
import { MoonIcon, SunIcon, MonitorIcon } from "@/design-system/icons";

const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();

  const onClick = () => setTheme(NEXT_THEME[theme]);

  const icon =
    theme === "system" ? (
      <MonitorIcon size={16} />
    ) : theme === "dark" ? (
      <MoonIcon size={16} />
    ) : (
      <SunIcon size={16} />
    );

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Tema: ${THEME_LABEL[theme]} — click para cambiar`}
      aria-label={`Cambiar tema (actual: ${THEME_LABEL[theme]})`}
      className="auri-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 9999,
        border: "1px solid var(--color-border)",
        background: "transparent",
        color: "var(--color-text)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {icon}
      <span style={{ fontSize: 12 }}>{THEME_LABEL[theme]}</span>
    </button>
  );
}
