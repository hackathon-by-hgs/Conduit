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
    <section className="flex flex-col gap-[18px]">
      {/* Back navigation */}
      <Link
        href="/events"
        className="inline-flex items-center gap-[9px] self-start font-mono text-[9px] uppercase tracking-[0.12em] text-[#a3a3a3] transition-colors duration-[160ms] hover:text-[#f5f5f5]"
      >
        <ArrowLeft weight="bold" /> Event stream
      </Link>

      <TelemetryPageHeader
        eyebrow={`TRACE / ${data.id.slice(0, 8)}`}
        title={`${data.source} / ${data.type}`}
        description={`Received ${new Date(data.receivedAt).toLocaleString()} with ${data.sends.length} delivery ${data.sends.length === 1 ? 'send' : 'sends'}.`}
        status={data.status}
        metric={{ label: 'Delivery sends', value: data.sends.length }}
      />

      {/* Meta strip: status / idempotency key / processed time */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-[#262626] bg-[#262626] sm:grid-cols-[0.65fr_1.7fr_0.65fr]">
        {[
          { label: 'Status', content: <EventStatusBadge status={data.status} /> },
          { label: 'Idempotency key', content: <code className="w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-[#f5f5f5]">{data.idempotencyKey}</code> },
          { label: 'Processed', content: <strong className="w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-[#f5f5f5]">{data.processedAt ? new Date(data.processedAt).toLocaleTimeString() : 'Pending'}</strong> },
        ].map(({ label, content }) => (
          <div key={label} className="flex min-w-0 flex-col items-start gap-[10px] bg-[#0c0c0c] p-[16px_18px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#666]">{label}</span>
            {content}
          </div>
        ))}
      </div>

      {/* Payload card */}
      <Card className="!p-0">
        <header className="flex min-h-[78px] flex-col items-start justify-between gap-3 border-b border-[#262626] bg-[#161616] px-4 py-[15px] sm:flex-row sm:items-center sm:px-5">
          <div>
            <b className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#a01016]">DATA / PAYLOAD</b>
            <h2 className="mt-[5px] font-sans text-[18px] font-semibold text-[#f5f5f5]">Normalized event body</h2>
          </div>
          <b className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#a01016]">
            {Object.keys(data.payload).length} FIELDS
          </b>
        </header>
        <pre className="max-h-[420px] overflow-auto p-6 font-mono text-[11px] leading-[1.8] text-[#a3a3a3]">
          {JSON.stringify(data.payload, null, 2)}
        </pre>
      </Card>

      {/* Send register */}
      <section className="grid gap-[14px]">
        {/* Section rail header */}
        <div className="flex min-h-[78px] items-center justify-between gap-4 overflow-hidden rounded-[18px] border border-[#262626] bg-[#161616] px-4 py-[15px] sm:rounded-[20px] sm:px-5">
          <div>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#666]">DELIVERY / OUTPUT</span>
            <h2 className="mt-[5px] font-sans text-[18px] font-semibold text-[#f5f5f5]">Send telemetry</h2>
          </div>
          <strong className="font-mono text-[34px] font-medium text-[#a01016]">
            {String(data.sends.length).padStart(2, '0')}
          </strong>
        </div>

        {data.sends.length ? data.sends.map((send, index) => (
          <Card key={send.id} className="!p-0">
            <header className="grid min-h-[92px] grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-[#262626] bg-[#111] px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-5">
              {/* Index badge */}
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2e2e2e] font-mono text-[10px] font-semibold text-[#a01016]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#666]">{send.channel} / {send.status}</span>
                <h3 className="mt-[5px] overflow-hidden text-ellipsis whitespace-nowrap font-sans text-[17px] text-[#f5f5f5]">{send.to}</h3>
              </div>
              {/* Attempt count */}
              <div className="col-start-2 flex flex-row items-center gap-2 justify-self-start sm:col-start-auto sm:flex-col sm:items-end sm:justify-self-auto sm:gap-0">
                <strong className="font-mono text-[25px] text-[#f5f5f5]">{String(send.attempts).padStart(2, '0')}</strong>
                <span className="font-mono text-[8px] uppercase text-[#666]">attempts</span>
              </div>
              <ArrowRight weight="bold" className="text-[#666]" />
            </header>
            <DeliveryTimeline attempts={send.attemptHistory} />
          </Card>
        )) : (
          <p className="px-5 py-7 font-mono text-[10px] uppercase tracking-[0.13em] text-[#666]">
            No delivery sends were created for this event.
          </p>
        )}
      </section>
    </section>
  );
}
