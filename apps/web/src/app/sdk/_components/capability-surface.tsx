'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
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

gsap.registerPlugin(useGSAP);

type CapabilitySurfaceProps = {
  selectedId: string;
  focusedLabel: string;
  grants: string[];
  editing: boolean;
  requestedOpenGroup?: string | null;
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
  const { selectedId, focusedLabel, grants, editing, requestedOpenGroup, onSelect, onToggle } = props;
  const rootRef = useRef<HTMLElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(SCOPE_GROUPS.map((group) => group.id)));
  const collapsedSignature = [...collapsedGroups].sort().join('|');

  useEffect(() => {
    if (!requestedOpenGroup) return;

    setCollapsedGroups((current) => {
      if (!current.has(requestedOpenGroup)) return current;
      const next = new Set(current);
      next.delete(requestedOpenGroup);
      return next;
    });
  }, [requestedOpenGroup]);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const headers = gsap.utils.toArray<HTMLElement>('[data-policy-header]');
      if (!headers.length) return;

      gsap.fromTo(
        headers,
        { autoAlpha: 0.84, x: -8 },
        { autoAlpha: 1, x: 0, duration: 0.22, stagger: 0.035, ease: 'power2.out' },
      );
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rows = gsap.utils.toArray<HTMLElement>('[data-permission-row]');
      if (!rows.length) return;

      gsap.fromTo(
        rows,
        { autoAlpha: 0.82, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' },
      );
    },
    { scope: rootRef, dependencies: [collapsedSignature] },
  );

  const handleAccessChange = (groupId: string, scopeId: string, nextGranted: boolean, currentlyGranted: boolean) => {
    onSelect(groupId, scopeId);
    if (nextGranted !== currentlyGranted) onToggle(scopeId);
  };

  const toggleGroup = (groupId: string, scopeId: string) => {
    onSelect(groupId, scopeId);

    const currentlyCollapsed = collapsedGroups.has(groupId);

    if (currentlyCollapsed) {
      setCollapsedGroups((current) => {
        const next = new Set(current);
        next.delete(groupId);
        return next;
      });
      return;
    }

    const rows = rootRef.current
      ? gsap.utils.toArray<HTMLElement>(`[data-policy-group="${groupId}"] [data-permission-row]`, rootRef.current)
      : [];

    const closeGroup = () => {
      setCollapsedGroups((current) => {
        const next = new Set(current);
        next.add(groupId);
        return next;
      });
    };

    if (!rows.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeGroup();
      return;
    }

    gsap.to(rows, {
      autoAlpha: 0,
      y: -8,
      duration: 0.16,
      stagger: 0.018,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: closeGroup,
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
        className="relative grid h-8 w-[108px] grid-cols-2 items-center overflow-hidden rounded-full bg-black/58 p-0.5 sm:w-[116px]"
      >
        <span
          data-permission-thumb
          aria-hidden="true"
          className={[
            'pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 z-0 w-[calc(50%-2px)] rounded-full transition-[background-color,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
            granted ? 'translate-x-0 bg-[#A01016]' : 'translate-x-[calc(100%+2px)] bg-white/[0.13]',
          ].join(' ')}
        />

        <button
          type="button"
          aria-pressed={granted}
          onClick={() => handleAccessChange(group.id, scope.id, true, granted)}
          className={[
            'relative z-10 flex h-full items-center justify-center rounded-full font-mono text-[7px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A01016]/45',
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
            'relative z-10 flex h-full items-center justify-center rounded-full font-mono text-[7px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/14',
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
      <tbody key={group.id} data-policy-module data-policy-group={group.id} className="border-t border-white/[0.08] first:border-t-0">
        <tr>
          <th scope="rowgroup" colSpan={4} data-policy-header className="p-0 text-left">
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => toggleGroup(group.id, orderedScopes[0].id)}
              className={[
        'group/capability relative flex min-h-[86px] w-full items-center gap-3 px-4 py-3.5 text-left transition-[background-color,color] duration-220 ease-[cubic-bezier(.23,1,.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/12 sm:min-h-[92px] sm:gap-4 sm:px-6 sm:py-4',
                selected
                  ? 'bg-white/[0.032] text-white'
                  : 'bg-transparent text-white/76 hover:bg-white/[0.024] hover:text-white',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute bottom-5 left-0 top-5 w-0.5 rounded-r-full bg-[#A01016] transition-[opacity,transform] duration-200',
                  selected ? 'scale-y-100 opacity-100' : 'scale-y-50 opacity-0 group-hover/capability:scale-y-100 group-hover/capability:opacity-100',
                ].join(' ')}
                aria-hidden="true"
              />
              <span className={[
                'grid h-10 w-10 shrink-0 place-items-center rounded-[14px] transition-[background-color,color,transform] duration-180 group-hover/capability:translate-x-1 sm:h-11 sm:w-11 sm:rounded-[16px]',
                selected ? 'bg-[#A01016]/14 text-white/88' : 'bg-white/[0.04] text-white/52 group-hover/capability:bg-white/[0.06] group-hover/capability:text-white/78',
              ].join(' ')}>
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
                  <span data-boot-progress className="block h-full bg-[#A01016]" style={{ width: `${(activeCount / group.scopes.length) * 100}%` }} />
                </span>
                <span className="font-mono text-[10px] font-semibold text-white/58">
                  {activeCount}/{group.scopes.length}
                </span>
              </span>
              <CaretDown
                className={[
                  'h-4 w-4 shrink-0 text-white/35 transition-[transform,color] duration-200 group-hover/capability:text-white/58',
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
              <td className="w-[196px] px-4 py-3.5 align-middle sm:w-[230px] sm:px-5">
                <div className="relative">
                  <span className="absolute -left-4 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r-full bg-[#A01016] opacity-0 transition-opacity duration-[180ms] group-hover/permission:opacity-100 group-focus-within/permission:opacity-100 sm:-left-5" />
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

              <td className="w-[130px] px-3 py-3.5 align-middle sm:w-[150px] sm:px-4">
                <code className="font-mono text-[10px] text-white/40">{scope.id}</code>
              </td>

              <td className="px-3 py-3.5 align-middle sm:px-4">
                <p className="text-[12px] leading-relaxed text-white/42">{copy.summary}</p>
              </td>

              <td className="w-[126px] px-2 py-3.5 align-middle sm:w-[146px] sm:px-3">
                {renderAccessControl(group, scope, granted)}
              </td>
            </tr>
          );
        })}
      </tbody>
    );
  };

  return (
    <section ref={rootRef} data-boot-surface className="min-h-full overflow-visible bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
      <div className="flex min-h-full flex-col">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] bg-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
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
              <strong data-boot-counter data-boot-count={grants.length} className="font-mono text-[36px] font-medium leading-none text-white">
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

        <div className="access-scroll max-w-full flex-1 overflow-x-auto px-3 py-3 [scrollbar-gutter:stable] lg:overflow-x-visible sm:px-6">
          <div data-boot-table className="w-full min-w-[680px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 sm:min-w-[760px]">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">SDK capability permission table</caption>
              <thead className="sticky top-0 z-30 bg-gradient-to-r from-[#080808] via-[#0b0b0b] to-black">
                <tr className="border-b border-white/[0.08] font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  <th scope="col" className="sticky top-0 z-30 w-[196px] bg-[#090909] px-4 py-3 text-left sm:w-[230px] sm:px-5">
                    Permission
                  </th>
                  <th scope="col" className="sticky top-0 z-30 w-[130px] bg-[#090909] px-3 py-3 text-left sm:w-[150px] sm:px-4">
                    SDK ID
                  </th>
                  <th scope="col" className="sticky top-0 z-30 bg-[#090909] px-3 py-3 text-left sm:px-4">
                    Summary
                  </th>
                  <th scope="col" className="sticky top-0 z-30 w-[126px] bg-[#090909] px-2 py-3 text-left sm:w-[146px] sm:px-3">
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
