"use client";

/**
 * /dev/design-system — Auri Design System showcase.
 *
 * Renders ALL primitives in light + dark contexts. Used by:
 *  - Designers/devs to verify visual tokens compile correctly
 *  - QA to check WCAG AA contrast ratios
 *  - Reviewers to confirm primitive coverage before consuming them in F1+
 *
 * Always accessible (no NODE_ENV gate) — keeps the URL stable in any env so
 * stakeholders can ping it.
 */

import {
  Avatar,
  AvatarPile,
  Badge,
  Button,
  Card,
  Divider,
  Input,
  Logo,
  Pill,
  Select,
  Spinner,
  StatCard,
  Toggle,
} from "@/design-system/primitives";
import {
  ArrowRightIcon,
  CamIcon,
  CheckIcon,
  DocIcon,
  MicIcon,
  MoonIcon,
  PlusIcon,
  SparkleIcon,
  SunIcon,
} from "@/design-system/icons";
import { useTheme } from "@/design-system/theme/ThemeProvider";
import { useState, type JSX } from "react";

const swatchPalette = [
  { name: "lime", token: "var(--color-lime)" },
  { name: "lime-ink", token: "var(--color-lime-ink)" },
  { name: "cyan", token: "var(--color-cyan)" },
  { name: "cyan-ink", token: "var(--color-cyan-ink)" },
  { name: "lavender", token: "var(--color-lavender)" },
  { name: "lavender-ink", token: "var(--color-lavender-ink)" },
  { name: "amber", token: "var(--color-amber)" },
  { name: "amber-ink", token: "var(--color-amber-ink)" },
  { name: "hero-h0", token: "var(--color-hero-h0)" },
  { name: "hero-h1", token: "var(--color-hero-h1)" },
  { name: "hero-h2", token: "var(--color-hero-h2)" },
  { name: "black", token: "var(--color-black)" },
  { name: "border", token: "var(--color-border)" },
  { name: "bg-soft", token: "var(--color-bg-soft)" },
  { name: "bg-warm", token: "var(--color-bg-warm)" },
  { name: "text", token: "var(--color-text)" },
  { name: "text-mid", token: "var(--color-text-mid)" },
  { name: "text-dim", token: "var(--color-text-dim)" },
];

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 56 }}>
      <header style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            margin: 0,
            color: "var(--color-text)",
          }}
        >
          {title}
        </h2>
        {caption ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: "var(--color-text-mid)",
            }}
          >
            {caption}
          </p>
        ) : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default function DesignSystemPage(): JSX.Element {
  const { resolved, toggle } = useTheme();
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "32px 24px 96px",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 48,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo size={36} variant="wordmark" />
            <Divider vertical style={{ height: 28 }} />
            <span
              style={{
                fontSize: 13,
                color: "var(--color-text-mid)",
                fontWeight: 500,
              }}
            >
              Design System · F0 Foundation
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={resolved === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            onClick={toggle}
          >
            {resolved === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </header>

        {/* HERO */}
        <Section title="Display + Hero" caption="DM Sans 800, letter-spacing -2.2px, line-height 1.04.">
          <div
            className="auri-hero-gradient"
            style={{
              borderRadius: 28,
              padding: "56px 48px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <Pill variant="lime">Auri · Live AI Copilot</Pill>
            <h1
              style={{
                fontSize: 54,
                fontWeight: 800,
                letterSpacing: "-2.2px",
                lineHeight: 1.04,
                margin: 0,
                color: "#ffffff",
                maxWidth: 720,
              }}
            >
              Tu copiloto en cualquier conversación.
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.78)",
                maxWidth: 560,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Asistente IA en tiempo real para entrevistas, reuniones, exámenes orales y
              llamadas con clientes.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <Button variant="primary" trailingIcon={<ArrowRightIcon size={16} />}>
                Empezar gratis
              </Button>
              <Button variant="ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
                Ver demo
              </Button>
            </div>
          </div>
        </Section>

        {/* TYPOGRAPHY */}
        <Section title="Typography" caption="DM Sans + JetBrains Mono.">
          <Card padded>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  Display 54 · -2.2px
                </span>
                <p
                  style={{
                    fontSize: 54,
                    fontWeight: 800,
                    letterSpacing: "-2.2px",
                    lineHeight: 1.04,
                    margin: "4px 0 0",
                  }}
                >
                  Conversación.
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  H1 38 · -1.4px
                </span>
                <p style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.4px", margin: "4px 0 0" }}>
                  Live screen
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  H2 24 · -0.5px
                </span>
                <p style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px", margin: "4px 0 0" }}>
                  Knowledge base
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  Body 16
                </span>
                <p style={{ fontSize: 16, lineHeight: 1.5, margin: "4px 0 0" }}>
                  Auri te asiste en tiempo real durante entrevistas, reuniones, exámenes orales
                  y llamadas con clientes — sin que nadie sepa que está ahí.
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  Caption 13
                </span>
                <p style={{ fontSize: 13, color: "var(--color-text-mid)", margin: "4px 0 0" }}>
                  Captions y metadatos secundarios.
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  Mono 13 · 1.2px
                </span>
                <p
                  className="mono"
                  style={{ fontSize: 13, letterSpacing: "1.2px", margin: "4px 0 0" }}
                >
                  AURI / V0.1.0 / OKLCH
                </p>
              </div>
            </div>
          </Card>
        </Section>

        {/* COLOR SWATCHES */}
        <Section title="Palette (OKLCH)" caption="All tokens — ScenarioColor map: cyan→interview, amber→client/sales, lavender→oral/thesis, lime→personal/brand.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {swatchPalette.map((s) => (
              <div
                key={s.name}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "var(--color-bg)",
                }}
              >
                <div style={{ background: s.token, height: 68 }} />
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--color-text-dim)" }}>
                    {s.token}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* LOGO VARIANTS */}
        <Section title="Logo">
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Logo size={32} variant="mark" boxed />
            <Logo size={48} variant="mark" boxed />
            <Logo size={32} variant="mark" boxed={false} />
            <Divider vertical style={{ height: 60 }} />
            <Logo size={28} variant="wordmark" />
            <Logo size={36} variant="wordmark" />
          </div>
        </Section>

        {/* PILLS */}
        <Section title="Pills" caption="rounded-full · 11/700-800 · letter-spacing 0.6px · uppercase.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Pill variant="lime">Lime</Pill>
            <Pill variant="cyan">Cyan</Pill>
            <Pill variant="lavender">Lavender</Pill>
            <Pill variant="amber">Amber</Pill>
            <Pill variant="violet">Violet</Pill>
            <Pill variant="dark">Dark</Pill>
            <Pill variant="ghost">Ghost</Pill>
          </div>
        </Section>

        {/* BUTTONS */}
        <Section title="Buttons" caption="rounded-full 50px · padding 13/26 · 14/700.">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="dark">Dark</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="sm">
                Small
              </Button>
              <Button variant="primary" size="md">
                Medium
              </Button>
              <Button variant="primary" size="lg">
                Large
              </Button>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" leadingIcon={<SparkleIcon size={16} />}>
                Generate hint
              </Button>
              <Button variant="ghost" trailingIcon={<ArrowRightIcon size={16} />}>
                Continue
              </Button>
              <Button variant="dark" leadingIcon={<MicIcon size={16} />}>
                Start session
              </Button>
            </div>
          </div>
        </Section>

        {/* CARDS */}
        <Section title="Cards" caption="rounded-3xl (~22px) · border 1px o sin borde con bg.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <Card>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Default</h3>
              <p style={{ margin: "8px 0 0", color: "var(--color-text-mid)", fontSize: 14 }}>
                Border + bg neutro.
              </p>
            </Card>
            <Card variant="soft" bordered={false}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Soft (lavender)</h3>
              <p style={{ margin: "8px 0 0", color: "var(--color-text-mid)", fontSize: 14 }}>
                Background bg-soft, sin borde.
              </p>
            </Card>
            <Card variant="warm" bordered={false}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Warm (cream)</h3>
              <p style={{ margin: "8px 0 0", color: "var(--color-text-mid)", fontSize: 14 }}>
                Background bg-warm.
              </p>
            </Card>
            <Card variant="dark" bordered={false}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dark</h3>
              <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                Negro Auri sobre claro.
              </p>
            </Card>
            <Card variant="filled" bordered={false}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Filled (lime)</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14 }}>Highlight de CTA.</p>
            </Card>
          </div>
        </Section>

        {/* STATCARDS */}
        <Section title="StatCards" caption="número 38px peso 700 sobre fill semántico.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <StatCard tone="lime" value="2.4k" label="Sessions" caption="últimas 30 d." />
            <StatCard tone="cyan" value="38" label="Interviews" caption="confianza promedio 92%" />
            <StatCard tone="amber" value="$12" label="Pro" caption="por mes" />
            <StatCard tone="lavender" value="98%" label="Accuracy" caption="STT nova-2 es-419" />
          </div>
        </Section>

        {/* AVATARS */}
        <Section title="Avatars">
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar initials="LD" />
            <Avatar size={44} initials="MA" bg="var(--color-cyan)" fg="var(--color-cyan-ink)" />
            <Avatar size={44} initials="JC" bg="var(--color-amber)" fg="var(--color-amber-ink)" />
            <Avatar size={44} initials="EX" bg="var(--color-lavender)" fg="var(--color-lavender-ink)" />
            <Divider vertical style={{ height: 44 }} />
            <AvatarPile
              size={36}
              items={[
                { initials: "LD", bg: "var(--color-cyan)", fg: "var(--color-cyan-ink)" },
                { initials: "MA", bg: "var(--color-amber)", fg: "var(--color-amber-ink)" },
                { initials: "JC", bg: "var(--color-lavender)", fg: "var(--color-lavender-ink)" },
                { initials: "AX", bg: "var(--color-lime)", fg: "var(--color-lime-ink)" },
                { initials: "RT", bg: "var(--color-hero-h1)", fg: "#fff" },
                { initials: "SS", bg: "var(--color-black)", fg: "var(--color-lime)" },
              ]}
              max={4}
            />
          </div>
        </Section>

        {/* BADGES */}
        <Section title="Badges">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="success" dot>
              Active
            </Badge>
            <Badge tone="warning" dot>
              Trial expiring
            </Badge>
            <Badge tone="danger" dot>
              Payment failed
            </Badge>
            <Badge tone="info">Free tier</Badge>
            <Badge tone="lime">Pro</Badge>
            <Badge tone="neutral">Draft</Badge>
          </div>
        </Section>

        {/* INPUTS */}
        <Section title="Form controls">
          <Card>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Email
                </label>
                <Input placeholder="hola@auri.app" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Idioma
                </label>
                <Select defaultValue="es-419">
                  <option value="es-419">Español (LATAM)</option>
                  <option value="en-US">English (US)</option>
                  <option value="pt-BR">Português (BR)</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Notificaciones
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Toggle
                    checked={toggleA}
                    onChange={setToggleA}
                    ariaLabel="Notificaciones por email"
                  />
                  <span style={{ fontSize: 14, color: "var(--color-text-mid)" }}>
                    Email weekly summary
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <Toggle
                    checked={toggleB}
                    onChange={setToggleB}
                    ariaLabel="Modo silencioso"
                  />
                  <span style={{ fontSize: 14, color: "var(--color-text-mid)" }}>
                    Modo silencioso
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ICONS */}
        <Section title="Icons" caption="Inline SVG · stroke 1.8 · currentColor.">
          <Card>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "var(--color-text)" }}>
              {[
                { name: "MicIcon", el: <MicIcon /> },
                { name: "CamIcon", el: <CamIcon /> },
                { name: "SparkleIcon", el: <SparkleIcon /> },
                { name: "PlusIcon", el: <PlusIcon /> },
                { name: "ArrowRightIcon", el: <ArrowRightIcon /> },
                { name: "CheckIcon", el: <CheckIcon /> },
                { name: "DocIcon", el: <DocIcon /> },
                { name: "SunIcon", el: <SunIcon /> },
                { name: "MoonIcon", el: <MoonIcon /> },
              ].map((it) => (
                <div
                  key={it.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 80,
                  }}
                >
                  {it.el}
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.4px" }}
                  >
                    {it.name}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* SPINNER */}
        <Section title="Spinner">
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Spinner size={16} />
            <Spinner size={20} />
            <Spinner size={28} color="var(--color-lime)" />
          </div>
        </Section>

        {/* PHOTO PLACEHOLDER */}
        <Section title="Photo placeholder" caption="Stripes diagonales 45deg + label mono — Auri visual brief.">
          <div
            className="auri-photo-placeholder"
            style={{
              borderRadius: 22,
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "1.2px",
                color: "var(--color-text-mid)",
                textTransform: "uppercase",
              }}
            >
              Photo · 45° stripes
            </span>
          </div>
        </Section>

        <footer
          className="mono"
          style={{
            marginTop: 64,
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--color-text-dim)",
          }}
        >
          Auri Design System · F0 · {resolved.toUpperCase()} mode
        </footer>
      </div>
    </main>
  );
}
