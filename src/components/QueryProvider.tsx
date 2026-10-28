'use client';

/**
 * QueryClientProvider with persistence layer.
 *
 * - Creates a QueryClient with sensible defaults (staleTime, gcTime, retry).
 * - Persists only 'feed' and 'casts' query keys to localStorage via
 *   @tanstack/query-sync-storage-persister so the feed loads instantly
 *   on subsequent visits.
 *
 * Must be mounted inside FarcasterAuthProvider to pick up auth state in
 * downstream hooks.
 */

import React, { useState, useEffect } from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30 s — data is fresh for half a minute
            gcTime: 5 * 60_000, // 5 min — keep unused data in cache
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Persist feed + cast cache to localStorage; skip ephemeral data.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'HH_QUERY_CACHE',
    });

    // v5 @tanstack/query-persist-client-core may bundle its own query-core,
    // causing a nominal type mismatch with the host's QueryClient.  Cast
    // through `any` to work around it — the objects are structurally identical.
    const [unsubscribe] = persistQueryClient({
      queryClient: queryClient as any,
      persister: persister as any,
      maxAge: 24 * 60 * 60 * 1000, // keep for 24 h
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const key = query.queryKey[0] as string;
          return key === 'feed' || key === 'casts';
        },
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}