'use client';

import { useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CAPABILITIES } from './control-data';

gsap.registerPlugin(useGSAP);

type CapabilitySurfaceProps = {
  selectedId: string;
  focusedLabel: string;
  grants: string[];
  editing: boolean;
  onSelect: (capabilityId: string, scopeId: string) => void;
  onToggle: (scopeId: string) => void;
};

function getGrantCounts(grants: string[]) {
  return Object.fromEntries(
    CAPABILITIES.map((capability) => [
      capability.id,
      capability.scopes.filter((scope) => grants.includes(scope)).length,
    ]),
  );
}

export function CapabilitySurface(props: CapabilitySurfaceProps) {
  const { selectedId, focusedLabel, grants, editing, onSelect, onToggle } = props;
  const rootRef = useRef<HTMLElement>(null);
  const previousCountsRef = useRef<Record<string, number>>(getGrantCounts(grants));
  const grantSignature = [...grants].sort().join('|');

  useGSAP(
    () => {
      const borderPaths = gsap.utils.toArray<SVGPathElement>('.capability-card-border');
      borderPaths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      });

      const timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      timeline
        .fromTo('[data-surface-trace="top"]', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.3 })
        .fromTo('[data-surface-trace="right"]', { scaleY: 0, transformOrigin: 'top center' }, { scaleY: 1, duration: 0.25 }, '-=0.05')
        .fromTo('.frame-col-divider', { scaleY: 0, transformOrigin: 'top center' }, { scaleY: 1, duration: 0.3, stagger: 0.06 }, '-=0.1')
        .to(borderPaths, { strokeDashoffset: 0, duration: 0.4, stagger: 0.05 }, '-=0.15')
        .fromTo('.card-content', { opacity: 0.84, y: 5 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power3.out' }, '-=0.1');
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      CAPABILITIES.forEach((capability) => {
        const previous = previousCountsRef.current[capability.id] ?? 0;
        const next = capability.scopes.filter((scope) => grants.includes(scope)).length;
        if (previous === next) return;

        const card = rootRef.current?.querySelector<HTMLElement>(`[data-capability-id="${capability.id}"]`);
        const stage = card?.querySelector<HTMLElement>('[data-count-stage]');
        const value = stage?.querySelector<HTMLElement>('[data-count-value]');
        if (stage && value) {
          const ghost = value.cloneNode(true) as HTMLElement;
          ghost.removeAttribute('data-count-value');
          ghost.classList.add('is-count-ghost');
          ghost.textContent = String(previous).padStart(2, '0');
          stage.appendChild(ghost);

          const direction = next > previous ? 1 : -1;
          const timeline = gsap.timeline({ onComplete: () => ghost.remove() });
          timeline
            .to(ghost, { y: -20 * direction, opacity: 0, duration: 0.24, ease: 'power2.in' }, 0)
            .fromTo(value, { y: 20 * direction, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, 0.08);
        }

        if (next > previous) {
          const segment = card?.querySelector<HTMLElement>(`[data-load-segment="${next - 1}"]`);
          if (segment) {
            gsap.fromTo(segment, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.18, ease: 'power2.out' });
          }
        }

        previousCountsRef.current[capability.id] = next;
      });
    },
    { scope: rootRef, dependencies: [grantSignature] },
  );

  const triggerGrantRipple = (event: ReactMouseEvent<HTMLButtonElement>, granted: boolean) => {
    if (granted) return;
    const card = event.currentTarget.closest<HTMLElement>('[data-capability-module]');
    const ripple = card?.querySelector<HTMLElement>('[data-card-ripple]');
    if (!card || !ripple) return;

    const cardRect = card.getBoundingClientRect();
    const sourceRect = event.currentTarget.getBoundingClientRect();
    gsap.killTweensOf(ripple);
    gsap.set(ripple, {
      left: sourceRect.left - cardRect.left,
      top: sourceRect.top - cardRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      opacity: 0.16,
    });
    gsap.to(ripple, {
      left: 0,
      top: 0,
      width: cardRect.width,
      height: cardRect.height,
      opacity: 0,
      duration: 0.5,
      ease: 'power3.out',
    });
  };

  return (
    <section ref={rootRef} className="sdk-os-capability-surface control-section">
      <SectionHeading
        index="01"
        label="Capability surface"
        title="Policy workstations"
        detail={`Editing ${focusedLabel}`}
      />

      <div className="machine-surface" data-machine-frame>
        <span data-surface-trace="top" className="machine-trace machine-trace-top" aria-hidden="true" />
        <span data-surface-trace="right" className="machine-trace machine-trace-right" aria-hidden="true" />
        <span className="frame-col-divider frame-col-divider-a" aria-hidden="true" />
        <span className="frame-col-divider frame-col-divider-b" aria-hidden="true" />
        <span className="frame-col-divider frame-col-divider-c" aria-hidden="true" />

        <div className="machine-surface-rail">
          <span>CAPABILITY BUS / REV 1.4.2</span>
          <span className="ml-auto text-[var(--app-accent)]/65">SIGNAL LOCKED</span>
          <span className={`capability-signal-sweep ${editing ? 'is-paused' : ''}`} aria-hidden="true" />
        </div>

        <div className="machine-surface-grid">
          {CAPABILITIES.map((capability) => {
            const activeCount = capability.scopes.filter((scope) => grants.includes(scope)).length;
            const selected = capability.id === selectedId;

            return (
              <article
                key={capability.id}
                data-capability-module
                data-capability-id={capability.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => onSelect(capability.id, capability.scopes[0])}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(capability.id, capability.scopes[0]);
                  }
                }}
                className={`machine-module machine-slot-${capability.id} group relative min-w-0 cursor-pointer overflow-hidden ${selected ? 'is-selected' : 'is-muted'}`}
              >
                <svg className="capability-card-outline pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path className="capability-card-border" d="M.5 .5H99.5V79.5H90V99.5H.5Z" vectorEffect="non-scaling-stroke" />
                </svg>
                <span data-card-ripple className="capability-ripple pointer-events-none absolute z-0 bg-[var(--app-accent)]" aria-hidden="true" />
                <div className="card-content relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.22em]">
                    <span className="text-white/25">{capability.code}</span>
                    <span data-live-readout className={activeCount ? 'text-[var(--app-accent)]/75' : 'text-white/22'}>
                      {activeCount}/{capability.scopes.length} live
                    </span>
                  </div>

                  <div data-count-stage className="capability-count-stage" aria-hidden="true">
                    <span data-count-value className="capability-count-value">
                      {String(activeCount).padStart(2, '0')}
                    </span>
                    <small>enabled</small>
                  </div>

                  <div className="module-copy relative mt-auto">
                    <h3 className="capability-title font-display font-semibold text-white/92">{capability.title}</h3>
                    <p className="module-description mt-2 max-w-[290px] font-body text-xs leading-5 text-white/40">
                      {capability.description}
                    </p>
                  </div>

                  <div className="permission-rail mt-4">
                    {capability.scopes.map((scope) => {
                      const granted = grants.includes(scope);
                      const action = scope.split(':').at(-1) ?? scope;
                      return (
                        <button
                          type="button"
                          key={scope}
                          aria-pressed={granted}
                          onClick={(event) => {
                            event.stopPropagation();
                            triggerGrantRipple(event, granted);
                            onSelect(capability.id, scope);
                            onToggle(scope);
                          }}
                          className={`module-scope-command ${granted ? 'is-active' : ''}`}
                        >
                          <span className="module-scope-dot" />
                          <strong>{action}</strong>
                          <small>{granted ? 'enabled' : 'blocked'}</small>
                        </button>
                      );
                    })}
                  </div>

                  <ChannelLoad active={activeCount} total={capability.scopes.length} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ index, label, title, detail }: { index: string; label: string; title: string; detail?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-white/[0.08] pb-4">
      <span className="font-mono text-[8px] text-[var(--app-accent)]/60">{index}</span>
      <div>
        <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-white/25">{label}</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-white/90 sm:text-2xl">{title}</h2>
      </div>
      {detail ? <span className="w-full font-mono text-[8px] uppercase tracking-[0.16em] text-white/20 sm:ml-auto sm:w-auto">{detail}</span> : null}
    </div>
  );
}

function ChannelLoad({ active, total }: { active: number; total: number }) {
  return (
    <div className="channel-load mt-4 border-t border-white/[0.07] pt-3">
      <div className="mb-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
        <span>Channel load</span>
        <span>{active}/{total}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            data-load-segment={index}
            className={`h-0.5 flex-1 ${index < active ? 'bg-[var(--app-accent)]' : 'bg-white/10'}`}
          />
        ))}
      </div>
    </div>
  );
}
