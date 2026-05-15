"use client";

/**
 * TweaksPanel — sidebar with radio-group selectors:
 *   1. Layout (standalone | pip | sidebar)
 *   2. Estilo de transcripción (chat | doc | karaoke)
 *   3. Estilo de hints (cards | chat | sidebar)
 *   4. PiP-only (visible when `layout === "pip"`):
 *      - Opacidad de PiP (slider 0.3 .. 1.0)
 *      - Modo PiP (expandido | compacto)
 *      - Tema PiP (auto | dark | transparente)
 *
 * Plus a "Restablecer defaults" footer button so the user can revert all
 * three core axes at once. Persistence is handled by `tweaks.store.ts`
 * (each axis writes its own localStorage key).
 *
 * The panel itself is purely presentational — it dispatches setters on
 * click, no business logic.
 */

import { useCallback, useEffect, type JSX } from "react";
import { Button, Card } from "@/design-system/primitives";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { useSessionStore } from "@/application/stores/session.store";
import { useScreenOcrStore } from "@/application/stores/screen-ocr.store";
import { useAnalytics } from "@/presentation/hooks/use-analytics";
import { useBilling } from "@/presentation/hooks/use-billing";
import {
  HINT_STYLES,
  LAYOUT_MODES,
  PIP_MODES,
  PIP_OPACITY_MAX,
  PIP_OPACITY_MIN,
  PIP_OPACITY_STEP,
  PIP_THEMES,
  TRANSCRIPT_STYLES,
  type HintStyle,
  type LayoutMode,
  type PipMode,
  type PipTheme,
  type TranscriptStyle,
} from "@/domain/entities/tweaks";
import type { SessionMode } from "@/domain/entities/session";

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  standalone: "Standalone",
  pip: "PiP",
  sidebar: "Sidebar",
};
const HINT_LABELS: Record<HintStyle, string> = {
  cards: "Cards",
  chat: "Chat",
  sidebar: "Sidebar",
};
const TRANSCRIPT_LABELS: Record<TranscriptStyle, string> = {
  chat: "Chat",
  doc: "Documento",
  karaoke: "Karaoke",
};
const PIP_MODE_LABELS: Record<PipMode, string> = {
  expanded: "Expandido",
  compact: "Compacto",
};
const PIP_THEME_LABELS: Record<PipTheme, string> = {
  auto: "Auto",
  dark: "Oscuro",
  transparent: "Transparente",
};

const DEFAULT_LAYOUT: LayoutMode = "standalone";
const DEFAULT_HINT: HintStyle = "cards";
const DEFAULT_TRANSCRIPT: TranscriptStyle = "chat";

interface RadioGroupProps<T extends string> {
  label: string;
  hint?: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}

function RadioGroup<T extends string>({
  label,
  hint,
  options,
  labels,
  value,
  onChange,
}: RadioGroupProps<T>): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        {label}
      </div>
      {hint ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--color-text-dim)",
          }}
        >
          {hint}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className="susurra-btn"
              style={{
                padding: "8px 14px",
                borderRadius: 9999,
                border: `1px solid ${active ? "transparent" : "var(--color-border)"}`,
                background: active ? "var(--color-lime)" : "var(--color-bg)",
                color: active ? "var(--color-lime-ink)" : "var(--color-text)",
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.4px",
                cursor: "pointer",
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              {labels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TweaksPanel(): JSX.Element {
  const layout = useTweaksStore((s) => s.layout);
  const hintStyle = useTweaksStore((s) => s.hintStyle);
  const transcriptStyle = useTweaksStore((s) => s.transcriptStyle);
  const pipOpacity = useTweaksStore((s) => s.pipOpacity);
  const pipMode = useTweaksStore((s) => s.pipMode);
  const pipTheme = useTweaksStore((s) => s.pipTheme);
  const setLayout = useTweaksStore((s) => s.setLayout);
  const setHintStyle = useTweaksStore((s) => s.setHintStyle);
  const setTranscriptStyle = useTweaksStore((s) => s.setTranscriptStyle);
  const setPipOpacity = useTweaksStore((s) => s.setPipOpacity);
  const setPipMode = useTweaksStore((s) => s.setPipMode);
  const setPipTheme = useTweaksStore((s) => s.setPipTheme);
  const ocrEnabled = useScreenOcrStore((s) => s.enabled);
  const setOcrEnabled = useScreenOcrStore((s) => s.setEnabled);
  // `mode` is fixed for the lifetime of the session — TweaksPanel shows
  // a read-only label so the user remembers what they picked. Changing
  // mode mid-session would shift the prompt context drastically.
  const sessionMode = useSessionStore((s) => s.session?.mode ?? null);
  const { track } = useAnalytics();
  // Boot the billing store so we can resolve the user's unlocked tweaks.
  // useBilling is idempotent (StrictMode-safe) and on the live page this
  // is the canonical place to ensure currentPlan is populated.
  const { currentPlan } = useBilling();

  // Tier-aware downgrade for the persisted tweaks. The default is
  // `karaoke` for new users, but free-tier users only unlock `chat`.
  // When the stored / default style is not in the user's unlocked list,
  // silently downgrade to the first allowed style so the UI never shows
  // a locked variant. Runs whenever the unlocked list arrives or changes.
  useEffect(() => {
    if (!currentPlan) return;
    const unlocked = currentPlan.limits.tweaks_transcript_styles_unlocked;
    if (unlocked.length === 0) return;
    if (!unlocked.includes(transcriptStyle)) {
      const fallback = (unlocked.find((s) =>
        (TRANSCRIPT_STYLES as readonly string[]).includes(s),
      ) ?? "chat") as TranscriptStyle;
      setTranscriptStyle(fallback);
    }
    const unlockedHints = currentPlan.limits.tweaks_hint_styles_unlocked;
    if (unlockedHints.length > 0 && !unlockedHints.includes(hintStyle)) {
      const fallback = (unlockedHints.find((s) =>
        (HINT_STYLES as readonly string[]).includes(s),
      ) ?? "cards") as HintStyle;
      setHintStyle(fallback);
    }
    const unlockedLayouts = currentPlan.limits.tweaks_layouts_unlocked;
    if (unlockedLayouts.length > 0 && !unlockedLayouts.includes(layout)) {
      const fallback = (unlockedLayouts.find((s) =>
        (LAYOUT_MODES as readonly string[]).includes(s),
      ) ?? "standalone") as LayoutMode;
      setLayout(fallback);
    }
  }, [
    currentPlan,
    transcriptStyle,
    hintStyle,
    layout,
    setTranscriptStyle,
    setHintStyle,
    setLayout,
  ]);

  const isAtDefaults =
    layout === DEFAULT_LAYOUT &&
    hintStyle === DEFAULT_HINT &&
    transcriptStyle === DEFAULT_TRANSCRIPT;

  const onLayoutChange = useCallback(
    (v: LayoutMode) => {
      setLayout(v);
      track({ name: "tweak_changed", tweak: "layout", value: v });
    },
    [setLayout, track],
  );
  const onHintStyleChange = useCallback(
    (v: HintStyle) => {
      setHintStyle(v);
      track({ name: "tweak_changed", tweak: "hint_style", value: v });
    },
    [setHintStyle, track],
  );
  const onTranscriptStyleChange = useCallback(
    (v: TranscriptStyle) => {
      setTranscriptStyle(v);
      track({ name: "tweak_changed", tweak: "transcript_style", value: v });
    },
    [setTranscriptStyle, track],
  );
  const onOcrToggle = useCallback(
    (v: boolean) => {
      setOcrEnabled(v);
      track({
        name: "tweak_changed",
        tweak: "screen_ocr_enabled",
        value: v ? "on" : "off",
      });
    },
    [setOcrEnabled, track],
  );
  // PiP-only setters. We don't track these via analytics yet — the
  // AnalyticsPort discriminated union only models the three core tweaks
  // (layout/hint/transcript) and bending it for these would require a
  // port change unrelated to this UI quick-win. Local persistence is
  // enough for the user-facing behaviour.
  const onPipOpacityChange = useCallback(
    (v: number) => {
      setPipOpacity(v);
    },
    [setPipOpacity],
  );
  const onPipModeChange = useCallback(
    (v: PipMode) => {
      setPipMode(v);
    },
    [setPipMode],
  );
  const onPipThemeChange = useCallback(
    (v: PipTheme) => {
      setPipTheme(v);
    },
    [setPipTheme],
  );

  const resetDefaults = (): void => {
    setLayout(DEFAULT_LAYOUT);
    setHintStyle(DEFAULT_HINT);
    setTranscriptStyle(DEFAULT_TRANSCRIPT);
  };

  return (
    <Card
      bordered
      padded
      variant="default"
      style={{
        width: 260,
        flex: "0 0 260px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-text-mid)",
            marginBottom: 4,
          }}
        >
          Tweaks
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          Cambiá el modo en vivo. La selección se guarda automáticamente.
        </div>
      </div>

      <RadioGroup<LayoutMode>
        label="Layout"
        hint="Standalone usa la página entera. PiP abre overlay flotante. Sidebar deja la transcripción en la derecha."
        options={LAYOUT_MODES}
        labels={LAYOUT_LABELS}
        value={layout}
        onChange={onLayoutChange}
      />
      <RadioGroup<TranscriptStyle>
        label="Estilo de transcripción"
        options={TRANSCRIPT_STYLES}
        labels={TRANSCRIPT_LABELS}
        value={transcriptStyle}
        onChange={onTranscriptStyleChange}
      />
      <RadioGroup<HintStyle>
        label="Estilo de hints"
        options={HINT_STYLES}
        labels={HINT_LABELS}
        value={hintStyle}
        onChange={onHintStyleChange}
      />

      {/* PiP-only tweaks. Gated on `layout === "pip"` so the panel
          doesn't grow unnecessarily for Standalone/Sidebar users. */}
      {layout === "pip" ? (
        <>
          <OpacitySlider
            value={pipOpacity}
            onChange={onPipOpacityChange}
          />
          <RadioGroup<PipMode>
            label="Modo PiP"
            hint="Expandido muestra transcripción + hints. Compacto deja solo la última sugerencia."
            options={PIP_MODES}
            labels={PIP_MODE_LABELS}
            value={pipMode}
            onChange={onPipModeChange}
          />
          <RadioGroup<PipTheme>
            label="Tema PiP"
            hint="Auto sigue tu sistema. Oscuro fuerza fondo sólido. Transparente usa blur."
            options={PIP_THEMES}
            labels={PIP_THEME_LABELS}
            value={pipTheme}
            onChange={onPipThemeChange}
          />
        </>
      ) : null}

      <OcrToggle enabled={ocrEnabled} onChange={onOcrToggle} />

      {sessionMode ? <ActiveModeLabel mode={sessionMode} /> : null}

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          disabled={isAtDefaults}
          onClick={resetDefaults}
        >
          Restablecer defaults
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// OCR toggle (G1 — beta). Lives here so it shares the Tweaks panel
// surface. The actual capture lifecycle is driven by useScreenOcr in
// SidebarLayout when this flag flips on.
// ---------------------------------------------------------------

interface OcrToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
}

function OcrToggle({ enabled, onChange }: OcrToggleProps): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        OCR de pantalla (beta)
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.4,
          color: "var(--color-text-dim)",
        }}
      >
        Extrae texto visible en tu pantalla cada 5s. El procesamiento OCR
        ocurre en TU navegador, y solo el texto extraído (no la imagen) se
        manda a Susurra para enriquecer las respuestas. Desactivá esto si no
        querés que Susurra use lo que está en pantalla.
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${enabled ? "transparent" : "var(--color-border)"}`,
          background: enabled ? "var(--color-lime)" : "var(--color-bg)",
          color: enabled ? "var(--color-lime-ink)" : "var(--color-text)",
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ cursor: "pointer" }}
        />
        <span
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.4px",
          }}
        >
          {enabled ? "Activado" : "Activar OCR de pantalla"}
        </span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------
// OpacitySlider — controls `tweaks.pipOpacity` (0.3 .. 1.0). Visible
// only when `layout === "pip"`. The slider is `<input type="range">`
// for native keyboard support (arrow keys nudge by `step`).
// ---------------------------------------------------------------

interface OpacitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

function OpacitySlider({ value, onChange }: OpacitySliderProps): JSX.Element {
  const percent = Math.round(value * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-text-mid)",
          }}
        >
          Opacidad de PiP
        </span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {percent}%
        </span>
      </div>
      <input
        type="range"
        min={PIP_OPACITY_MIN}
        max={PIP_OPACITY_MAX}
        step={PIP_OPACITY_STEP}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        aria-label="Opacidad de PiP"
        style={{
          width: "100%",
          accentColor: "var(--color-lime)",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// ActiveModeLabel — read-only indicator for `Session.mode`.
//
// Mode is chosen once in the NewSessionModal and CANNOT be changed
// mid-session (the prompt context shifts drastically, so we'd rather
// the user end + start a new session than let it half-work). The
// label here is purely informational so the user remembers which
// mode they're in while looking at the panel.
// ---------------------------------------------------------------

const MODE_LABELS: Record<SessionMode, string> = {
  agent: "⚡ Agente",
  scribe: "\u{1F4DD} Scribe",
};

function ActiveModeLabel({ mode }: { mode: SessionMode }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        Modo activo
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--color-bg-soft)",
          border: "1px solid var(--color-border)",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {MODE_LABELS[mode]}
      </div>
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: "var(--color-text-dim)",
        }}
      >
        Para cambiar de modo, terminá esta sesión y empezá una nueva.
      </div>
    </div>
  );
}
