'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Paginated, SendDto } from '@conduit/contracts';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/stores/toast.store';
import { replaySend } from '../api/replay-send';

type SendsCache = Paginated<SendDto>;

/**
 * Replay several dead-lettered sends at once (DLQ multi-select).
 *
 * Same optimistic model as the single replay: every selected send leaves the DLQ
 * immediately, with a snapshot kept for rollback. Requests run concurrently and
 * the result is reported as a summary so a partial failure is still legible.
 */
export function useBulkReplay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => replaySend(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { total: ids.length, failed };
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: queryKeys.sends.all });
      const remove = new Set(ids);

      const snapshot = qc.getQueriesData<SendsCache>({ queryKey: queryKeys.sends.all });
      qc.setQueriesData<SendsCache>({ queryKey: queryKeys.sends.all }, (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((s) => !remove.has(s.id)),
              total: Math.max(0, current.total - ids.length),
            }
          : current,
      );

      return { snapshot };
    },
    onError: (_err, _ids, context) => {
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error('Bulk replay failed. The sends are still in the dead-letter queue.');
    },
    onSuccess: ({ total, failed }) => {
      if (failed === 0) {
        toast.success(`${total} sends re-queued for delivery.`);
      } else {
        toast.error(`${total - failed} re-queued, ${failed} failed.`);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sends.all });
      void qc.invalidateQueries({ queryKey: queryKeys.stats.current() });
    },
  });
}
