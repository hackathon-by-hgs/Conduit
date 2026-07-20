'use client';

import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/card';
import { statsQueryOptions } from '../api/get-stats';

export function StatsCards() {
  const { data } = useQuery(statsQueryOptions());

  return (
    <div className="telemetry-stat-grid">
      <StatCard label="Received" value={data?.eventsReceived ?? '--'} />
      <StatCard label="Processed" value={data?.eventsProcessed ?? '--'} />
      <StatCard label="Duplicates" value={data?.duplicatesRejected ?? '--'} />
      <StatCard label="Delivered" value={data?.sendsDelivered ?? '--'} />
      <StatCard label="In DLQ" value={data?.sendsInDlq ?? '--'} />
      <StatCard label="Open gaps" value={data?.openGaps ?? '--'} />
    </div>
  );
}
