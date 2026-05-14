"use client";

/**
 * useShareLinks(sessionId) — manages share links for a single session.
 *
 * State:
 *  - `links`: server truth (active + revoked, sorted active-first).
 *  - `creating` / `createError`: in-flight create state.
 *  - `revoking[linkId]`: per-link revocation state.
 *
 * The hook does NOT auto-fetch when sessionId is null — the consuming
 * modal calls `refresh()` when it opens. This keeps the recordings list
 * page from issuing N+1 calls per row.
 */

import { useCallback, useEffect, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type {
  ShareLink,
  SharePermissions,
} from "@/domain/entities/share-link";

interface UseShareLinksResult {
  links: ShareLink[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
  revoking: Record<string, boolean>;
  refresh: () => Promise<void>;
  create: (input: {
    permissions: SharePermissions;
    expiresInHours: number | null;
  }) => Promise<ShareLink | null>;
  revoke: (linkId: string) => Promise<boolean>;
}

function sortLinks(links: ShareLink[]): ShareLink[] {
  // Active first, then by created_at desc within each bucket.
  return [...links].sort((a, b) => {
    const aActive = a.revokedAt === null ? 0 : 1;
    const bActive = b.revokedAt === null ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function useShareLinks(
  sessionId: string | null,
): UseShareLinksResult {
  const { listSessionShareLinks, createShareLink, revokeShareLink, analytics } =
    useContainer();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listSessionShareLinks.execute(sessionId);
      setLinks(sortLinks(items));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos cargar los links.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listSessionShareLinks, sessionId]);

  const create = useCallback(
    async (input: {
      permissions: SharePermissions;
      expiresInHours: number | null;
    }): Promise<ShareLink | null> => {
      if (!sessionId) return null;
      setCreating(true);
      setCreateError(null);
      try {
        const link = await createShareLink.execute({
          sessionId,
          permissions: input.permissions,
          expiresInHours: input.expiresInHours,
        });
        setLinks((prev) => sortLinks([link, ...prev]));
        analytics.track({
          name: "share_link_created",
          permissions: input.permissions,
        });
        return link;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "No pudimos crear el link.";
        setCreateError(msg);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [createShareLink, sessionId, analytics],
  );

  const revoke = useCallback(
    async (linkId: string): Promise<boolean> => {
      setRevoking((prev) => ({ ...prev, [linkId]: true }));
      try {
        const ok = await revokeShareLink.execute(linkId);
        if (ok) {
          // Optimistic in-place flip — also keeps view_count visible.
          const nowIso = new Date().toISOString();
          setLinks((prev) =>
            sortLinks(
              prev.map((l) =>
                l.id === linkId && l.revokedAt === null
                  ? { ...l, revokedAt: nowIso }
                  : l,
              ),
            ),
          );
        }
        return ok;
      } catch {
        return false;
      } finally {
        setRevoking((prev) => {
          const next = { ...prev };
          delete next[linkId];
          return next;
        });
      }
    },
    [revokeShareLink],
  );

  useEffect(() => {
    if (sessionId) void refresh();
  }, [sessionId, refresh]);

  return {
    links,
    loading,
    error,
    creating,
    createError,
    revoking,
    refresh,
    create,
    revoke,
  };
}
