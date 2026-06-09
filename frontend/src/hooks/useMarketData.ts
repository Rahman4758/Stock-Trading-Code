/**
 * useMarketData.ts
 *
 * Global hook for market-wide data: FII/DII, sector rotation, sync status.
 * Uses React Query — called from multiple pages with the same cache key,
 * the network request fires only ONCE per 5 minutes regardless of how many
 * pages/components import this hook.
 *
 * Before: Each page had its own useEffect + useState fetching independently.
 * After:  All pages share one cache. Zero duplicate network calls.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSectorRotation, getDivergences } from "@/lib/api";
import { getFiiDiiData, getSectorFlow } from "@/lib/moneyFlowApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// ── Query Keys — centralized so all components use the same cache key ──────
export const QUERY_KEYS = {
  syncStatus:     ["sync", "status"],
  scanResults:    ["scan", "latest"],
  sectorRotation: ["sectors", "rotation"],
  sectorFlow:     ["sectors", "flow"],
  divergences:    ["scan", "divergences"],
  fiiDii:         ["market", "fiidii"],
  stockData:      (symbol: string) => ["stock", symbol.toUpperCase()],
  footprint:      (symbol: string, days: number) => ["footprint", symbol.toUpperCase(), days],
  moneyFlow:      (section: string) => ["moneyflow", section],
} as const;

// ── Sync Status ────────────────────────────────────────────────────────────
export function useSyncStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.syncStatus,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sync/status`);
      if (!res.ok) throw new Error("Failed to fetch sync status");
      return res.json();
    },
    staleTime: 60 * 1000,       // 1 minute — check sync status frequently
    refetchInterval: 30 * 1000, // Auto-poll every 30s (catches isSyncing changes)
  });
}

// ── Latest Scan Results ────────────────────────────────────────────────────
export function useScanResults() {
  return useQuery({
    queryKey: QUERY_KEYS.scanResults,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/scan/latest`);
      if (!res.ok) throw new Error("Failed to fetch scan results");
      return res.json();
    },
    // staleTime inherited from QueryClient default (5 min)
  });
}

// ── Sector Rotation ────────────────────────────────────────────────────────
// Used by: dashboard (page.tsx), sectors page, money-flow page.
// With React Query: fetches once, all 3 pages read from cache.
export function useSectorRotation() {
  return useQuery({
    queryKey: QUERY_KEYS.sectorRotation,
    queryFn:  getSectorRotation,
  });
}

// ── Sector Flow (for money-flow module) ───────────────────────────────────
export function useSectorFlow() {
  return useQuery({
    queryKey: QUERY_KEYS.sectorFlow,
    queryFn:  getSectorFlow,
  });
}

// ── Divergence Alerts ──────────────────────────────────────────────────────
export function useDivergences() {
  return useQuery({
    queryKey: QUERY_KEYS.divergences,
    queryFn:  getDivergences,
  });
}

// ── FII/DII Market Data ────────────────────────────────────────────────────
export function useFiiDii() {
  return useQuery({
    queryKey: QUERY_KEYS.fiiDii,
    queryFn:  getFiiDiiData,
  });
}

// ── Per-Symbol Stock Data ──────────────────────────────────────────────────
export function useStockData(symbol: string) {
  return useQuery({
    queryKey: QUERY_KEYS.stockData(symbol),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/stocks/${symbol.toUpperCase()}`);
      if (!res.ok) throw new Error(`Failed to fetch data for ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
  });
}

// ── Footprint Chart Data ───────────────────────────────────────────────────
export function useFootprint(symbol: string, days = 90) {
  return useQuery({
    queryKey: QUERY_KEYS.footprint(symbol, days),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/footprint/${symbol.toUpperCase()}?days=${days}`);
      if (!res.ok) throw new Error(`Failed to fetch footprint for ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000, // Footprint data changes less frequently
  });
}

// ── Trigger full data refresh (after manual sync) ─────────────────────────
export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries(); // Clears entire cache → forces fresh fetch
  };
}
