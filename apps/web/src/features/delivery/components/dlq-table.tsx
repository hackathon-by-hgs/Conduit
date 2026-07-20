'use client';

import { ArrowsClockwise } from '@phosphor-icons/react';
import type { SendDto } from '@conduit/contracts';
import { Badge } from '@/components/ui/badge';
import { Table, TCell, THead, TRow } from '@/components/ui/table';
import { useReplay } from '../hooks/use-replay';

export function DlqTable({ sends }: { sends: SendDto[] }) {
  const replay = useReplay();

  return (
    <Table>
      <THead columns={['Destination', 'Fault', 'Cycles', 'Queued at', 'Control']} />
      <tbody>
        {sends.map((send) => (
          <TRow key={send.id}>
            <TCell className="telemetry-destination-cell">
              <strong>{send.to}</strong>
              <small>{send.channel} / {send.id.slice(0, 8)}</small>
            </TCell>
            <TCell><Badge tone="danger">{send.lastError ?? 'Unknown fault'}</Badge></TCell>
            <TCell className="telemetry-number-cell">{String(send.attempts).padStart(2, '0')}</TCell>
            <TCell className="telemetry-time-cell">
              <time dateTime={send.createdAt}>{new Date(send.createdAt).toLocaleString()}</time>
            </TCell>
            <TCell>
              <button
                type="button"
                onClick={() => replay.mutate(send.id)}
                disabled={replay.isPending}
                className="telemetry-command-button"
              >
                <ArrowsClockwise weight="bold" />
                {replay.isPending ? 'Replaying' : 'Replay'}
              </button>
            </TCell>
          </TRow>
        ))}
      </tbody>
    </Table>
  );
}
