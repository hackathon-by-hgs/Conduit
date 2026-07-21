'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CaretDown, Check, Play, Pulse, X } from '@phosphor-icons/react';
import { ENDPOINTS } from './control-data';
import { MagneticFillButton } from './magnetic-fill-button';

gsap.registerPlugin(useGSAP);

type SimulationLaneProps = {
  entityLabel: string;
  grants: string[];
};

export function SimulationLane({ entityLabel, grants }: SimulationLaneProps) {
  const rootRef = useRef<HTMLElement>(null);
  const endpointDropdownRef = useRef<HTMLDivElement>(null);
  const endpointMenuRef = useRef<HTMLDivElement>(null);
  const [endpointIndex, setEndpointIndex] = useState(0);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<'allowed' | 'denied' | null>(null);
  const endpoint = ENDPOINTS[endpointIndex];
  const allowed = grants.includes(endpoint.scope);
  const { contextSafe } = useGSAP({ scope: rootRef });

  useEffect(() => {
    if (!endpointOpen) return;

    const handler = (event: MouseEvent) => {
      if (endpointDropdownRef.current && !endpointDropdownRef.current.contains(event.target as Node)) {
        setEndpointOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [endpointOpen]);

  useEffect(() => {
    if (!endpointOpen || !endpointMenuRef.current) return;

    gsap.fromTo(
      endpointMenuRef.current,
      { autoAlpha: 0, y: -8, scale: 0.985, transformOrigin: 'top center' },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' },
    );
  }, [endpointOpen]);

  const runTest = contextSafe(() => {
    setRunning(true);
    setResult(null);
    gsap.killTweensOf('[data-test-progress]');
    gsap.fromTo(
      '[data-test-progress]',
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 0.65,
        ease: 'power2.inOut',
        onComplete: () => {
          setResult(allowed ? 'allowed' : 'denied');
          setRunning(false);
        },
      },
    );
  });

  return (
    <section ref={rootRef} className="min-h-full overflow-visible bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <div>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">
            Request test
          </p>
          <h2 className="mt-2 max-w-[640px] font-sans text-[clamp(20px,2.2vw,28px)] font-semibold leading-tight tracking-[-0.04em] text-white">
            Check access before sending a request
          </h2>
          <p className="mt-1.5 max-w-[600px] text-[12px] leading-6 text-white/40">
            Simulate an SDK route against the selected access entity without sending traffic to production.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-white/[0.045] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
          {entityLabel}
        </span>
      </header>

      <div className="grid min-h-[430px] gap-px bg-white/[0.055] lg:grid-cols-[minmax(0,0.96fr)_minmax(300px,0.74fr)]">
        <div className="relative overflow-visible bg-gradient-to-b from-[#080808]/98 via-[#0b0b0b]/98 to-black/98 p-4 sm:p-7">
          <label className="block">
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30">
              API endpoint
            </span>
            <div ref={endpointDropdownRef} className="relative z-30 mt-3">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={endpointOpen}
                onClick={() => setEndpointOpen((open) => !open)}
                className={[
                  'flex h-14 w-full items-center justify-between rounded-[20px] border px-4 text-left font-mono text-[12px] font-semibold outline-none transition-[background-color,border-color] duration-180',
                  endpointOpen
                    ? 'border-[#A01016]/70 bg-white/[0.07] text-white'
                    : 'border-white/[0.08] bg-white/[0.045] text-white/88 hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <span><span className="text-white">{endpoint.method}</span> <span className="ml-2 text-white/88">{endpoint.path}</span></span>
                <CaretDown className={['h-4 w-4 text-white/42 transition-transform duration-200', endpointOpen ? 'rotate-180 text-white/72' : ''].join(' ')} weight="bold" />
              </button>

              {endpointOpen ? (
                <div
                  ref={endpointMenuRef}
                  role="listbox"
                  aria-label="Select API endpoint"
                  className="access-scroll absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[280px] overflow-y-auto rounded-[20px] border border-white/[0.08] bg-[#050505]/98 p-1.5 backdrop-blur-2xl"
                >
                  {ENDPOINTS.map((item, index) => {
                    const active = index === endpointIndex;
                    const itemAllowed = grants.includes(item.scope);

                    return (
                      <button
                        key={`${item.method}-${item.path}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setEndpointIndex(index);
                          setResult(null);
                          setEndpointOpen(false);
                        }}
                        className={[
                          'grid h-auto min-h-12 w-full grid-cols-[64px_minmax(0,1fr)] gap-2 rounded-[16px] px-3 py-2 text-left font-mono transition-[background-color,color] duration-150 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:gap-0 sm:py-0',
                          active ? 'bg-[#A01016]/16 text-white' : 'text-white/58 hover:bg-white/[0.055] hover:text-white',
                        ].join(' ')}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/62">{item.method}</span>
                        <span className="truncate text-[12px] font-semibold">{item.path}</span>
                        <span className={['col-span-2 w-fit rounded-full px-2 py-1 text-[7px] uppercase tracking-[0.12em] sm:col-span-1', itemAllowed ? 'bg-emerald-400/10 text-emerald-200/70' : 'bg-[#A01016]/12 text-red-200/70'].join(' ')}>
                          {itemAllowed ? 'open' : 'blocked'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {/*
                ▾
              */}
            </div>
          </label>

          <div className="mt-7 border-y border-white/[0.07] py-5">
            <span className="block font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30">
              Required permission
            </span>
            <strong className="mt-3 block font-mono text-[13px] font-medium text-white/78">
              {endpoint.scope}
            </strong>
            <small className={`mt-2 block text-[11px] ${allowed ? 'text-emerald-300/70' : 'text-red-300/78'}`}>
              {allowed ? 'Currently allowed for this entity' : 'Currently blocked for this entity'}
            </small>
          </div>

          <MagneticFillButton
            type="button"
            onClick={runTest}
            disabled={running}
            fillClassName="bg-[#A01016]"
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#A01016] font-sans text-[13px] font-semibold text-white hover:bg-[#bd151d] disabled:pointer-events-none disabled:opacity-55"
          >
            <Play className="h-4 w-4" weight="fill" />
            <span>{running ? 'Testing request...' : 'Run test'}</span>
          </MagneticFillButton>
          <span data-test-progress className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#A01016]" aria-hidden="true" />
        </div>

        <div
          className={[
            'flex min-h-[260px] flex-col items-center justify-center bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-5 text-center sm:p-8',
            result === 'allowed' ? 'text-emerald-300/80' : result === 'denied' ? 'text-red-300/80' : 'text-white/35',
          ].join(' ')}
          aria-live="polite"
        >
          {result === 'allowed' ? (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
                <Check className="h-6 w-6" weight="bold" />
              </span>
              <p className="mt-5 font-sans text-[28px] font-semibold tracking-[-0.04em] text-white/92">Request allowed</p>
              <span className="mt-2 max-w-[260px] text-[12px] leading-6 text-white/42">This credential can call the selected endpoint.</span>
              <code className="mt-5 rounded-full bg-white/[0.045] px-3 py-1.5 font-mono text-[10px] text-white/45">200 OK</code>
            </>
          ) : result === 'denied' ? (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#A01016]/14 text-red-300">
                <X className="h-6 w-6" weight="bold" />
              </span>
              <p className="mt-5 font-sans text-[28px] font-semibold tracking-[-0.04em] text-white/92">Request blocked</p>
              <span className="mt-2 max-w-[280px] text-[12px] leading-6 text-white/42">Grant {endpoint.scope} before sending this request.</span>
              <code className="mt-5 rounded-full bg-white/[0.045] px-3 py-1.5 font-mono text-[10px] text-white/45">403 Forbidden</code>
            </>
          ) : (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.045] text-[#A01016]">
                <Pulse className="h-6 w-6" weight="bold" />
              </span>
              <p className="mt-5 font-sans text-[28px] font-semibold tracking-[-0.04em] text-white/92">Ready to test</p>
              <span className="mt-2 max-w-[260px] text-[12px] leading-6 text-white/42">No request will be sent.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
