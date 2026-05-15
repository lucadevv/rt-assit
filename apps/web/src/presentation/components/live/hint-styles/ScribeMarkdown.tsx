"use client";

/**
 * ScribeMarkdown — lightweight inline renderer used when
 * `session.mode === "scribe"`. The backend prompt template emits
 * structured markdown (bold headers with the 📝 🎯 ⚖️ 📅 ❓ topic
 * emojis, bullets, occasional double-asterisk inline emphasis).
 *
 * Why a hand-rolled renderer and not `react-markdown`:
 *   - `react-markdown` is NOT in package.json (verified at integration
 *     time). Pulling in a new dep + remark/rehype just for the scribe
 *     branch felt heavy; the supported syntax is small and bounded.
 *   - The contract with the I1 backend prompt only uses three primitives:
 *       1. Lines starting with `**…**:` → bold "topic header" lines.
 *       2. Lines starting with `- ` (or `* `) → list bullets.
 *       3. Inline `**…**` runs → bold spans.
 *     Anything else renders as a plain paragraph.
 *
 * The component is purely presentational. The block grouping logic is
 * a small state machine over the source lines so consecutive bullets
 * collapse into a single <ul>, mirroring CommonMark semantics.
 */

import type { CSSProperties, JSX } from "react";

interface ScribeMarkdownProps {
  content: string;
}

/**
 * Render a single line that may contain inline `**bold**` runs as a
 * span tree. Splits on the bold delimiter and toggles emphasis between
 * tokens. Empty bold runs are preserved as empty fragments so the
 * source position is honoured (very rare in the scribe template).
 */
function renderInline(line: string): JSX.Element[] {
  const parts = line.split(/\*\*/);
  const out: JSX.Element[] = [];
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i] ?? "";
    if (i % 2 === 1) {
      out.push(
        <strong key={i} style={{ fontWeight: 700, color: "var(--color-text)" }}>
          {text}
        </strong>,
      );
    } else {
      out.push(<span key={i}>{text}</span>);
    }
  }
  return out;
}

type Block =
  | { kind: "p"; line: string }
  | { kind: "ul"; items: string[] };

/**
 * Tokenise the raw string into a list of paragraph / unordered-list
 * blocks. Blank lines just terminate the current bullet run — they
 * don't surface as their own block, which keeps the rendered layout
 * tight (no awkward vertical gaps between bullets and the next header).
 */
function tokenise(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let bulletBuffer: string[] | null = null;

  const flushBullets = (): void => {
    if (bulletBuffer && bulletBuffer.length > 0) {
      blocks.push({ kind: "ul", items: bulletBuffer });
    }
    bulletBuffer = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().length === 0) {
      flushBullets();
      continue;
    }
    const bulletMatch = /^[\s]*[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const item = bulletMatch[1] ?? "";
      if (bulletBuffer === null) bulletBuffer = [];
      bulletBuffer.push(item);
      continue;
    }
    flushBullets();
    blocks.push({ kind: "p", line });
  }
  flushBullets();
  return blocks;
}

export function ScribeMarkdown({ content }: ScribeMarkdownProps): JSX.Element {
  const blocks = tokenise(content);
  const paraStyle: CSSProperties = {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--color-text)",
  };
  const listStyle: CSSProperties = {
    margin: 0,
    paddingLeft: 22,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
  const liStyle: CSSProperties = {
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--color-text)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {blocks.map((block, idx) => {
        if (block.kind === "ul") {
          return (
            <ul key={idx} style={listStyle}>
              {block.items.map((item, j) => (
                <li key={j} style={liStyle}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} style={paraStyle}>
            {renderInline(block.line)}
          </p>
        );
      })}
    </div>
  );
}
