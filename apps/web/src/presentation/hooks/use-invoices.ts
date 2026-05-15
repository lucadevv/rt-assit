"use client";

/**
 * useInvoices — load invoices history with simple "load more" pagination.
 *
 * The backend defaults are limit=20/offset=0 which is plenty for the
 * Billing page section. We expose `loadMore()` so future iterations can
 * paginate without refactoring; for F7 the page just renders the first
 * batch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { Invoice } from "@/domain/entities/invoice";

const PAGE_SIZE = 20;

interface UseInvoicesResult {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInvoices(): UseInvoicesResult {
  const { listInvoices } = useContainer();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await listInvoices.execute({ limit: PAGE_SIZE, offset: 0 });
      setInvoices(fresh);
      setOffset(fresh.length);
      setHasMore(fresh.length === PAGE_SIZE);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar tus facturas.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[susurra] listInvoices failed:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listInvoices]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const more = await listInvoices.execute({
        limit: PAGE_SIZE,
        offset,
      });
      setInvoices((prev) => [...prev, ...more]);
      setOffset((prev) => prev + more.length);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar más facturas.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[susurra] listInvoices loadMore failed:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listInvoices, loading, hasMore, offset]);

  // StrictMode dedup: only run the initial fetch once per real mount.
  // `refresh()` remains callable manually for explicit re-loads.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [refresh]);

  return { invoices, loading, error, hasMore, loadMore, refresh };
}
