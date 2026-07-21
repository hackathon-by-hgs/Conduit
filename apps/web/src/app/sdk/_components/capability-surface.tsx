'use client';

import { useState } from 'react';
import {
  ArrowsClockwise,
  Broadcast,
  CaretDown,
  ChartLineUp,
  PaperPlaneTilt,
  ShieldCheck,
  type Icon,
} from '@phosphor-icons/react';
import { SCOPE_GROUPS, type ScopeDefinition, type ScopeGroup } from './access-data';

type CapabilitySurfaceProps = {
  selectedId: string;
  focusedLabel: string;
  grants: string[];
  editing: boolean;
  onSelect: (capabilityId: string, scopeId: string) => void;
  onToggle: (scopeId: string) => void;
};

const GROUP_ICONS: Record<string, Icon> = {
  events: Broadcast,
  sends: PaperPlaneTilt,
  reconciliation: ArrowsClockwise,
  stats: ChartLineUp,
  admin: ShieldCheck,
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
  events: 'Read, filter, and stream event data.',
  sends: 'Inspect delivery attempts and replay failed sends.',
  reconciliation: 'Review gaps, reports, and audit evidence.',
  stats: 'Read delivery metrics and export operational snapshots.',
  admin: 'Manage webhooks, SDK access, and credentials.',
};

const PERMISSION_COPY: Record<string, { title: string; summary: string }> = {
  'events:read': { title: 'Read Events', summary: 'Read normalized events and delivery state.' },
  'events:stream': { title: 'Realtime Stream', summary: 'Consume live event updates from the stream.' },
  'events:filter': { title: 'Filter History', summary: 'Query event history by source, status, and time.' },
  'sends:read': { title: 'Inspect Sends', summary: 'Inspect outbound attempts and provider responses.' },
  'sends:replay': { title: 'Replay Send', summary: 'Replay a failed delivery to its destination.' },
  'sends:dlq:read': { title: 'Read Dead Letters', summary: 'Read deliveries held in the dead-letter queue.' },
  'sends:dlq:replay': { title: 'Replay Dead Letters', summary: 'Replay dead-lettered deliveries individually or in bulk.' },
  'reconcile:read': { title: 'Read Reports', summary: 'Read reconciliation reports across event and send records.' },
  'reconcile:export': { title: 'Export Evidence', summary: 'Export reconciliation evidence for audit workflows.' },
  'gaps:read': { title: 'Inspect Gaps', summary: 'Inspect missing, orphaned, and terminal gaps.' },
  'gaps:deeplink': { title: 'Open Gap Trace', summary: 'Follow a gap into its underlying event record.' },
  'stats:read': { title: 'Read Metrics', summary: 'Read aggregate delivery and reliability metrics.' },
  'stats:export': { title: 'Export Metrics', summary: 'Export aggregate metrics for downstream analysis.' },
  'webhooks:ingest': { title: 'Ingest Webhooks', summary: 'Submit signed webhooks into the ingestion layer.' },
  'webhooks:configure': { title: 'Configure Webhooks', summary: 'Change webhook sources, secrets, and delivery policy.' },
  'sdk:manage': { title: 'Manage SDK Policy', summary: 'Publish SDK permissions and manage access entities.' },
  'keys:read': { title: 'Read API Keys', summary: 'Inspect API key metadata without revealing key material.' },
  'keys:rotate': { title: 'Rotate API Keys', summary: 'Generate, revoke, and rotate production API keys.' },
};

const TOTAL_SCOPE_COUNT = SCOPE_GROUPS.reduce((total, group) => total + group.scopes.length, 0);

const humanizeScopeId = (scopeId: string) =>
  scopeId
    .split(':')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function CapabilitySurface(props: CapabilitySurfaceProps) {
  const { selectedId, focusedLabel, grants, editing, onSelect, onToggle } = props;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const handleAccessChange = (groupId: string, scopeId: string, nextGranted: boolean, currentlyGranted: boolean) => {
    onSelect(groupId, scopeId);
    if (nextGranted !== currentlyGranted) onToggle(scopeId);
  };

  const toggleGroup = (groupId: string, scopeId: string) => {
    onSelect(groupId, scopeId);
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getPermissionCopy = (scope: ScopeDefinition) =>
    PERMISSION_COPY[scope.id] ?? {
      title: humanizeScopeId(scope.id),
      summary: scope.description,
    };

  const renderAccessControl = (group: ScopeGroup, scope: ScopeDefinition, granted: boolean) => {
    const copy = getPermissionCopy(scope);

    return (
      <div
        data-permission-state
        role="group"
        aria-label={`Permission state for ${copy.title}`}
        className="relative grid h-10 w-[132px] grid-cols-2 items-center overflow-hidden rounded-full bg-black/55 p-1 shadow-[inset_0_1px_rgba(255,255,255,0.06),0_10px_22px_rgba(0,0,0,0.22)]"
      >
        <span
          data-permission-thumb
          aria-hidden="true"
          className={[
            'pointer-events-none absolute bottom-1 left-1 top-1 z-0 w-[calc(50%-4px)] rounded-full transition-[background-color,transform] duration-[260ms] ease-[cubic-bezier(.23,1,.32,1)]',
            granted ? 'translate-x-0 bg-[#A01016] shadow-[0_8px_18px_rgba(160,16,22,0.28)]' : 'translate-x-[calc(100%+4px)] bg-white/[0.13]',
          ].join(' ')}
        />

        <button
          type="button"
          aria-pressed={granted}
          onClick={() => handleAccessChange(group.id, scope.id, true, granted)}
          className={[
            'relative z-10 flex h-full items-center justify-center rounded-full font-mono text-[8px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A01016]/45',
            granted ? 'text-white' : 'text-white/30 hover:text-white/60',
          ].join(' ')}
        >
          Allow
        </button>

        <button
          type="button"
          aria-pressed={!granted}
          onClick={() => handleAccessChange(group.id, scope.id, false, granted)}
          className={[
            'relative z-10 flex h-full items-center justify-center rounded-full font-mono text-[8px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/14',
            !granted ? 'text-white' : 'text-white/30 hover:text-white/60',
          ].join(' ')}
        >
          Deny
        </button>
      </div>
    );
  };

  const renderGroup = (group: ScopeGroup) => {
    const Icon = GROUP_ICONS[group.id] ?? ShieldCheck;
    const activeCount = group.scopes.filter((scope) => grants.includes(scope.id)).length;
    const selected = group.id === selectedId;
    const collapsed = collapsedGroups.has(group.id);
    const orderedScopes = group.scopes;

    return (
      <tbody key={group.id} data-policy-module className="border-t border-white/[0.08] first:border-t-0">
        <tr>
          <th scope="rowgroup" colSpan={4} className="px-5 pb-3 pt-6 text-left">
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => toggleGroup(group.id, orderedScopes[0].id)}
              className={[
                'group/capability flex w-full items-center gap-3 rounded-[18px] bg-transparent py-2 pr-3 text-left transition-[background-color,transform] duration-180 hover:-translate-y-0.5 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/12',
                selected ? 'text-white' : 'text-white/80',
              ].join(' ')}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white/[0.04] text-white/56 transition-colors group-hover/capability:text-white/78">
                <Icon weight="regular" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[16px] font-semibold leading-none tracking-[-0.03em] text-white">
                  {group.label}
                </span>
                <span className="mt-1.5 block truncate text-[12px] leading-relaxed text-white/42">
                  {GROUP_DESCRIPTIONS[group.id]}
                </span>
              </span>
              <span className="hidden min-w-[156px] items-center gap-3 sm:flex">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span className="block h-full bg-[#A01016]" style={{ width: `${(activeCount / group.scopes.length) * 100}%` }} />
                </span>
                <span className="font-mono text-[10px] font-semibold text-white/58">
                  {activeCount}/{group.scopes.length}
                </span>
              </span>
              <CaretDown
                className={[
                  'h-4 w-4 shrink-0 text-white/35 transition-transform duration-200',
                  collapsed ? '-rotate-90' : 'rotate-0',
                ].join(' ')}
                weight="bold"
              />
            </button>
          </th>
        </tr>

        {collapsed ? null : orderedScopes.map((scope) => {
          const granted = grants.includes(scope.id);
          const copy = getPermissionCopy(scope);

          return (
            <tr
              key={scope.id}
              data-permission-row
              data-granted={granted ? 'true' : 'false'}
              className={[
                'group/permission bg-transparent transition-colors duration-[140ms] ease-[cubic-bezier(.23,1,.32,1)] hover:bg-white/[0.035] focus-within:bg-white/[0.04]',
                selected ? 'bg-[#A01016]/[0.025]' : '',
              ].join(' ')}
            >
              <td className="w-[230px] px-5 py-3.5 align-middle">
                <div className="relative">
                  <span className="absolute -left-5 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r-full bg-[#A01016] opacity-0 transition-opacity duration-[180ms] group-hover/permission:opacity-100 group-focus-within/permission:opacity-100" />
                  <strong className="block truncate font-sans text-[13px] font-semibold tracking-[-0.01em] text-white/82 transition-colors duration-[180ms] group-hover/permission:text-white">
                    {copy.title}
                  </strong>
                  <span
                    className={[
                      'mt-1 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.13em]',
                      granted ? 'bg-[#A01016]/14 text-white/70' : 'bg-white/[0.045] text-white/36',
                    ].join(' ')}
                  >
                    {granted ? 'Enabled' : 'Available'}
                  </span>
                </div>
              </td>

              <td className="w-[150px] px-4 py-3.5 align-middle">
                <code className="font-mono text-[10px] text-white/40">{scope.id}</code>
              </td>

              <td className="px-4 py-3.5 align-middle">
                <p className="text-[12px] leading-relaxed text-white/42">{copy.summary}</p>
              </td>

              <td className="w-[168px] px-3 py-3.5 align-middle">
                {renderAccessControl(group, scope, granted)}
              </td>
            </tr>
          );
        })}
      </tbody>
    );
  };

  return (
    <section className="min-h-full overflow-hidden bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
      <div className="flex min-h-full flex-col">
        <header className="flex flex-col gap-5 border-b border-white/[0.06] bg-transparent px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Effective permissions
            </p>
            <h2 className="mt-2 font-sans text-[clamp(20px,2.2vw,28px)] font-semibold leading-tight tracking-[-0.04em] text-white">
              Configure <span className="text-white/70">{focusedLabel}</span>
            </h2>
            <p className="mt-1.5 text-[12px] text-white/40">
              Review capabilities as a table, then allow or deny individual SDK operations.
            </p>
          </div>

          <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-1">
            <div className="flex items-end gap-2">
              <strong className="font-mono text-[36px] font-medium leading-none text-white">
                {grants.length}
              </strong>
              <span className="mb-1 text-[11px] text-white/35">of {TOTAL_SCOPE_COUNT} allowed</span>
            </div>
            <span
              className={[
                'flex items-center gap-1.5 font-mono text-[8.5px] font-semibold uppercase tracking-widest',
                editing ? 'text-[#A01016]' : 'text-white/25',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-1.5 w-1.5 rounded-full',
                  editing ? 'bg-[#A01016]' : 'bg-white/20',
                ].join(' ')}
              />
              {editing ? 'Unsaved changes' : 'Policy synchronized'}
            </span>
          </div>
        </header>

        <div className="max-w-full flex-1 overflow-x-auto px-4 py-3 [scrollbar-gutter:stable] md:overflow-x-visible sm:px-6">
          <div className="w-full min-w-[760px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">SDK capability permission table</caption>
              <thead className="sticky top-0 z-30 bg-gradient-to-r from-[#080808] via-[#0b0b0b] to-black shadow-[0_1px_rgba(255,255,255,0.08)]">
                <tr className="border-b border-white/[0.08] font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  <th scope="col" className="w-[230px] px-5 py-3 text-left">
                    Permission
                  </th>
                  <th scope="col" className="w-[150px] px-4 py-3 text-left">
                    SDK ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Summary
                  </th>
                  <th scope="col" className="w-[168px] px-3 py-3 text-left">
                    Access
                  </th>
                </tr>
              </thead>
              {SCOPE_GROUPS.map(renderGroup)}
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  index,
  label,
  title,
  detail,
}: {
  index?: string;
  label: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-white/[0.07] pb-5">
      {index ? (
        <span className="font-mono text-[9px] font-semibold text-[#A01016]">{index}</span>
      ) : null}
      <div>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">
          {label}
        </p>
        <h2 className="mt-1 font-sans text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          {title}
        </h2>
      </div>
      {detail ? (
        <span className="ml-auto font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
          Editing&nbsp;{detail}
        </span>
      ) : null}
    </div>
  );
}
