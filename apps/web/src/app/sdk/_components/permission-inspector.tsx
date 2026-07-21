'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { DotsSixVertical, Key, UsersThree } from '@phosphor-icons/react';
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
};

const inspectorShellClass = [
  'relative flex w-full shrink-0 flex-col overflow-hidden border-t border-white/[0.06] bg-black/[0.38] text-white backdrop-blur-2xl xl:my-3 xl:mr-3 xl:w-[var(--inspector-width)] xl:rounded-r-[26px] xl:border xl:border-white/[0.08]',
  'backdrop-saturate-[130%] shadow-[0_20px_48px_rgba(0,0,0,0.28),inset_1px_0_rgba(255,255,255,0.04)]',
].join(' ');

const transparentLayerClass = 'bg-transparent';

const glassPanelClass = [
  'flex flex-col border-t border-white/[0.07] bg-transparent p-4 sm:p-5',
].join(' ');

const glassInnerClass = [
  'rounded-[16px] bg-white/[0.035] p-2',
].join(' ');

const glassRowClass = 'flex items-center justify-between rounded-[12px] bg-white/[0.025] transition-colors hover:bg-white/[0.05]';


function cx(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function PermissionInspector(props: PermissionInspectorProps) {
  const { entity, grants, history, width, onResizeStart } = props;
  const risk = useMemo(() => calculateRisk(grants), [grants]);
  const enabledEndpoints = ENDPOINTS.filter((endpoint) => grants.includes(endpoint.scope));
  const EntityIcon = entity.type === 'team' ? UsersThree : Key;

  return (
    <aside
      style={{ '--inspector-width': `${width}px` } as CSSProperties}
      className={inspectorShellClass}
    >
      <button
        type="button"
        aria-label="Resize access summary"
        title="Drag to resize"
        onPointerDown={onResizeStart}
        className="inspector-resize-handle group absolute inset-y-0 -left-3 z-30 hidden w-6 cursor-col-resize xl:flex"
      >
        <span className="inspector-resize-track !bg-black/30 backdrop-blur-xl [.telemetry-app_&&]:!border-white/10 [.telemetry-app_&&]:!bg-black/30">
          <DotsSixVertical className="h-3.5 w-3.5" weight="bold" />
          <small>RESIZE</small>
        </span>
      </button>

      <header className={cx('flex min-h-[92px] items-center justify-between border-b border-white/[0.07] px-5 py-4 bg-transparent', transparentLayerClass)}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/[0.045] text-white/70"><EntityIcon weight="duotone" className="h-6 w-6" /></span>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">Access summary</p>
            <h2 className="mt-1 font-sans text-xl font-semibold text-white/90">{entity.label}</h2>
          </div>
        </div>
      </header>

      <div className={cx('min-h-0 flex-1 overflow-y-auto bg-transparent p-3 sm:p-4', transparentLayerClass)}>
        <section data-summary-section className="grid grid-cols-2 border-b border-white/[0.07]">
          <div className="flex flex-col justify-center bg-transparent p-5">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Allowed permissions</span>
            <strong data-summary-value className="mt-3 font-sans text-3xl font-semibold text-white/90">{grants.length}<small className="ml-1 font-mono text-xs text-white/30">/18</small></strong>
          </div>
          <div className="flex flex-col justify-center bg-transparent p-5">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Risk level</span>
            <strong data-summary-value className="mt-3 font-sans text-3xl font-semibold" style={{ color: risk.color }}>{risk.level}</strong>
          </div>
        </section>

        <section data-summary-section className={glassPanelClass}>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/60">Effective SDK</h3>
            <span className="font-mono text-[8px] text-white/30">TypeScript</span>
          </header>
          <pre className={cx('overflow-auto p-4 font-mono text-[11px] leading-relaxed text-white/60', glassInnerClass)} aria-label="Generated SDK policy preview">
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
                <span className="font-mono text-[10px] text-white/50 bg-transparent">{endpoint.method}</span>
                <code className="font-mono text-[11px] text-white/80">{endpoint.path}</code>
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
                <div key={group.id} className="flex items-center justify-between rounded-[12px] bg-white/[0.025] px-3 py-2.5">
                  <span className="text-xs text-white/70">{group.label}</span>
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
  const [width, setWidth] = useState(400);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('conduit-inspector-width'));
    if (Number.isFinite(saved) && saved >= 360 && saved <= 620) setWidth(saved);
  }, []);

  const startResize = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const move = (pointerEvent: globalThis.PointerEvent) => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        setWidth(Math.min(620, Math.max(360, startWidth - (pointerEvent.clientX - startX))));
      });
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      setWidth((current) => {
        window.localStorage.setItem('conduit-inspector-width', String(current));
        return current;
      });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }, [width]);

  return { width, startResize };
}
