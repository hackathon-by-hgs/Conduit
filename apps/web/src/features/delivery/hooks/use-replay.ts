'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Paginated, SendDto } from '@conduit/contracts';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/stores/toast.store';
import { replaySend } from '../api/replay-send';

type SendsCache = Paginated<SendDto>;

/**
 * Replay a dead-lettered send.
 *
 * Optimistic: the send leaves the DLQ immediately (it moves to `pending`), with
 * a snapshot kept for rollback if the request fails. `mutate` is keyed by send id,
 * so callers read `variables` to scope the pending state to a single row and guard
 * against double-clicks.
 */
export function useReplay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => replaySend(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.sends.all });

      const snapshot = qc.getQueriesData<SendsCache>({ queryKey: queryKeys.sends.all });
      qc.setQueriesData<SendsCache>({ queryKey: queryKeys.sends.all }, (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((s) => s.id !== id),
              total: Math.max(0, current.total - 1),
            }
          : current,
      );

      return { snapshot };
    },
    onError: (_err, _id, context) => {
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error('Replay failed. The send is still in the dead-letter queue.');
    },
    onSuccess: () => {
      toast.success('Send re-queued for delivery.');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sends.all });
      void qc.invalidateQueries({ queryKey: queryKeys.stats.current() });
    },
  });
}
