'use client';

import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { DotsSixVertical, Key, UsersThree, X } from '@phosphor-icons/react';
import { ALL_SCOPES, SCOPE_GROUPS, type AccessEntity } from './access-data';
import { ENDPOINTS } from './control-data';

export type InspectorEvent = {
  id: string;
  action: string;
  detail: string;
  time: string;
  tone?: 'neutral' | 'warning' | 'success';
};

type PermissionInspectorProps = {
  entity: AccessEntity;
  grants: string[];
  lastChanged: string | null;
  history: InspectorEvent[];
  generationKey: number;
  width: number;
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const inspectorShellClass = [
  'fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] top-14 z-[170] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#050505]/88 text-white backdrop-blur-2xl transition-[opacity,transform] duration-300 ease-[cubic-bezier(.23,1,.32,1)] xl:relative xl:inset-auto xl:z-auto xl:my-3 xl:mr-3 xl:w-[var(--inspector-width)] xl:shrink-0 xl:translate-y-0 xl:rounded-r-[24px] xl:opacity-100',
  'backdrop-saturate-[125%]',
].join(' ');

const transparentLayerClass = 'bg-transparent';

const glassPanelClass = 'flex flex-col border-t border-white/[0.07] bg-transparent px-3 py-3 sm:px-5 sm:py-3.5';

const glassInnerClass = [
  'rounded-[14px] border border-white/[0.055] bg-white/[0.025] p-2',
].join(' ');

const glassRowClass = 'flex min-w-0 items-center justify-between gap-3 rounded-[11px] bg-white/[0.02] transition-colors hover:bg-white/[0.045]';


function cx(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function PermissionInspector(props: PermissionInspectorProps) {
  const { entity, grants, history, width, onResizeStart, mobileOpen = false, onMobileClose } = props;
  const risk = useMemo(() => calculateRisk(grants), [grants]);
  const enabledEndpoints = ENDPOINTS.filter((endpoint) => grants.includes(endpoint.scope));
  const EntityIcon = entity.type === 'team' ? UsersThree : Key;

  return (
    <>
      <button
        type="button"
        aria-label="Close access summary"
        onClick={onMobileClose}
        className={[
          'fixed inset-0 z-[160] bg-black/64 backdrop-blur-[3px] transition-opacity duration-300 xl:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />
      <aside
        style={{ '--inspector-width': `${width}px` } as CSSProperties}
        className={[
          inspectorShellClass,
          mobileOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-5 opacity-0 xl:pointer-events-auto',
        ].join(' ')}
      >
      <button
        type="button"
        aria-label="Access summary divider"
        title="Access summary"
        onPointerDown={(event) => {
          event.preventDefault();
          onResizeStart(event);
        }}
        className="inspector-resize-handle group absolute inset-y-0 -left-3 z-30 hidden w-6 !cursor-default xl:flex"
      >
        <span className="inspector-resize-track !bg-black/30 !text-white/32 backdrop-blur-xl group-hover:!border-white/10 group-hover:!bg-black/30 group-hover:!text-white/40 [.telemetry-app_&&]:!border-white/10 [.telemetry-app_&&]:!bg-black/30">
          <DotsSixVertical className="h-3.5 w-3.5" weight="bold" />
          <small>PANEL</small>
        </span>
      </button>

      <header className={cx('flex min-h-[72px] items-center justify-between gap-3 border-b border-white/[0.07] bg-transparent px-3 py-3 sm:min-h-[78px] sm:px-5 sm:py-3.5', transparentLayerClass)}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.055] bg-white/[0.035] text-white/70"><EntityIcon weight="duotone" className="h-5 w-5" /></span>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">Access summary</p>
            <h2 className="mt-1 font-sans text-[17px] font-semibold tracking-[-0.03em] text-white/90">{entity.label}</h2>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close access summary"
          onClick={onMobileClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/[0.08] bg-white/[0.035] text-white/58 transition-[background-color,border-color,color,transform] duration-200 hover:scale-[0.96] hover:border-[#A01016]/65 hover:bg-[#A01016] hover:text-white xl:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className={cx('access-scroll min-h-0 flex-1 overflow-y-auto bg-transparent p-2.5 sm:p-3', transparentLayerClass)}>
        <section data-summary-section className="grid grid-cols-1 overflow-hidden rounded-t-[16px] border border-white/[0.06] bg-white/[0.018] min-[420px]:grid-cols-2 sm:rounded-t-[18px]">
          <div className="flex flex-col justify-center border-b border-white/[0.06] bg-transparent p-3.5 min-[420px]:border-b-0 min-[420px]:border-r sm:p-4">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Allowed permissions</span>
            <strong data-summary-value className="mt-2 font-sans text-[28px] font-semibold leading-none text-white/90">{grants.length}<small className="ml-1 font-mono text-[11px] text-white/30">/18</small></strong>
          </div>
          <div className="flex flex-col justify-center bg-transparent p-3.5 sm:p-4">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Risk level</span>
            <strong data-summary-value className="mt-2 font-sans text-[28px] font-semibold leading-none" style={{ color: risk.color }}>{risk.level}</strong>
          </div>
        </section>

        <section data-summary-section className={glassPanelClass}>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/60">Effective SDK</h3>
            <span className="font-mono text-[8px] text-white/30">TypeScript</span>
          </header>
          <pre className={cx('access-scroll max-w-full overflow-x-auto overflow-y-hidden p-3 pb-4 font-mono text-[10px] leading-relaxed text-white/60', glassInnerClass)} aria-label="Generated SDK policy preview">
            <code>
              <span data-sdk-line><b className="text-white">const</b> sdk = conduit.policy({'{'}</span>
              <span data-sdk-line>  entity: <i className="text-red-400">&apos;{entity.id}&apos;</i>,</span>
              <span data-sdk-line>  scopes: [</span>
              {grants.slice(0, 3).map((scope) => (
                <span key={scope} data-sdk-line>    <i className="text-red-400">&apos;{scope}&apos;</i>,</span>
              ))}
              {grants.length > 3 ? <span data-sdk-line>    <em className="text-white/30">/* +{grants.length - 3} more */</em></span> : null}
              <span data-sdk-line>  ],</span>
              <span data-sdk-line>{'}'});</span>
            </code>
          </pre>
        </section>

        <section data-summary-section className={glassPanelClass}>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/60">Available endpoints</h3>
            <span className="font-mono text-[8px] text-white/30">{enabledEndpoints.length}</span>
          </header>
          <div className={cx('flex flex-col gap-1', glassInnerClass)}>
            {enabledEndpoints.length ? enabledEndpoints.map((endpoint) => (
              <div key={`${endpoint.method}-${endpoint.path}`} data-endpoint-scope={endpoint.scope} className={cx('px-3 py-2', glassRowClass)}>
                <span className="font-mono text-[9px] text-white/50 bg-transparent">{endpoint.method}</span>
                <code className="min-w-0 truncate font-mono text-[10px] text-white/80">{endpoint.path}</code>
              </div>
            )) : (
              <p className="p-3 text-center text-xs text-white/40">No API endpoints are currently available.</p>
            )}
          </div>
        </section>

        <section data-summary-section className={glassPanelClass}>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/60">Permissions by category</h3>
          </header>
          <div className="flex flex-col gap-2">
            {SCOPE_GROUPS.map((group) => {
              const active = group.scopes.filter((scope) => grants.includes(scope.id)).length;
              return (
                <div key={group.id} className="flex items-center justify-between rounded-[11px] bg-white/[0.02] px-3 py-2">
                  <span className="text-[11px] text-white/70">{group.label}</span>
                  <div className="mx-4 flex h-1 flex-1 overflow-hidden rounded-full bg-white/10"><i className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(active / group.scopes.length) * 100}%` }} /></div>
                  <strong className="font-mono text-[10px] text-white/60">{active}/{group.scopes.length}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section data-summary-section className={glassPanelClass}>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/60">Recent changes</h3>
          </header>
          <div className="flex flex-col gap-2">
            {history.slice(0, 4).map((event) => (
              <div key={event.id} className={cx('px-3 py-2.5', glassRowClass)}>
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${event.tone === 'warning' ? 'bg-orange-500' : event.tone === 'success' ? 'bg-green-500' : 'bg-red-600'}`} />
                  <div className="flex flex-col">
                    <strong className="text-[11px] font-medium text-white/90">{event.action}</strong>
                    <p className="text-[10px] text-white/50">{event.detail}</p>
                  </div>
                </div>
                <time className="font-mono text-[9px] text-white/40">{event.time}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
      </aside>
    </>
  );
}

function calculateRisk(grants: string[]) {
  const score = grants.reduce((total, scopeId) => {
    const scope = ALL_SCOPES.find((item) => item.id === scopeId);
    const weight = scope?.risk === 'critical'
      ? 18
      : scope?.risk === 'high'
        ? 11
        : scope?.risk === 'medium'
          ? 6
          : 2;
    return total + weight;
  }, 0);

  if (score >= 70) return { level: 'Critical', color: '#d15a5f' };
  if (score >= 45) return { level: 'High', color: '#d15a5f' };
  if (score >= 22) return { level: 'Medium', color: '#a3a3a3' };
  return { level: 'Low', color: '#f5f5f5' };
}

export function useInspectorResize() {
  const [width] = useState(400);

  const startResize = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  return { width, startResize };
}
