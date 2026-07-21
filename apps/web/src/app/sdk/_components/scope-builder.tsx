'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { PlugsConnected } from '@phosphor-icons/react';
import type { AccessEntity } from './access-data';
import { SectionHeading } from './capability-surface';

gsap.registerPlugin(useGSAP);

type ScopeBuilderProps = {
  entities: AccessEntity[];
  focusedEntity: AccessEntity;
  effectiveCount: number;
  connected: boolean;
  onFocus: (entityId: string) => void;
  onConnectionChange: (connected: boolean) => void;
};

const LEVELS = [
  { id: 'organization', label: 'Organization', value: 'Conduit Inc.' },
  { id: 'workspace', label: 'Workspace', value: 'Production' },
  { id: 'team', label: 'Access entity', value: '' },
  { id: 'developer', label: 'Consumer', value: 'SDK runtime' },
  { id: 'key', label: 'Credential', value: '' },
  { id: 'permissions', label: 'Permission set', value: '' },
];

export function ScopeBuilder(props: ScopeBuilderProps) {
  const { entities, focusedEntity, effectiveCount, connected, onFocus, onConnectionChange } = props;
  const rootRef = useRef<HTMLElement>(null);
  const keyEntity = focusedEntity.type === 'key'
    ? focusedEntity
    : entities.find((entity) => entity.type === 'key') ?? focusedEntity;

  useGSAP(
    () => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      timeline
        .from('[data-path-stage]', { x: -7, opacity: 0.84, duration: 0.42, stagger: 0.055 })
        .fromTo('[data-path-link]', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.32, stagger: 0.04 }, '-=0.3');
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="control-section">
      <SectionHeading
        index="02"
        label="Scope builder"
        title="Trace how permission reaches the SDK."
        detail={connected ? 'Path verified' : 'Path interrupted'}
      />

      <div className={`scope-route-machine ${connected ? 'is-connected' : 'is-interrupted'}`}>
        <div className="scope-route-rail">
          <span>ACCESS PATH / EFFECTIVE POLICY</span>
          <span className={connected ? 'text-[var(--app-accent)]/70' : 'text-red-200/65'}>
            {connected ? 'SIGNAL CONTINUOUS' : 'SIGNAL SEVERED'}
          </span>
        </div>

        <div className="access-scroll overflow-x-auto">
          <div className="scope-route-track">
            {LEVELS.map((level, index) => {
              const value = level.id === 'team'
                ? focusedEntity.label
                : level.id === 'key'
                  ? keyEntity.label
                  : level.id === 'permissions'
                    ? `${effectiveCount} grants`
                    : level.value;
              const dimmed = !connected && index > 1;
              const selectable = level.id === 'team' || level.id === 'key';

              return (
                <div key={level.id} className="flex shrink-0 items-stretch">
                  <button
                    type="button"
                    data-path-stage
                    onClick={() => {
                      if (level.id === 'team') onFocus(focusedEntity.type === 'team' ? focusedEntity.id : 'team-alpha');
                      if (level.id === 'key') onFocus(keyEntity.id);
                    }}
                    className={`scope-route-stage group/stage ${dimmed ? 'is-dimmed' : ''} ${selectable ? 'is-selectable' : ''}`}
                  >
                    <div className="relative z-10 flex items-start justify-between font-mono text-[8px] uppercase tracking-[0.18em]">
                      <span className="text-white/24">L{String(index + 1).padStart(2, '0')}</span>
                      <span className={dimmed ? 'text-white/14' : 'text-[var(--app-accent)]/62'}>{dimmed ? 'OFFLINE' : 'LINKED'}</span>
                    </div>
                    <span className="scope-route-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="relative z-10 mt-auto">
                      <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/25">{level.label}</p>
                      <p className="mt-2 max-w-[150px] truncate font-display text-base font-semibold text-white/76">{value}</p>
                      {selectable ? <p className="mt-3 font-mono text-[7px] uppercase tracking-[0.15em] text-white/20 group-hover/stage:text-[var(--app-accent)]/62">Select context</p> : null}
                    </div>
                  </button>

                  {index < LEVELS.length - 1 ? (
                    <div data-path-link className={`scope-route-link ${!connected && index >= 1 ? 'is-broken' : ''}`}>
                      {(connected || index === 0) ? <span className="scope-route-packet" /> : <span className="scope-route-break">X</span>}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="scope-route-controls">
          <div className="scope-entity-selector access-scroll">
            <span className="scope-control-label">Context</span>
            {entities.map((entity) => (
              <button
                type="button"
                key={entity.id}
                onClick={() => onFocus(entity.id)}
                className={`scope-entity-option ${focusedEntity.id === entity.id ? 'is-active' : ''}`}
              >
                <span>{entity.type}</span>
                <strong>{entity.label}</strong>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onConnectionChange(!connected)}
            className={`scope-path-command ${connected ? 'is-connected' : 'is-interrupted'}`}
          >
            <PlugsConnected className="h-3.5 w-3.5" weight="bold" /> {connected ? 'Interrupt path' : 'Restore path'}
          </button>
        </div>
      </div>
    </section>
  );
}
