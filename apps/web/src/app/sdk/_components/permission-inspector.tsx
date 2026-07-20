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
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { DotsSixVertical, Key, UsersThree } from '@phosphor-icons/react';
import { ALL_SCOPES, SCOPE_GROUPS, type AccessEntity } from './access-data';
import { ENDPOINTS } from './control-data';

gsap.registerPlugin(useGSAP);

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

export function PermissionInspector(props: PermissionInspectorProps) {
  const { entity, grants, lastChanged, history, generationKey, width, onResizeStart } = props;
  const rootRef = useRef<HTMLElement>(null);
  const risk = useMemo(() => calculateRisk(grants), [grants]);
  const enabledEndpoints = ENDPOINTS.filter((endpoint) => grants.includes(endpoint.scope));
  const EntityIcon = entity.type === 'team' ? UsersThree : Key;
  const grantSignature = grants.join('|');

  useGSAP(
    () => {
      gsap.from('[data-summary-section]', {
        y: 5,
        opacity: 0.78,
        stagger: 0.05,
        duration: 0.3,
        ease: 'power2.out',
      });
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (!lastChanged) return;
      const row = rootRef.current?.querySelector<HTMLElement>(`[data-endpoint-scope="${lastChanged}"]`);
      if (!row) return;
      gsap.fromTo(
        row,
        { backgroundColor: 'rgba(160,16,22,.14)' },
        { backgroundColor: 'rgba(160,16,22,0)', duration: 0.45, ease: 'power2.out' },
      );
    },
    { scope: rootRef, dependencies: [lastChanged] },
  );

  useGSAP(
    () => {
      gsap.fromTo(
        '[data-summary-value]',
        { y: 8, opacity: 0.25 },
        { y: 0, opacity: 1, duration: 0.34, stagger: 0.06, ease: 'power3.out' },
      );
    },
    { scope: rootRef, dependencies: [grantSignature] },
  );

  useGSAP(
    () => {
      gsap.fromTo(
        '[data-sdk-line]',
        { clipPath: 'inset(0 100% 0 0)', opacity: 0.28 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.38, stagger: 0.08, ease: 'power2.out' },
      );
    },
    { scope: rootRef, dependencies: [generationKey, entity.id] },
  );

  return (
    <aside
      ref={rootRef}
      style={{ '--inspector-width': `${width}px` } as CSSProperties}
      className="simple-access-inspector relative flex w-full shrink-0 flex-col bg-[#0a0a0a] xl:w-[var(--inspector-width)]"
    >
      <button
        type="button"
        aria-label="Resize access summary"
        title="Drag to resize"
        onPointerDown={onResizeStart}
        className="inspector-resize-handle group absolute inset-y-0 -left-3 z-30 hidden w-6 cursor-col-resize xl:flex"
      >
        <span className="inspector-resize-track">
          <DotsSixVertical className="h-3.5 w-3.5" weight="bold" />
          <small>RESIZE</small>
        </span>
      </button>

      <header className="simple-inspector-header">
        <div className="inspector-identity">
          <span className="inspector-identity-mark"><EntityIcon weight="duotone" /></span>
          <div>
            <p>Access summary</p>
            <h2>{entity.label}</h2>
          </div>
        </div>
        <span className="inspector-policy-state"><i />{entity.type === 'team' ? 'Team policy' : 'API key policy'}</span>
      </header>

      <div className="access-scroll min-h-0 flex-1 overflow-y-auto">
        <section data-summary-section className="simple-access-overview">
          <div>
            <span>Allowed permissions</span>
            <strong data-summary-value>{grants.length}<small>/18</small></strong>
          </div>
          <div>
            <span>Risk level</span>
            <strong data-summary-value style={{ color: risk.color }}>{risk.level}</strong>
          </div>
        </section>

        <section data-summary-section className="simple-inspector-section sdk-preview-module">
          <header>
            <h3>Effective SDK</h3>
            <span>TypeScript</span>
          </header>
          <pre className="sdk-policy-preview" aria-label="Generated SDK policy preview">
            <code>
              <span data-sdk-line><b>const</b> sdk = conduit.policy({'{'}</span>
              <span data-sdk-line>  entity: <i>&apos;{entity.id}&apos;</i>,</span>
              <span data-sdk-line>  scopes: [</span>
              {grants.slice(0, 3).map((scope) => (
                <span key={scope} data-sdk-line>    <i>&apos;{scope}&apos;</i>,</span>
              ))}
              {grants.length > 3 ? <span data-sdk-line>    <em>/* +{grants.length - 3} more */</em></span> : null}
              <span data-sdk-line>  ],</span>
              <span data-sdk-line>{'}'});</span>
            </code>
          </pre>
        </section>

        <section data-summary-section className="simple-inspector-section">
          <header>
            <h3>Available endpoints</h3>
            <span>{enabledEndpoints.length}</span>
          </header>
          <div className="simple-endpoint-list">
            {enabledEndpoints.length ? enabledEndpoints.map((endpoint) => (
              <div key={`${endpoint.method}-${endpoint.path}`} data-endpoint-scope={endpoint.scope}>
                <span>{endpoint.method}</span>
                <code>{endpoint.path}</code>
              </div>
            )) : (
              <p>No API endpoints are currently available.</p>
            )}
          </div>
        </section>

        <section data-summary-section className="simple-inspector-section">
          <header>
            <h3>Permissions by category</h3>
          </header>
          <div className="category-summary-list">
            {SCOPE_GROUPS.map((group) => {
              const active = group.scopes.filter((scope) => grants.includes(scope.id)).length;
              return (
                <div key={group.id}>
                  <span>{group.label}</span>
                  <div><i style={{ width: `${(active / group.scopes.length) * 100}%` }} /></div>
                  <strong>{active}/{group.scopes.length}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section data-summary-section className="simple-inspector-section">
          <header>
            <h3>Recent changes</h3>
          </header>
          <div className="simple-history-list">
            {history.slice(0, 4).map((event) => (
              <div key={event.id}>
                <span className={`is-${event.tone ?? 'neutral'}`} />
                <div>
                  <strong>{event.action}</strong>
                  <p>{event.detail}</p>
                </div>
                <time>{event.time}</time>
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
