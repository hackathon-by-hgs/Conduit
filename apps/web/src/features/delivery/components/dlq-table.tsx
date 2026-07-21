'use client';

import type { SendDto } from '@conduit/contracts';
import { Badge } from '@/components/ui/badge';
import { Table, TCell, THead, TRow } from '@/components/ui/table';
import { age } from '@/lib/format';
import { useReplay } from '../hooks/use-replay';

export function DlqTable({ sends }: { sends: SendDto[] }) {
  const replay = useReplay();
  const pendingId = replay.isPending ? replay.variables : null;

  return (
    <Table>
      <THead columns={['Recipient', 'Channel', 'Attempts', 'Last error', 'Age', '']} />
      <tbody>
        {sends.map((s) => {
          const isPending = pendingId === s.id;
          return (
            <TRow key={s.id}>
              <TCell className="font-medium">{s.to}</TCell>
              <TCell className="text-[var(--color-muted)]">{s.channel}</TCell>
              <TCell className="tabular-nums">{s.attempts}</TCell>
              <TCell>
                <Badge tone="danger">{s.lastError ?? 'unknown'}</Badge>
              </TCell>
              <TCell className="tabular-nums text-[var(--color-muted)]">
                <span title={s.createdAt}>{age(s.createdAt)}</span>
              </TCell>
              <TCell>
                <button
                  type="button"
                  onClick={() => replay.mutate(s.id)}
                  disabled={isPending}
                  className="rounded-md bg-[var(--color-accent)]/15 px-3 py-1 text-xs text-[var(--color-accent)] transition-opacity disabled:opacity-50"
                >
                  {isPending ? 'Replaying…' : 'Replay'}
                </button>
              </TCell>
            </TRow>
          );
        })}
      </tbody>
    </Table>
  );
}
