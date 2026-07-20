'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { TelemetryPageHeader } from '@/app/_components/telemetry-page-header';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { eventQueryOptions } from '../api/get-event';
import { DeliveryTimeline } from './delivery-timeline';
import { EventStatusBadge } from './event-status-badge';

export function EventDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useQuery(eventQueryOptions(id));

  if (isLoading) return <LoadingState label="Resolving event trace" />;
  if (isError) return <ErrorState error={error} />;
  if (!data) return null;

  return (
    <section className="telemetry-page-stack telemetry-event-detail">
      <Link href="/events" className="telemetry-back-command">
        <ArrowLeft weight="bold" /> Event stream
      </Link>

      <TelemetryPageHeader
        eyebrow={`TRACE / ${data.id.slice(0, 8)}`}
        title={`${data.source} / ${data.type}`}
        description={`Received ${new Date(data.receivedAt).toLocaleString()} with ${data.sends.length} delivery ${data.sends.length === 1 ? 'send' : 'sends'}.`}
        status={data.status}
        metric={{ label: 'Delivery sends', value: data.sends.length }}
      />

      <div className="telemetry-event-meta-strip">
        <div><span>Status</span><EventStatusBadge status={data.status} /></div>
        <div><span>Idempotency key</span><code>{data.idempotencyKey}</code></div>
        <div><span>Processed</span><strong>{data.processedAt ? new Date(data.processedAt).toLocaleTimeString() : 'Pending'}</strong></div>
      </div>

      <Card className="telemetry-payload-module">
        <header>
          <div><span>DATA / PAYLOAD</span><h2>Normalized event body</h2></div>
          <b>{Object.keys(data.payload).length} FIELDS</b>
        </header>
        <pre>{JSON.stringify(data.payload, null, 2)}</pre>
      </Card>

      <section className="telemetry-send-register">
        <header className="telemetry-section-rail">
          <div><span>DELIVERY / OUTPUT</span><h2>Send telemetry</h2></div>
          <strong>{String(data.sends.length).padStart(2, '0')}</strong>
        </header>

        {data.sends.length ? data.sends.map((send, index) => (
          <Card className="telemetry-send-module" key={send.id}>
            <header>
              <span className="telemetry-send-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span>{send.channel} / {send.status}</span>
                <h3>{send.to}</h3>
              </div>
              <div className="telemetry-send-attempt-count">
                <strong>{String(send.attempts).padStart(2, '0')}</strong>
                <span>attempts</span>
              </div>
              <ArrowRight weight="bold" />
            </header>
            <DeliveryTimeline attempts={send.attemptHistory} />
          </Card>
        )) : (
          <p className="telemetry-timeline-empty">No delivery sends were created for this event.</p>
        )}
      </section>
    </section>
  );
}
