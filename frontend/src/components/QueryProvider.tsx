"use client";

/**
 * QueryProvider.tsx
 *
 * React Query client provider. Wraps the entire app so all pages
 * can use useQuery() hooks with automatic caching and deduplication.
 *
 * Config:
 *  - staleTime: 5 minutes — same endpoint called from multiple pages
 *    within 5 min uses the cache, no extra network call.
 *  - gcTime: 10 minutes — data stays in cache for 10 min after last use.
 *  - retry: 1 — failed requests retry once before showing error.
 *  - refetchOnWindowFocus: false — no surprise re-fetches when user
 *    tabs back into the browser (this is a trading dashboard, not a chat app).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create client inside component so each server render gets a fresh instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            5 * 60 * 1000,  // 5 minutes
            gcTime:               10 * 60 * 1000, // 10 minutes
            retry:                1,
            refetchOnWindowFocus: false,
            refetchOnReconnect:   true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
