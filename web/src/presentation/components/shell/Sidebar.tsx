"use client";

/**
 * Sidebar — vertical primary navigation.
 *
 * Items:
 *   Home (/app), Live (/app/live), Knowledge (/app/knowledge),
 *   Personas (/app/personas), Recordings (/app/recordings),
 *   Settings (/app/settings), Billing (/app/billing).
 *
 * Active route is matched with `usePathname` + an `isActive` predicate that
 * supports nested routes (e.g. /app/live/123 still highlights "Live").
 *
 * Footer: tier badge + dev-mode pill so contributors instantly see whether
 * they're on Clerk or the dev fallback.
 */

import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookIcon,
  CardIcon,
  FilmIcon,
  HomeIcon,
  LiveIcon,
  SettingsIcon,
  UserIcon,
} from "@/design-system/icons";
import { Badge } from "@/design-system/primitives";
import { useAuthStore } from "@/application/stores/auth.store";
import type { UserTier } from "@/domain/entities/user";
import { AUTH_MODE } from "@/infrastructure/auth/auth-factory";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/app", label: "Inicio", icon: <HomeIcon size={18} />, exact: true },
  { href: "/app/live", label: "Live", icon: <LiveIcon size={18} /> },
  { href: "/app/knowledge", label: "Knowledge", icon: <BookIcon size={18} /> },
  { href: "/app/personas", label: "Personas", icon: <UserIcon size={18} /> },
  { href: "/app/recordings", label: "Grabaciones", icon: <FilmIcon size={18} /> },
  { href: "/app/settings", label: "Configuración", icon: <SettingsIcon size={18} /> },
  { href: "/app/billing", label: "Facturación", icon: <CardIcon size={18} /> },
];

const TIER_LABEL: Record<UserTier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  byok: "BYOK",
};

const TIER_TONE: Record<
  UserTier,
  "neutral" | "info" | "lime" | "warning"
> = {
  free: "neutral",
  pro: "lime",
  premium: "info",
  byok: "warning",
};

function isActiveRoute(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar(): JSX.Element {
  const pathname = usePathname() ?? "";
  const tier = useAuthStore((s) => s.user?.tier ?? "free");

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        gap: 4,
      }}
    >
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActiveRoute(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--color-text)" : "var(--color-text-mid)",
                  background: active
                    ? "var(--color-bg-soft)"
                    : "transparent",
                  border: active
                    ? "1px solid var(--color-border)"
                    : "1px solid transparent",
                  transition: "background-color 120ms ease",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    color: active
                      ? "var(--color-text)"
                      : "var(--color-text-mid)",
                  }}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-dim)",
            }}
          >
            Plan
          </span>
          <Badge tone={TIER_TONE[tier]}>{TIER_LABEL[tier]}</Badge>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-text-dim)",
          }}
          title="Modo de autenticación activo"
        >
          Auth · {AUTH_MODE}
        </div>
      </div>
    </nav>
  );
}
