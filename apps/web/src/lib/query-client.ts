import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api-client';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Client errors (4xx) won't fix themselves — fail fast. Retry others twice.
          if (error instanceof ApiClientError && error.error.statusCode < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations are optimistic and roll back on error; a blind retry would
        // replay a side effect, so surface the failure instead.
        retry: 0,
      },
    },
  });
}
