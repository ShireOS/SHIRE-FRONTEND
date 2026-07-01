import { QueryClient } from '@tanstack/react-query'

// Session-scoped server-state cache. Data stays in memory only (nothing is
// persisted to localStorage), so restaurant data never outlives the tab.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Stale times per data class. "Setup" data changes rarely and only through
// this dashboard, so it can stay fresh much longer than live-ish data.
export const STALE_TIMES = {
  setup: 5 * 60 * 1000,
  analytics: 60 * 1000,
  scheduling: 60 * 1000,
  messaging: 15 * 1000,
}

// Imperative read-through cache for panels that load server data into local
// editable state. Returns cached data instantly while fresh; fetches and
// caches otherwise. Pass staleTime 0 to force a network refresh.
export function fetchCached<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number = STALE_TIMES.setup,
): Promise<T> {
  return queryClient.fetchQuery({ queryKey: queryKey as unknown[], queryFn, staleTime })
}
