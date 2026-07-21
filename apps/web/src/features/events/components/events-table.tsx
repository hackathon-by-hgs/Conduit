import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import type { EventDto } from '@conduit/contracts';
import { Table, TCell, THead, TRow } from '@/components/ui/table';
import { EventStatusBadge } from './event-status-badge';

export function EventsTable({ events }: { events: EventDto[] }) {
  return (
    <Table>
      <THead columns={['Source', 'Event type', 'State', 'Received', 'Trace']} />
      <tbody>
        {events.map((event) => (
          <TRow key={event.id}>
            <TCell>
              {/* ledger link: flex column with title+id */}
              <Link
                href={`/events/${event.id}`}
                className="flex min-w-0 flex-col gap-[5px] hover:[&>span]:text-[#d15a5f]"
              >
                <span className="font-sans text-[13px] font-semibold text-[#f5f5f5] transition-colors duration-[160ms]">{event.source}</span>
                <small className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#666]">{event.id.slice(0, 8)}</small>
              </Link>
            </TCell>
            <TCell className="font-mono text-[11px] text-[#f5f5f5]">{event.type}</TCell>
            <TCell><EventStatusBadge status={event.status} /></TCell>
            <TCell className="font-mono text-[10px] text-[#666]">
              <time dateTime={event.receivedAt}>{new Date(event.receivedAt).toLocaleString()}</time>
            </TCell>
            <TCell>
              <Link
                href={`/events/${event.id}`}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[#2e2e2e] text-[#a3a3a3] transition-[border-color,color,transform] duration-[160ms] hover:translate-x-[2px] hover:-translate-y-[2px] hover:border-[#a01016] hover:text-[#f5f5f5]"
                aria-label={`Inspect ${event.source} event`}
              >
                <ArrowUpRight weight="bold" />
              </Link>
            </TCell>
          </TRow>
        ))}
      </tbody>
    </Table>
  );
}
