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
              <Link href={`/events/${event.id}`} className="telemetry-ledger-link">
                <span>{event.source}</span>
                <small>{event.id.slice(0, 8)}</small>
              </Link>
            </TCell>
            <TCell className="telemetry-code-cell">{event.type}</TCell>
            <TCell><EventStatusBadge status={event.status} /></TCell>
            <TCell className="telemetry-time-cell">
              <time dateTime={event.receivedAt}>{new Date(event.receivedAt).toLocaleString()}</time>
            </TCell>
            <TCell>
              <Link href={`/events/${event.id}`} className="telemetry-row-action" aria-label={`Inspect ${event.source} event`}>
                <ArrowUpRight weight="bold" />
              </Link>
            </TCell>
          </TRow>
        ))}
      </tbody>
    </Table>
  );
}
