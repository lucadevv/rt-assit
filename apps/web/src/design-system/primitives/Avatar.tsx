/**
 * Susurra Avatar primitive — single avatar + pile (+N) variant.
 */

import clsx from "clsx";
import type { CSSProperties, JSX } from "react";

interface AvatarProps {
  size?: number;
  initials?: string;
  src?: string;
  bg?: string;
  fg?: string;
  alt?: string;
  className?: string;
}

export function Avatar({
  size = 32,
  initials,
  src,
  bg = "var(--color-hero-h1)",
  fg = "#ffffff",
  alt = "",
  className,
}: AvatarProps): JSX.Element {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 9999,
    background: bg,
    color: fg,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-inter)",
    fontWeight: 700,
    fontSize: Math.round(size * 0.4),
    border: "2px solid var(--color-bg)",
    overflow: "hidden",
    flexShrink: 0,
  };
  if (src) {
    return (
      <span className={clsx("susurra-avatar", className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
    );
  }
  return (
    <span className={clsx("susurra-avatar", className)} style={style} aria-label={alt}>
      {initials?.slice(0, 2).toUpperCase() ?? ""}
    </span>
  );
}

interface AvatarPileItem {
  initials?: string;
  src?: string;
  bg?: string;
  fg?: string;
  alt?: string;
}

interface AvatarPileProps {
  items: AvatarPileItem[];
  size?: number;
  max?: number;
  className?: string;
}

export function AvatarPile({
  items,
  size = 32,
  max = 4,
  className,
}: AvatarPileProps): JSX.Element {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <span
      className={clsx("susurra-avatar-pile", className)}
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      {visible.map((item, idx) => (
        <span
          key={idx}
          style={{ marginLeft: idx === 0 ? 0 : -Math.round(size * 0.35), zIndex: visible.length - idx }}
        >
          <Avatar size={size} {...item} />
        </span>
      ))}
      {overflow > 0 ? (
        <span style={{ marginLeft: -Math.round(size * 0.35) }}>
          <Avatar
            size={size}
            initials={`+${overflow}`}
            bg="var(--color-black)"
            fg="var(--color-lime)"
          />
        </span>
      ) : null}
    </span>
  );
}
